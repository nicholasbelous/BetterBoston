"""Turn the saved Landsat bands into scored 100 m cells for the City of Boston.

Every Boston cell is scored against all of Boston. Cells whose center lies in
a neighborhood listed in ``config.EXCLUDED_NEIGHBORHOODS`` (or in no
neighborhood) are left out of the published grid.

Run from the repo root:

    python3 pipeline/build_grid.py

Pure helpers come first and do no file or network I/O, so tests can call them
on plain numpy arrays. Importing this module runs nothing; rasterio, geopandas,
and pyproj are imported only inside the I/O functions.

I/O (Requirements 7.9, 7.10, 11): ``main`` checks every exit condition in the
order 1.8 -> 10.9 -> 7.10 -> 7.9 -> 8.8 -> 9.11 before writing anything, then
writes Work_Grid/Work_Meta, runs the Validator, and publishes to
``data/scores/`` only when it passes. Paths come from ``config`` and are
resolved against ``config.REPO_ROOT`` at call time, so tests can monkeypatch
``config.REPO_ROOT`` (and ``config.BOSTON_BBOX``) to use a temporary layout.

Pixel pipeline (Requirement 7):
- ``classify_pixels`` marks Valid_Heat_Pixels and Valid_Tree_Pixels.
- ``pixel_centers`` gives raster-CRS coordinates of (col + 0.5, row + 0.5).
- ``assign_cells`` bins EPSG:26919 coordinates into 100 m lower-left corners.
- ``aggregate`` sums per-cell counts and values with ``np.bincount`` and keeps
  every value unrounded; rounding happens only when scoring and writing.
"""

from __future__ import annotations

import datetime as _dt
import json
import math
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np

import config
from config import (
    ASSET_KEYS,
    BAND_PATHS,
    BOSTON_GEOJSON,
    CELL_SIZE_M,
    EXCLUDED_NEIGHBORHOODS,
    MIN_VALID_FRAC,
    NDVI_THRESHOLD,
    NEIGHBORHOOD_SNAP_M,
    NEIGHBORHOODS_GEOJSON,
    OUTPUT_CRS,
    PROCESSING_CRS,
    SCENE_FILE,
    SCORES_GRID,
    SCORES_META,
    VALIDATOR,
    WORK_GRID,
    WORK_META,
    abs_path,
    ensure_work_dir,
    require_boston_bbox,
)
from scoring import dn_to_fahrenheit, dn_to_reflectance, ndvi, percentile_rank, qa_mask

if TYPE_CHECKING:  # type hints only; keeps import light
    from collections.abc import Callable, Sequence

    import geopandas
    from affine import Affine

    from raster_io import Band

    # (x, y) in EPSG:26919 -> (lng, lat) in EPSG:4326, e.g. a pyproj
    # ``Transformer.from_crs(..., always_xy=True).transform``.
    To4326 = Callable[[float, float], tuple[float, float]]
    # (x, y) of a cell center in EPSG:26919 -> neighborhood name, or None.
    NeighborhoodOf = Callable[[float, float], str | None]

# ASCII digits only: ``\d`` would also match other Unicode digits.
_DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")


# ---- in-memory types --------------------------------------------------------


@dataclass(frozen=True)
class SceneInfo:
    """The scene chosen in the Scene_File."""

    id: str  # non-empty, copied unchanged
    date: str  # YYYY-MM-DD, valid calendar date, copied unchanged
    platform: str | None


@dataclass(frozen=True)
class CellStats:
    """Per-cell aggregates, one entry per Boston_Cell, sorted by (easting, northing).

    All values are unrounded.
    """

    easting: np.ndarray  # int64 lower-left, multiple of the cell size
    northing: np.ndarray  # int64 lower-left, multiple of the cell size
    n_inside: np.ndarray  # int64, >= 1
    n_heat: np.ndarray  # int64, <= n_inside
    n_tree: np.ndarray  # int64, <= n_heat
    mean_temp: np.ndarray  # float64 degrees F, NaN where n_heat == 0
    pct_veg: np.ndarray  # float64 0..100, NaN where n_tree == 0
    heat_frac: np.ndarray  # float64 n_heat / n_inside
    tree_frac: np.ndarray  # float64 n_tree / n_inside

    def __len__(self) -> int:
        return int(self.easting.shape[0])


@dataclass(frozen=True)
class ScoredCells:
    """Scores for every Boston_Cell, index-aligned with ``stats`` (Requirement 8).

    Heat fields are ``None`` for cells outside Reference_Set_Heat; tree fields
    are ``None`` for cells outside Reference_Set_Tree. The two are independent.
    """

    stats: CellStats
    temp_r: list[float | None]  # round(mean_temp, 1)
    temp_diff: list[float | None]  # round(temp_r - reference_mean_f, 1)
    heat_score: list[int | None]  # 0..100
    veg_r: list[float | None]  # round(pct_veg, 1)
    tree_score: list[int | None]  # 0..100
    reference_mean_f: float  # rounded to 0.1

    def __len__(self) -> int:
        return len(self.stats)


