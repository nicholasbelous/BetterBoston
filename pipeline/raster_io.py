"""Shared raster and network glue for the Landsat data pipeline.

Holds the STAC client helper, atomic file writes, and the raster helpers
(window reads, the inside-Boston mask, GeoTIFF writes). No scoring math lives
here; that stays in ``scoring.py``.

``window_read`` is the only function that reads pixels from a source scene,
so no code path downloads a full scene (Requirements 5.11, 6.11).

Heavy libraries are imported inside the functions that need them, so the
module can be imported (for example for ``write_json_atomic``) without the
geo/STAC stack installed.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Mapping, Sequence

from config import HTTP_TIMEOUT_S, OUTPUT_CRS, STAC_API_URL

if TYPE_CHECKING:  # pragma: no cover - type hints only
    import geopandas
    import numpy as np
    import rasterio
    from affine import Affine
    from rasterio.crs import CRS

# GDAL config for remote COG reads: skip directory listings on blob storage.
GDAL_ENV_OPTIONS = {"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR"}


@dataclass(frozen=True)
class Band:
    """One band read from a raster window, with the metadata to save it."""

    data: np.ndarray  # 2-D, source dtype
    crs: CRS
    transform: Affine  # geotransform of the window that was read
    dtype: str
    nodata: float | None


class WindowError(Exception):
    """The BOSTON_BBOX window lies outside the raster or has zero rows/cols."""


def _gdal_env():
    import rasterio

    return rasterio.Env(**GDAL_ENV_OPTIONS)


def window_read(src: rasterio.DatasetReader, bbox_4326: Sequence[float]) -> Band:
    """Read band 1 of ``src`` over ``bbox_4326`` (``[minLng, minLat, maxLng, maxLat]``).

    Converts the bbox to the raster CRS with ``transform_bounds``, builds the
    window with ``from_bounds``, rounds it to whole pixels, and clips it to the
    raster. Raises ``WindowError`` if the window does not overlap the raster
    or has zero rows or columns. Values are returned unchanged in the source
    dtype, with the window's geotransform.
    """
    from rasterio.errors import WindowError as RioWindowError
    from rasterio.warp import transform_bounds
    from rasterio.windows import Window, from_bounds

    if len(bbox_4326) != 4:
        raise WindowError(f"bbox must have 4 values, got {len(bbox_4326)}")
    if src.crs is None:
        raise WindowError("raster has no CRS")

    bounds = transform_bounds(OUTPUT_CRS, src.crs, *bbox_4326)
    try:
        win = from_bounds(*bounds, transform=src.transform)
        win = win.round_offsets().round_lengths()
        win = win.intersection(Window(0, 0, src.width, src.height))
    except RioWindowError as exc:
        raise WindowError(f"window does not overlap the raster: {exc}") from exc
    if int(win.width) <= 0 or int(win.height) <= 0:
        raise WindowError(
            f"window has zero rows or columns (width={win.width}, height={win.height})"
        )

    with _gdal_env():
        data = src.read(1, window=win)
    nodata = src.nodata
    return Band(
        data=data,
        crs=src.crs,
        transform=src.window_transform(win),
        dtype=str(src.dtypes[0]),
        nodata=None if nodata is None else float(nodata),
    )


def open_band(path_or_href: str, bbox_4326: Sequence[float]) -> Band:
    """Open a local path or (signed) remote href and ``window_read`` it."""
    import rasterio

    with _gdal_env():
        with rasterio.open(path_or_href) as src:
            return window_read(src, bbox_4326)


def check_alignment(bands: Mapping[str, Band]) -> list[str]:
    """Compare CRS, shape, and transform of each band with the first band.

    Returns one message per differing (band, attribute), naming both; an
    empty list means all bands are aligned.
    """
    items = list(bands.items())
    if not items:
        return []
    ref_name, ref = items[0]
    ref_attrs = {"crs": ref.crs, "shape": ref.data.shape, "transform": ref.transform}
    messages: list[str] = []
    for name, band in items[1:]:
        attrs = {"crs": band.crs, "shape": band.data.shape, "transform": band.transform}
        for attr, value in attrs.items():
            if value != ref_attrs[attr]:
                messages.append(
                    f"{name}: {attr} differs from {ref_name} "
                    f"({_fmt(value)} vs {_fmt(ref_attrs[attr])})"
                )
    return messages


def _fmt(value: Any) -> str:
    """One-line text for a CRS, Affine, or shape in alignment messages."""
    from affine import Affine

    if isinstance(value, Affine):
        return str(tuple(value)[:6])
    to_string = getattr(value, "to_string", None)
    if callable(to_string):  # rasterio CRS
        return to_string() or str(value)
    return str(value)


def load_boundary(path: Path) -> geopandas.GeoDataFrame:
    """Read the Boston_Boundary GeoJSON as a GeoDataFrame in EPSG:4326."""
    import geopandas

    gdf = geopandas.read_file(path)
    if gdf.crs is None:
        return gdf.set_crs(OUTPUT_CRS)
    return gdf.to_crs(OUTPUT_CRS)


def inside_mask(
    boundary: geopandas.GeoDataFrame,
    crs: CRS,
    transform: Affine,
    shape: tuple[int, int],
) -> np.ndarray:
    """Boolean array, True where the pixel center lies inside ``boundary``.

    The boundary is reprojected to ``crs``; ``all_touched=False`` selects
    pixels by their centers (Requirement 7.1).
    """
    from rasterio.features import geometry_mask

    geoms = [g for g in boundary.to_crs(crs).geometry if g is not None and not g.is_empty]
    return geometry_mask(
        geoms,
        out_shape=tuple(shape),
        transform=transform,
        all_touched=False,
        invert=True,
    )


def write_band(path: Path, band: Band) -> None:
    """Save ``band`` as a single-band GeoTIFF at ``path``.

    Keeps the dtype, CRS, transform, and nodata unchanged and uses lossless
    DEFLATE compression. Writes to ``<path>.tmp`` and moves it into place
    with ``os.replace``; on failure the temp file is removed and an existing
    file at ``path`` is left unchanged.
    """
    import rasterio

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    height, width = band.data.shape
    profile = {
        "driver": "GTiff",
        "height": height,
        "width": width,
        "count": 1,
        "dtype": band.dtype,
        "crs": band.crs,
        "transform": band.transform,
        "nodata": band.nodata,
        "compress": "deflate",
    }
    try:
        with rasterio.open(tmp, "w", **profile) as dst:
            dst.write(band.data.astype(band.dtype, copy=False), 1)
        os.replace(tmp, path)
    except BaseException:
        try:
            tmp.unlink()
        except FileNotFoundError:
            pass
        raise


def open_stac(timeout: int = HTTP_TIMEOUT_S):
    """Open the Planetary Computer STAC API with signed asset hrefs.

    ``timeout`` is the HTTP timeout in seconds for every request the client
    makes. Raises whatever ``pystac_client`` raises on connection, HTTP, or
    timeout errors; callers decide how to report them.
    """
    import planetary_computer
    import pystac_client

    return pystac_client.Client.open(
        STAC_API_URL,
        modifier=planetary_computer.sign_inplace,
        timeout=timeout,
    )


def write_json_atomic(path: Path, text: str) -> None:
    """Write ``text`` to ``path`` atomically.

    Creates the parent directory (and any missing parents) first, writes to
    ``<path>.tmp``, then moves it into place with ``os.replace``. If anything
    fails before the replace, an existing file at ``path`` is left unchanged.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, path)
    except BaseException:
        try:
            tmp.unlink()
        except FileNotFoundError:
            pass
        raise
