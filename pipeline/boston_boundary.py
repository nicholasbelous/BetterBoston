"""Download the Census place file and save the City of Boston boundary.

Run from the repo root:

    python3 pipeline/boston_boundary.py

Downloads the Massachusetts 1:500k cartographic boundary place file (GENZ2023,
falling back to GENZ2022 only when GENZ2023 returns HTTP 404), keeps every
feature with ``NAME == "Boston"``, reprojects to EPSG:4326, and saves it to
``pipeline/work/boston.geojson`` (Requirement 3). Then saves the BPDA
neighborhood boundaries to ``pipeline/work/neighborhoods.geojson``.

Exit status: 0 when the boundary is saved, 1 on a download failure, an
unreadable zip, or no Boston feature. On any failure the existing
``boston.geojson`` (if any) is left unchanged.
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Sequence

from config import (
    BOSTON_GEOJSON,
    CENSUS_ZIP_URLS,
    HTTP_TIMEOUT_S,
    NEIGHBORHOODS_GEOJSON,
    NEIGHBORHOODS_URL,
    OUTPUT_CRS,
    abs_path,
    ensure_work_dir,
)
from raster_io import load_neighborhoods, write_json_atomic

BOSTON_NAME = "Boston"
_CHUNK = 1 << 16


class DownloadError(Exception):
    """A download failed. ``status`` is the HTTP code, or None for other errors."""

    def __init__(self, url: str, reason: str, status: int | None = None):
        super().__init__(f"{url}: {reason}")
        self.url = url
        self.reason = reason
        self.status = status


def download(url: str, dest: Path, timeout: int = HTTP_TIMEOUT_S) -> None:
    """Download ``url`` to ``dest`` via a temp file.

    ``dest`` only appears once the whole body has been read. Any failure
    (HTTP error, connection error, timeout, write error) raises
    ``DownloadError`` and removes the temp file.
    """
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp, open(tmp, "wb") as f:
            while True:
                chunk = resp.read(_CHUNK)
                if not chunk:
                    break
                f.write(chunk)
        os.replace(tmp, dest)
    except urllib.error.HTTPError as exc:
        _remove(tmp)
        raise DownloadError(url, f"HTTP {exc.code} {exc.reason}", status=exc.code) from exc
    except urllib.error.URLError as exc:
        _remove(tmp)
        raise DownloadError(url, f"connection failed: {exc.reason}") from exc
    except TimeoutError as exc:  # socket.timeout is an alias of TimeoutError
        _remove(tmp)
        raise DownloadError(url, f"timed out after {timeout} s") from exc
    except OSError as exc:
        _remove(tmp)
        raise DownloadError(url, str(exc) or exc.__class__.__name__) from exc


def _remove(path: Path) -> None:
    try:
        Path(path).unlink()
    except FileNotFoundError:
        pass


def download_with_fallback(
    urls: Sequence[str], work_dir: Path, timeout: int = HTTP_TIMEOUT_S
) -> tuple[str, Path]:
    """Download the first URL; fall back to the second only on HTTP 404.

    Returns ``(url_used, zip_path)``. Any other error from the first URL, or
    any error from the fallback, raises ``DownloadError`` naming that URL.
    """
    primary, fallback = urls[0], urls[1]
    work_dir = Path(work_dir)
    try:
        dest = work_dir / primary.rsplit("/", 1)[-1]
        download(primary, dest, timeout)
        return primary, dest
    except DownloadError as exc:
        if exc.status != 404:
            raise
        print(f"{primary} returned HTTP 404; trying {fallback}")
    dest = work_dir / fallback.rsplit("/", 1)[-1]
    download(fallback, dest, timeout)
    return fallback, dest


def select_boston(gdf):
    """Every feature whose ``NAME`` is exactly "Boston" (case-sensitive).

    Returns an empty frame when there is no match or no ``NAME`` column.
    """
    if "NAME" not in gdf.columns:
        return gdf.iloc[0:0]
    return gdf[gdf["NAME"] == BOSTON_NAME]


def main() -> int:
    work_dir = ensure_work_dir()

    try:
        url, zip_path = download_with_fallback(CENSUS_ZIP_URLS, work_dir, HTTP_TIMEOUT_S)
    except DownloadError as exc:
        print(f"error: download failed for {exc.url}: {exc.reason}", file=sys.stderr)
        return 1

    try:
        import geopandas

        gdf = geopandas.read_file(f"zip://{zip_path}")
    except Exception as exc:  # noqa: BLE001 - any read failure means "not a shapefile"
        print(
            f"error: cannot open {zip_path} (from {url}) as a shapefile: {exc}",
            file=sys.stderr,
        )
        return 1

    boston = select_boston(gdf)
    if boston.empty:
        print(
            f'error: no feature has NAME == "{BOSTON_NAME}" in {zip_path} (from {url})',
            file=sys.stderr,
        )
        return 1

    if boston.crs is None:
        print(
            f"error: cannot open {zip_path} (from {url}) as a shapefile: "
            "it has no coordinate reference system",
            file=sys.stderr,
        )
        return 1

    boston = boston.to_crs(OUTPUT_CRS)
    out = abs_path(BOSTON_GEOJSON)
    write_json_atomic(out, boston.to_json())
    print(f"Source: {url}")
    print(f"Saved {len(boston)} feature(s) to {BOSTON_GEOJSON}")

    # Neighborhood names decide which cells build_grid.py writes out
    # (config.EXCLUDED_NEIGHBORHOODS) and label each cell.
    dest = abs_path(NEIGHBORHOODS_GEOJSON)
    try:
        download(NEIGHBORHOODS_URL, dest, HTTP_TIMEOUT_S)
        hoods = load_neighborhoods(dest)
    except DownloadError as exc:
        print(f"error: download failed for {exc.url}: {exc.reason}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001 - an ArcGIS error body is still HTTP 200
        _remove(dest)
        print(f"error: {NEIGHBORHOODS_URL} did not return usable polygons: {exc}", file=sys.stderr)
        return 1
    print(f"Saved {len(hoods)} neighborhoods to {NEIGHBORHOODS_GEOJSON}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