@dataclass(frozen=True)
class OutputCell:
    """A Boston_Cell whose center lies in an included neighborhood (Requirement 9)."""

    index: int  # row in ScoredCells / CellStats
    easting: int  # lower-left, EPSG:26919
    northing: int  # lower-left, EPSG:26919
    neighborhood: str
    ring: list[list[float]]  # 5 [lng, lat] positions, rounded to 6 decimals
    bbox: list[float]  # [minLng, minLat, maxLng, maxLat] of ``ring``


class EmptyCoverage(Exception):
    """No Boston cell lies in an included neighborhood (Requirement 9.11)."""

    def __init__(self) -> None:
        super().__init__(
            "no Boston cell lies in an included neighborhood "
            f"(excluded: {', '.join(EXCLUDED_NEIGHBORHOODS) or 'none'})"
        )


class EmptyReferenceSet(Exception):
    """Reference_Set_Heat or Reference_Set_Tree has no cells (Requirement 8.8).

    ``which`` is ``"heat"`` or ``"tree"``.
    """

    def __init__(self, which: str, min_valid_frac: float = MIN_VALID_FRAC) -> None:
        self.which = which
        name = "Reference_Set_Heat" if which == "heat" else "Reference_Set_Tree"
        frac = "heat_valid_frac" if which == "heat" else "tree_valid_frac"
        super().__init__(
            f"{name} is empty: no Boston cell has {frac} >= {min_valid_frac}"
        )


class SceneError(Exception):
    """The Scene_File is unusable; names the file and the bad key (Requirement 10.9).

    ``key`` is ``"id"`` or ``"date"`` for a missing or invalid key, or ``None``
    when the whole file is the problem (missing, unreadable, not JSON, not an
    object).
    """

    def __init__(self, key: str | None, reason: str, path=SCENE_FILE) -> None:
        self.key = key
        self.reason = reason
        self.path = path
        where = f'key "{key}"' if key is not None else "file"
        super().__init__(f"{path}: Scene_File {where}: {reason}")


# ---- pure helpers -----------------------------------------------------------


def _is_valid_date(value: str) -> bool:
    """True for a ``YYYY-MM-DD`` string that is a real calendar date."""
    if not _DATE_RE.fullmatch(value):
        return False
    try:
        _dt.date.fromisoformat(value)
    except ValueError:
        return False
    return True


def parse_scene(text: str) -> SceneInfo:
    """Parse Scene_File text into a ``SceneInfo`` (Requirement 10.9).

    Requires a JSON object with a non-empty string ``"id"`` and a ``"date"``
    string in ``YYYY-MM-DD`` form that is a valid calendar date. ``id`` and
    ``date`` are copied unchanged. ``platform`` is kept when it is a string,
    else ``None``. Raises ``SceneError`` naming the Scene_File and the missing
    or invalid key.
    """
    try:
        obj = json.loads(text)
    except (TypeError, ValueError) as exc:
        raise SceneError(None, f"not valid JSON ({exc})") from exc
    if not isinstance(obj, dict):
        raise SceneError(None, f"must be a JSON object, got {type(obj).__name__}")

    if "id" not in obj:
        raise SceneError("id", "missing")
    scene_id = obj["id"]
    if not isinstance(scene_id, str):
        raise SceneError("id", f"must be a string, got {type(scene_id).__name__}")
    if not scene_id:
        raise SceneError("id", "empty")

    if "date" not in obj:
        raise SceneError("date", "missing")
    scene_date = obj["date"]
    if not isinstance(scene_date, str):
        raise SceneError("date", f"must be a string, got {type(scene_date).__name__}")
    if not _is_valid_date(scene_date):
        raise SceneError("date", f"{scene_date!r} is not a valid YYYY-MM-DD date")

    platform = obj.get("platform")
    return SceneInfo(
        id=scene_id,
        date=scene_date,
        platform=platform if isinstance(platform, str) else None,
    )


def pixel_centers(transform: "Affine", shape) -> tuple[np.ndarray, np.ndarray]:
    """Raster-CRS ``(x, y)`` of every pixel center, each of shape ``(rows, cols)``.

    The center of the pixel at (row, col) is ``transform * (col + 0.5, row + 0.5)``
    (Requirement 7.4).
    """
    rows, cols = int(shape[0]), int(shape[1])
    col_c = np.arange(cols, dtype=np.float64) + 0.5
    row_c = np.arange(rows, dtype=np.float64) + 0.5
    cc, rr = np.meshgrid(col_c, row_c)  # both (rows, cols)
    t = transform
    x = t.a * cc + t.b * rr + t.c
    y = t.d * cc + t.e * rr + t.f
    return x, y


def classify_pixels(inside, lwir, red, nir, qa) -> tuple[np.ndarray, np.ndarray]:
    """Valid_Heat_Pixel and Valid_Tree_Pixel masks (Requirement 7.2).

    ``heat_valid = inside & (lwir != 0) & ~qa_mask(qa)``;
    ``tree_valid = heat_valid & (red != 0) & (nir != 0)``.
    So ``tree_valid`` is within ``heat_valid``, which is within ``inside``.
    """
    inside_b = np.asarray(inside, dtype=bool)
    heat_valid = inside_b & (np.asarray(lwir) != 0) & ~qa_mask(qa)
    tree_valid = heat_valid & (np.asarray(red) != 0) & (np.asarray(nir) != 0)
    return heat_valid, tree_valid


def assign_cells(easting, northing, cell_size) -> tuple[np.ndarray, np.ndarray]:
    """int64 lower-left cell corners: ``floor(v / cell_size) * cell_size`` per axis.

    Each corner satisfies ``corner <= v < corner + cell_size`` (Requirement 7.4).
    """
    return _floor_to(easting, cell_size), _floor_to(northing, cell_size)


def _floor_to(values, size) -> np.ndarray:
    """Largest multiple of ``size`` that is ``<= values``, as int64."""
    v = np.asarray(values, dtype=np.float64)
    size_i = int(size)
    corner = np.floor(v / size_i).astype(np.int64) * size_i
    # Float division can land one cell off right next to a cell edge; fix it so
    # corner <= v < corner + size always holds.
    corner = np.where(v < corner, corner - size_i, corner)
    corner = np.where(v >= corner + size_i, corner + size_i, corner)
    return corner.astype(np.int64)


def aggregate(
    cell_e,
    cell_n,
    heat_valid,
    tree_valid,
    temp_f,
    ndvi_vals,
    threshold: float,
) -> CellStats:
    """Per-cell counts and unrounded means for pixels inside Boston (Requirements 7.3–7.8).

    All inputs are 1-D arrays of the same length, one entry per pixel center
    inside the Boston boundary. Every distinct ``(cell_e, cell_n)`` becomes one
    cell, so each cell has at least one inside pixel. A Valid_Tree_Pixel is
    vegetated when ``ndvi > threshold``; NaN and threshold-equal NDVI are not.
    """
    e = np.asarray(cell_e, dtype=np.int64).reshape(-1)
    n = np.asarray(cell_n, dtype=np.int64).reshape(-1)
    heat = np.asarray(heat_valid, dtype=bool).reshape(-1)
    # A Valid_Tree_Pixel is always a Valid_Heat_Pixel.
    tree = np.asarray(tree_valid, dtype=bool).reshape(-1) & heat
    temps = np.asarray(temp_f, dtype=np.float64).reshape(-1)
    nd = np.asarray(ndvi_vals, dtype=np.float64).reshape(-1)

    sizes = {e.size, n.size, heat.size, tree.size, temps.size, nd.size}
    if len(sizes) != 1:
        raise ValueError("aggregate: all inputs must have the same length")

    keys, inv = np.unique(np.stack([e, n], axis=1), axis=0, return_inverse=True)
    inv = np.asarray(inv).reshape(-1)
    k = keys.shape[0]

    n_inside = np.bincount(inv, minlength=k).astype(np.int64)
    n_heat = np.bincount(inv[heat], minlength=k).astype(np.int64)
    n_tree = np.bincount(inv[tree], minlength=k).astype(np.int64)
    sum_temp = np.bincount(inv, weights=np.where(heat, temps, 0.0), minlength=k)
    with np.errstate(invalid="ignore"):
        vegetated = tree & (nd > threshold)  # NaN > x is False
    n_veg = np.bincount(inv[vegetated], minlength=k).astype(np.int64)

    with np.errstate(divide="ignore", invalid="ignore"):
        mean_temp = np.where(n_heat > 0, sum_temp / n_heat, np.nan)
        pct_veg = np.where(n_tree > 0, 100.0 * n_veg / n_tree, np.nan)
        heat_frac = n_heat / n_inside
        tree_frac = n_tree / n_inside

    return CellStats(
        easting=keys[:, 0].astype(np.int64),
        northing=keys[:, 1].astype(np.int64),
        n_inside=n_inside,
        n_heat=n_heat,
        n_tree=n_tree,
        mean_temp=np.asarray(mean_temp, dtype=np.float64),
        pct_veg=np.asarray(pct_veg, dtype=np.float64),
        heat_frac=np.asarray(heat_frac, dtype=np.float64),
        tree_frac=np.asarray(tree_frac, dtype=np.float64),
    )


def score_cells(stats: CellStats, min_valid_frac: float = MIN_VALID_FRAC) -> ScoredCells:
    """Reference mean, temperature differences, and scores over all Boston_Cells (Requirement 8).

    - Reference sets use the unrounded fractions: ``heat_frac >= min_valid_frac``
      and ``tree_frac >= min_valid_frac``, chosen independently (8.5, 8.6).
    - Values are rounded to 0.1 with Python ``round`` before averaging and
      ranking (8.1, 8.3, 8.4).
    - ``reference_mean_f = round(mean(temp_r over heat set), 1)`` (8.1) and
      ``temp_diff = round(temp_r - reference_mean_f, 1)`` (8.2).
    - Ranking covers every cell in ``stats`` with NaN for excluded cells, so
      ``n`` is the reference set size (8.3, 8.4, 8.7).

    Raises ``EmptyReferenceSet("heat")`` or ``EmptyReferenceSet("tree")`` when
    a reference set has no cells (8.8); heat is checked first.
    """
    heat_frac = np.asarray(stats.heat_frac, dtype=np.float64)
    tree_frac = np.asarray(stats.tree_frac, dtype=np.float64)
    mean_temp = np.asarray(stats.mean_temp, dtype=np.float64)
    pct_veg = np.asarray(stats.pct_veg, dtype=np.float64)

    # NaN >= x is False, so a NaN fraction is never in a reference set.
    heat_ok = heat_frac >= min_valid_frac
    tree_ok = tree_frac >= min_valid_frac
    if not heat_ok.any():
        raise EmptyReferenceSet("heat", min_valid_frac)
    if not tree_ok.any():
        raise EmptyReferenceSet("tree", min_valid_frac)

    n = len(stats)
    temp_r: list[float | None] = [
        round(float(mean_temp[i]), 1) if heat_ok[i] else None for i in range(n)
    ]
    veg_r: list[float | None] = [
        round(float(pct_veg[i]), 1) if tree_ok[i] else None for i in range(n)
    ]

    heat_vals = [t for t in temp_r if t is not None]
    reference_mean_f = round(math.fsum(heat_vals) / len(heat_vals), 1)

    temp_diff: list[float | None] = [
        round(t - reference_mean_f, 1) if t is not None else None for t in temp_r
    ]

    heat_rank = percentile_rank(
        np.array([np.nan if t is None else t for t in temp_r], dtype=np.float64)
    )
    tree_rank = percentile_rank(
        np.array([np.nan if v is None else v for v in veg_r], dtype=np.float64)
    )
    heat_score: list[int | None] = [
        int(heat_rank[i]) if heat_ok[i] else None for i in range(n)
    ]
    tree_score: list[int | None] = [
        int(tree_rank[i]) if tree_ok[i] else None for i in range(n)
    ]

    return ScoredCells(
        stats=stats,
        temp_r=temp_r,
        temp_diff=temp_diff,
        heat_score=heat_score,
        veg_r=veg_r,
        tree_score=tree_score,
        reference_mean_f=reference_mean_f,
    )


# ---- geometry, cell selection, and cell properties (Requirement 9) ----------


def cell_ring(e: int, n: int, size: int, to_4326: "To4326") -> list[list[float]]:
    """Closed GeoJSON ring for the cell with lower-left corner ``(e, n)`` (9.3).

    Corners in order lower-left, lower-right, upper-right, upper-left, each
    transformed to ``[lng, lat]`` and rounded to 6 decimals with Python
    ``round``, then the first position repeated: 5 positions in total.
    """
    e, n, s = int(e), int(n), int(size)
    corners = ((e, n), (e + s, n), (e + s, n + s), (e, n + s))
    ring: list[list[float]] = []
    for x, y in corners:
        lng, lat = to_4326(float(x), float(y))
        ring.append([round(float(lng), 6), round(float(lat), 6)])
    ring.append(list(ring[0]))
    return ring


def ring_bbox(ring) -> list[float]:
    """``[minLng, minLat, maxLng, maxLat]`` of the ring, no further rounding (9.4)."""
    lngs = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return [min(lngs), min(lats), max(lngs), max(lats)]


def cell_id(e: int, n: int) -> str:
    """``"c_<easting>_<northing>"`` from the integer lower-left corner (9.5)."""
    return f"c_{int(e)}_{int(n)}"


def select_cells(
    scored: ScoredCells,
    size: int = CELL_SIZE_M,
    to_4326: "To4326 | None" = None,
    neighborhood_of: "NeighborhoodOf | None" = None,
    excluded: "Sequence[str]" = EXCLUDED_NEIGHBORHOODS,
) -> list[OutputCell]:
    """Boston_Cells whose center lies in an included neighborhood, with geometry (9.1–9.5, 9.9, 9.11).

    ``neighborhood_of`` names the neighborhood of the cell center
    ``(e + size/2, n + size/2)`` in EPSG:26919. Cells with no neighborhood, or
    one listed in ``excluded``, are left out; they still count in the citywide
    ranking done by ``score_cells``. Output is sorted by ascending northing,
    then easting. Raises ``EmptyCoverage`` when no cell is left.
    """
    if to_4326 is None or neighborhood_of is None:
        raise ValueError("select_cells: to_4326 and neighborhood_of are required")
    stats = scored.stats if isinstance(scored, ScoredCells) else scored
    skip = set(excluded)
    half = int(size) / 2

    cells: list[OutputCell] = []
    for i in range(len(stats)):
        e = int(stats.easting[i])
        n = int(stats.northing[i])
        name = neighborhood_of(e + half, n + half)
        if name is None or name in skip:
            continue
        ring = cell_ring(e, n, size, to_4326)
        cells.append(
            OutputCell(
                index=i,
                easting=e,
                northing=n,
                neighborhood=name,
                ring=ring,
                bbox=ring_bbox(ring),
            )
        )

    if not cells:
        raise EmptyCoverage()
    cells.sort(key=lambda c: (c.northing, c.easting))
    return cells


def _finite(value: float, key: str) -> float:
    """``float(value)``, or ``ValueError`` if it is NaN or infinite (9.6)."""
    v = float(value)
    if not math.isfinite(v):
        raise ValueError(f"cell property {key} is not finite: {v!r}")
    return v


def _opt_round(value, nd: int, key: str) -> float | None:
    """``round(value, nd)`` as a finite Python float, or ``None``."""
    if value is None:
        return None
    return round(_finite(value, key), nd)


def _opt_int(value, key: str) -> int | None:
    """``value`` as a Python ``int`` (rounded to a whole number), or ``None``."""
    if value is None:
        return None
    return int(round(_finite(value, key)))


def cell_properties(cell: OutputCell, scored: ScoredCells, i: int | None = None) -> dict:
    """``ScoreCellProperties`` for one output cell, keys in fixed order (9.5–9.8).

    ``i`` is the row in ``scored``; it defaults to ``cell.index``. Values are
    plain Python ``int``/``float``/``None``; nulls follow the reference-set
    rules already applied in ``score_cells``.
    """
    idx = cell.index if i is None else int(i)
    stats = scored.stats
    return {
        "cell_id": cell_id(cell.easting, cell.northing),
        "bbox": [float(v) for v in cell.bbox],
        "neighborhood": cell.neighborhood,
        "mean_surface_temp_f": _opt_round(scored.temp_r[idx], 1, "mean_surface_temp_f"),
        "temp_diff_f": _opt_round(scored.temp_diff[idx], 1, "temp_diff_f"),
        "pct_vegetated": _opt_round(scored.veg_r[idx], 1, "pct_vegetated"),
        "heat_score": _opt_int(scored.heat_score[idx], "heat_score"),
        "tree_score": _opt_int(scored.tree_score[idx], "tree_score"),
        "heat_valid_frac": round(_finite(stats.heat_frac[idx], "heat_valid_frac"), 3),
        "tree_valid_frac": round(_finite(stats.tree_frac[idx], "tree_valid_frac"), 3),
        "is_sample": False,
    }


def build_feature(cell: OutputCell, props: dict) -> dict:
    """GeoJSON ``Feature`` with only ``type``, ``geometry``, ``properties`` (9.9)."""
    return {
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": [cell.ring]},
        "properties": props,
    }


def build_grid_obj(features) -> dict:
    """GeoJSON ``FeatureCollection`` with only ``type`` and ``features`` (9.9)."""
    return {"type": "FeatureCollection", "features": list(features)}


# ---- metadata and serialization (Requirement 10) ----------------------------

GENERATED_BY = "pipeline/build_grid.py"
REFERENCE_AREA = "City of Boston"


def area_name(excluded: "Sequence[str]" = EXCLUDED_NEIGHBORHOODS) -> str:
    """``"City of Boston"``, plus ``", except A and B"`` for excluded neighborhoods."""
    names = list(excluded)
    if not names:
        return REFERENCE_AREA
    listed = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]
    return f"{REFERENCE_AREA}, except {listed}"
HEAT_SOURCE = (
    "Landsat 8/9 Collection 2 Level-2 surface temperature "
    "(USGS, via Microsoft Planetary Computer)"
)
TREE_SOURCE = "Landsat 8/9 Collection 2 Level-2 surface reflectance, NDVI (same scene)"
# Citation pages for the metadata, in the order required by 10.7.
SOURCES = (
    (
        "Microsoft Planetary Computer: Landsat Collection 2 Level-2",
        "https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2",
    ),
    (
        "USGS Landsat Collection 2",
        "https://www.usgs.gov/landsat-missions/landsat-collection-2",
    ),
    (
        "U.S. Census Bureau Cartographic Boundary Files",
        "https://www.census.gov/geographies/mapping-files/time-series/geo/"
        "cartographic-boundary.html",
    ),
)


def _cells_bbox(cells: "Sequence[OutputCell]") -> list[float]:
    """``[minLng, minLat, maxLng, maxLat]`` covering every output cell (10.3)."""
    return [
        float(min(c.bbox[0] for c in cells)),
        float(min(c.bbox[1] for c in cells)),
        float(max(c.bbox[2] for c in cells)),
        float(max(c.bbox[3] for c in cells)),
    ]


def build_metadata(
    scene: SceneInfo,
    reference_mean_f: float,
    cells: "Sequence[OutputCell]",
    generated_at: str,
) -> dict:
    """``ScoreMetadata`` dict with keys in ``lib/types.ts`` order (10.1–10.8).

    ``generated_at`` is passed in (``YYYY-MM-DDTHH:MM:SSZ``, UTC) so tests can
    fix it. ``reference_mean_f`` must be finite; it is rounded to 0.1. The area
    lists the neighborhoods present in ``cells`` (sorted) and their extent.
    """
    ref = round(_finite(reference_mean_f, "reference_mean_f"), 1)
    return {
        "schema_version": 1,
        "is_sample": False,
        "generated_at": generated_at,
        "generated_by": GENERATED_BY,
        "area": {
            "name": area_name(),
            "neighborhoods": sorted({c.neighborhood for c in cells}),
            "bbox": _cells_bbox(cells),
        },
        "grid": {
            "cell_size_m": CELL_SIZE_M,
            "processing_crs": PROCESSING_CRS,
            "output_crs": OUTPUT_CRS,
            "cell_count": len(cells),
        },
        "heat": {
            "source": HEAT_SOURCE,
            "scene_id": scene.id,
            "scene_date": scene.date,
            "reference_area": REFERENCE_AREA,
            "reference_mean_f": ref,
            "min_valid_frac": MIN_VALID_FRAC,
        },
        "tree": {
            "source": TREE_SOURCE,
            "imagery_dates": scene.date,
            "ndvi_threshold": NDVI_THRESHOLD,
            "leaf_off": False,
            "reference_area": REFERENCE_AREA,
            "min_valid_frac": MIN_VALID_FRAC,
        },
        "sources": [{"name": name, "url": url} for name, url in SOURCES],
        "notes": [
            "Surface temperature, not air temperature",
            f"Single summer day: {scene.date}",
            "Landsat thermal native resolution is 100 m (delivered at 30 m)",
            "30 m pixels mix trees and pavement",
            "Scores are percentile ranks across all City of Boston cells",
        ],
    }


def dumps_grid(grid: dict) -> str:
    """Compact UTF-8 JSON plus one newline, as in ``make_sample_data.py`` (9.9).

    ``allow_nan=False`` makes a stray NaN/Infinity fail loudly (9.6); for
    finite data the text is identical to the sample-data format.
    """
    return json.dumps(grid, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"


def dumps_meta(meta: dict) -> str:
    """2-space indented JSON, non-ASCII unescaped, plus one newline (10.10)."""
    return json.dumps(meta, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def build_outputs(
    stats: CellStats,
    scene: SceneInfo,
    generated_at: str,
    to_4326: "To4326",
    neighborhood_of: "NeighborhoodOf",
) -> tuple[dict, dict]:
    """Score all Boston_Cells, select the included ones, and build ``(grid, meta)``.

    Pure composition of ``score_cells``, ``select_cells``,
    ``cell_properties``, ``build_feature``, ``build_grid_obj``, and
    ``build_metadata``. Raises ``EmptyReferenceSet`` or ``EmptyCoverage``.
    """
    scored = score_cells(stats)
    cells = select_cells(scored, to_4326=to_4326, neighborhood_of=neighborhood_of)
    features = [build_feature(c, cell_properties(c, scored)) for c in cells]
    grid = build_grid_obj(features)
    meta = build_metadata(scene, scored.reference_mean_f, cells, generated_at)
    return grid, meta


# ---- I/O --------------------------------------------------------------------


class InputError(Exception):
    """One or more input files are missing or unreadable (Requirement 7.10).

    ``problems`` holds one message per bad file, each starting with its
    repo-relative path.
    """

    def __init__(self, problems) -> None:
        self.problems = list(problems)
        super().__init__(
            "missing or unreadable input file(s):\n  " + "\n  ".join(self.problems)
        )


class PublishError(Exception):
    """Copying the work files into ``data/scores/`` failed (Requirement 11.8).

    ``filename`` names the file that failed to copy.
    """

    def __init__(self, filename: str, reason: str) -> None:
        self.filename = filename
        self.reason = reason
        super().__init__(f"cannot publish {filename}: {reason}")


def _read_work_band(path: Path) -> "Band":
    """Read band 1 of a saved work GeoTIFF in full (already windowed by the Fetcher)."""
    import rasterio

    from raster_io import Band

    with rasterio.open(path) as src:
        if src.crs is None:
            raise ValueError("raster has no CRS")
        data = src.read(1)
        nodata = src.nodata
        return Band(
            data=data,
            crs=src.crs,
            transform=src.transform,
            dtype=str(src.dtypes[0]),
            nodata=None if nodata is None else float(nodata),
        )


def load_inputs() -> tuple[
    dict[str, "Band"], "geopandas.GeoDataFrame", "geopandas.GeoDataFrame"
]:
    """Open the four band GeoTIFFs, ``boston.geojson``, and ``neighborhoods.geojson`` (7.10).

    Every file is checked before raising, so ``InputError`` lists each missing
    or unreadable path, not just the first. Nothing is written.
    """
    from raster_io import load_boundary, load_neighborhoods

    problems: list[str] = []
    bands: dict[str, Band] = {}
    for key in ASSET_KEYS:
        rel = BAND_PATHS[key]
        path = abs_path(rel)
        if not path.is_file():
            problems.append(f"{rel}: does not exist")
            continue
        try:
            bands[key] = _read_work_band(path)
        except Exception as exc:  # noqa: BLE001 - rasterio/GDAL open or read errors
            problems.append(f"{rel}: cannot be opened ({exc})")

    boundary = None
    path = abs_path(BOSTON_GEOJSON)
    if not path.is_file():
        problems.append(f"{BOSTON_GEOJSON}: does not exist")
    else:
        try:
            boundary = load_boundary(path)
            if len(boundary) == 0:
                raise ValueError("contains no features")
        except Exception as exc:  # noqa: BLE001 - unreadable or empty GeoJSON
            boundary = None
            problems.append(f"{BOSTON_GEOJSON}: cannot be opened ({exc})")

    neighborhoods = None
    path = abs_path(NEIGHBORHOODS_GEOJSON)
    if not path.is_file():
        problems.append(
            f"{NEIGHBORHOODS_GEOJSON}: does not exist (run `python3 pipeline/boston_boundary.py`)"
        )
    else:
        try:
            neighborhoods = load_neighborhoods(path)
        except Exception as exc:  # noqa: BLE001 - unreadable or empty GeoJSON
            problems.append(f"{NEIGHBORHOODS_GEOJSON}: cannot be opened ({exc})")

    if problems:
        raise InputError(problems)
    return bands, boundary, neighborhoods


def neighborhood_lookup(neighborhoods, snap_m: float = NEIGHBORHOOD_SNAP_M) -> "NeighborhoodOf":
    """``(x, y)`` in PROCESSING_CRS -> neighborhood name, from polygons with a ``name`` column.

    A point inside (or on the edge of) a polygon gets its name; if polygons
    overlap, the first name in alphabetical order wins. A point inside none
    gets the nearest polygon's name when it is within ``snap_m`` meters, so
    shoreline cells are not dropped over small boundary mismatches; otherwise
    ``None``.
    """
    import shapely

    gdf = neighborhoods.to_crs(PROCESSING_CRS).sort_values("name", kind="stable")
    names = [str(v) for v in gdf["name"]]
    tree = shapely.STRtree(list(gdf.geometry))

    def lookup(x: float, y: float) -> str | None:
        point = shapely.Point(float(x), float(y))
        hits = tree.query(point, predicate="intersects")
        if len(hits) == 0:
            hits = tree.query_nearest(point, max_distance=snap_m)
        return names[int(min(hits))] if len(hits) else None

    return lookup


def compute_cell_stats(bands: dict[str, "Band"], boundary) -> CellStats:
    """Per-cell aggregates for every Boston_Cell from aligned bands (Requirements 7.1–7.8).

    The inside-Boston mask uses pixel centers (``all_touched=False``). Pixel
    centers inside Boston are transformed from the raster CRS to
    ``PROCESSING_CRS`` with a vectorized pyproj transformer and binned into
    ``CELL_SIZE_M`` cells; no pixel values are resampled.
    """
    from pyproj import Transformer

    from raster_io import inside_mask

    qa = bands["qa_pixel"]
    inside = inside_mask(boundary, qa.crs, qa.transform, qa.data.shape)
    heat_valid, tree_valid = classify_pixels(
        inside,
        bands["lwir11"].data,
        bands["red"].data,
        bands["nir08"].data,
        qa.data,
    )

    temp_f = dn_to_fahrenheit(bands["lwir11"].data[inside])
    ndvi_vals = ndvi(
        dn_to_reflectance(bands["red"].data[inside]),
        dn_to_reflectance(bands["nir08"].data[inside]),
    )

    x, y = pixel_centers(qa.transform, qa.data.shape)
    to_proc = Transformer.from_crs(qa.crs, PROCESSING_CRS, always_xy=True)
    easting, northing = to_proc.transform(x[inside], y[inside])
    cell_e, cell_n = assign_cells(easting, northing, CELL_SIZE_M)

    return aggregate(
        cell_e,
        cell_n,
        heat_valid[inside],
        tree_valid[inside],
        temp_f,
        ndvi_vals,
        NDVI_THRESHOLD,
    )


def run_validator(grid: Path, meta: Path) -> subprocess.CompletedProcess:
    """Run the Validator on ``grid`` and ``meta`` from the repo root (Requirement 11.2).

    ``grid`` and ``meta`` are repo-relative paths. The command is
    ``<python> pipeline/validate_scores.py --grid <grid> --meta <meta>`` with
    ``cwd=REPO_ROOT``, using the interpreter running this script. Standard
    output and standard error are captured as text.
    """
    cmd = [
        sys.executable,
        Path(VALIDATOR).as_posix(),
        "--grid",
        Path(grid).as_posix(),
        "--meta",
        Path(meta).as_posix(),
    ]
    return subprocess.run(
        cmd,
        cwd=config.REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def _remove_quietly(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def publish(work_grid: Path, work_meta: Path, dest_grid: Path, dest_meta: Path) -> None:
    """Copy both work files into place so ``data/scores/`` never mixes runs (11.3, 11.7, 11.8).

    Both files are first copied to ``<dest>.tmp`` next to their targets; only
    after both copies succeed is each moved into place with ``os.replace``.
    If a copy fails, both temp files are removed, the targets are left
    unchanged, and ``PublishError`` names the file that failed.
    """
    work_grid, work_meta = Path(work_grid), Path(work_meta)
    dest_grid, dest_meta = Path(dest_grid), Path(dest_meta)
    tmp_grid = dest_grid.with_name(dest_grid.name + ".tmp")
    tmp_meta = dest_meta.with_name(dest_meta.name + ".tmp")
    temps = (tmp_grid, tmp_meta)

    for src, dest, tmp in ((work_grid, dest_grid, tmp_grid), (work_meta, dest_meta, tmp_meta)):
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, tmp)
        except OSError as exc:
            for t in temps:
                _remove_quietly(t)
            raise PublishError(dest.name, f"copy from {src} to {tmp} failed: {exc}") from exc

    for dest, tmp in ((dest_grid, tmp_grid), (dest_meta, tmp_meta)):
        try:
            os.replace(tmp, dest)
        except OSError as exc:
            for t in temps:
                _remove_quietly(t)
            raise PublishError(dest.name, f"move from {tmp} failed: {exc}") from exc


def _utc_now() -> str:
    """Current UTC time as ``YYYY-MM-DDTHH:MM:SSZ`` (Requirement 10.2)."""
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _read_scene() -> SceneInfo:
    """Read and parse the Scene_File; a missing or unreadable file is a ``SceneError``."""
    path = abs_path(SCENE_FILE)
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise SceneError(None, "missing (run `python3 pipeline/fetch_landsat.py`)") from exc
    except (OSError, UnicodeDecodeError) as exc:
        raise SceneError(None, f"cannot be read ({exc})") from exc
    return parse_scene(text)


def _summary_counts(grid: dict) -> tuple[list[tuple[str, int]], int, int]:
    """Per-neighborhood cell counts (by name) and null heat/tree score counts."""
    props = [f["properties"] for f in grid["features"]]
    names = sorted({p["neighborhood"] for p in props})
    per_area = [(name, sum(1 for p in props if p["neighborhood"] == name)) for name in names]
    null_heat = sum(1 for p in props if p["heat_score"] is None)
    null_tree = sum(1 for p in props if p["tree_score"] is None)
    return per_area, null_heat, null_tree


def _err(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)


def main() -> int:
    # 1.8: the Boston boundary must exist before anything else.
    try:
        require_boston_bbox()
    except SystemExit as exc:
        return exc.code if isinstance(exc.code, int) and exc.code != 0 else 1

    try:
        # 10.9: Scene_File.
        scene = _read_scene()
        print(f"Scene: {scene.id} ({scene.date})")

        # 7.10: every input file exists and opens.
        bands, boundary, neighborhoods = load_inputs()

        # 7.9: bands share CRS, shape, and transform.
        from raster_io import check_alignment

        mismatches = check_alignment({k: bands[k] for k in ASSET_KEYS})
        if mismatches:
            _err("input bands are not aligned:\n  " + "\n  ".join(mismatches))
            return 1

        # 7.1-7.8: pixels -> Boston cells.
        stats = compute_cell_stats(bands, boundary)
        print(f"Boston cells: {len(stats)}")

        # 8.8, 9.11: score all Boston cells, then keep the included neighborhoods.
        from pyproj import Transformer

        to_4326 = Transformer.from_crs(PROCESSING_CRS, OUTPUT_CRS, always_xy=True).transform
        grid, meta = build_outputs(
            stats, scene, _utc_now(), to_4326, neighborhood_lookup(neighborhoods)
        )
        grid_text = dumps_grid(grid)
        meta_text = dumps_meta(meta)
    except (SceneError, InputError, EmptyReferenceSet, EmptyCoverage) as exc:
        _err(str(exc))
        return 1

    # 11.1: candidate files in pipeline/work/ (1.9: create the directory).
    from raster_io import write_json_atomic

    try:
        ensure_work_dir()
        write_json_atomic(abs_path(WORK_GRID), grid_text)
        write_json_atomic(abs_path(WORK_META), meta_text)
    except OSError as exc:
        _err(f"cannot write {WORK_GRID} / {WORK_META}: {exc}")
        return 1
    print(f"Wrote {WORK_GRID} and {WORK_META} ({len(grid['features'])} cells)")

    # 11.2, 11.4: validate before touching data/scores/.
    try:
        result = run_validator(WORK_GRID, WORK_META)
    except OSError as exc:
        _err(f"cannot run {VALIDATOR}: {exc}")
        return 1
    if result.returncode != 0:
        _err(
            f"{VALIDATOR} failed with exit status {result.returncode}; "
            f"{SCORES_GRID} and {SCORES_META} were not changed. "
            f"Candidate files kept in {WORK_GRID} and {WORK_META}."
        )
        print("--- validator stdout ---", file=sys.stderr)
        print(result.stdout, end="", file=sys.stderr)
        print("--- validator stderr ---", file=sys.stderr)
        print(result.stderr, end="", file=sys.stderr)
        return 1
    print(result.stdout, end="")

    # 11.3, 11.7, 11.8: publish both files or neither.
    try:
        publish(
            abs_path(WORK_GRID),
            abs_path(WORK_META),
            abs_path(SCORES_GRID),
            abs_path(SCORES_META),
        )
    except PublishError as exc:
        _err(f"{exc}; {SCORES_GRID} and {SCORES_META} were not changed")
        return 1
    print(f"Published {SCORES_GRID} and {SCORES_META}")

    # 11.6: counts.
    per_area, null_heat, null_tree = _summary_counts(grid)
    for name, count in per_area:
        print(f"{name}: {count} cells")
    print(f"null heat_score: {null_heat} cells")
    print(f"null tree_score: {null_tree} cells")
    return 0


if __name__ == "__main__":
    sys.exit(main())
