"""Shared constants, URLs, and paths for the Landsat data pipeline.

Standard library only, so importing it is fast and works without the geo
stack. Every pipeline script imports its constants and paths from here
(Requirement 1.10). File paths are relative to the repo root; open them with
``abs_path(...)`` so scripts also work when started from another directory.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

REPO_ROOT: Path = Path(__file__).resolve().parent.parent

# --- Processing constants (Requirement 1.2) ---------------------------------
CELL_SIZE_M = 100
NDVI_THRESHOLD = 0.3
PROCESSING_CRS = "EPSG:26919"
OUTPUT_CRS = "EPSG:4326"
MIN_VALID_FRAC = 0.5
CLEAR_FRACTION_MIN = 0.95
HTTP_TIMEOUT_S = 60

# --- Default scene (Requirement 1.4) ----------------------------------------
DEFAULT_SCENE_ID = "LC09_L2SP_012031_20240625_02_T1"
DEFAULT_SCENE_DATE = "2024-06-25"
DEFAULT_SCENE_PLATFORM = "landsat-9"

# --- Demo neighborhoods (Requirement 1.3) -----------------------------------
# Ordered: (name, (minLng, minLat, maxLng, maxLat)); same names, values, and
# order as AREAS in pipeline/make_sample_data.py.
DEMO_BBOXES = (
    ("Chinatown", (-71.066, 42.346, -71.056, 42.354)),
    ("West Roxbury", (-71.170, 42.270, -71.140, 42.290)),
    ("East Boston", (-71.045, 42.365, -71.025, 42.385)),
)

# --- URLs (Requirement 1.5) -------------------------------------------------
STAC_API_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION_ID = "landsat-c2-l2"
CENSUS_ZIP_URLS = (
    "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_25_place_500k.zip",
    "https://www2.census.gov/geo/tiger/GENZ2022/shp/cb_2022_25_place_500k.zip",
)

# --- Landsat assets ---------------------------------------------------------
ASSET_KEYS = ("lwir11", "red", "nir08", "qa_pixel")
# Band names used in USGS EarthExplorer filenames, for `fetch_landsat.py --local`.
LOCAL_BAND_NAMES = {
    "lwir11": "ST_B10",
    "red": "SR_B4",
    "nir08": "SR_B5",
    "qa_pixel": "QA_PIXEL",
}

# --- Paths, relative to REPO_ROOT (Requirement 1.5) -------------------------
WORK_DIR = Path("pipeline/work")
BOSTON_GEOJSON = WORK_DIR / "boston.geojson"
SCENE_FILE = WORK_DIR / "scene.json"
BAND_PATHS = {k: WORK_DIR / f"{k}.tif" for k in ASSET_KEYS}
WORK_GRID = WORK_DIR / "demo_grid.geojson"
WORK_META = WORK_DIR / "demo_grid.meta.json"
SCORES_GRID = Path("data/scores/demo_grid.geojson")
SCORES_META = Path("data/scores/demo_grid.meta.json")
VALIDATOR = Path("pipeline/validate_scores.py")

# Padding added to each side of the Boston boundary bounds, in degrees.
BBOX_PAD_DEG = 0.005


def _iter_positions(coords):
    """Yield every [x, y, ...] position in a nested GeoJSON coordinate array."""
    if (
        isinstance(coords, (list, tuple))
        and len(coords) >= 2
        and all(isinstance(c, (int, float)) and not isinstance(c, bool) for c in coords[:2])
    ):
        yield coords
        return
    if not isinstance(coords, (list, tuple)):
        raise ValueError(f"invalid GeoJSON coordinates: {coords!r}")
    for item in coords:
        yield from _iter_positions(item)


def _iter_geometries(obj):
    """Yield every Polygon/MultiPolygon geometry in a GeoJSON object."""
    if not isinstance(obj, dict):
        return
    kind = obj.get("type")
    if kind == "FeatureCollection":
        for feature in obj.get("features") or []:
            yield from _iter_geometries(feature)
    elif kind == "Feature":
        yield from _iter_geometries(obj.get("geometry"))
    elif kind == "GeometryCollection":
        for geom in obj.get("geometries") or []:
            yield from _iter_geometries(geom)
    elif kind in ("Polygon", "MultiPolygon"):
        yield obj


def bbox_from_geojson(obj: dict, pad: float) -> list[float]:
    """Total bounds of every Polygon/MultiPolygon in ``obj``, padded on each side.

    Returns ``[minLng - pad, minLat - pad, maxLng + pad, maxLat + pad]``.
    Raises ``ValueError`` if ``obj`` contains no polygon coordinates.
    """
    min_x = min_y = math.inf
    max_x = max_y = -math.inf
    for geom in _iter_geometries(obj):
        for pos in _iter_positions(geom.get("coordinates") or []):
            x, y = float(pos[0]), float(pos[1])
            if not (math.isfinite(x) and math.isfinite(y)):
                raise ValueError(f"non-finite coordinate: {pos!r}")
            min_x, max_x = min(min_x, x), max(max_x, x)
            min_y, max_y = min(min_y, y), max(max_y, y)
    if min_x == math.inf:
        raise ValueError("GeoJSON contains no Polygon/MultiPolygon coordinates")
    return [min_x - pad, min_y - pad, max_x + pad, max_y + pad]


def load_boston_bbox(path: Path) -> list[float] | None:
    """BOSTON_BBOX from a boundary GeoJSON file.

    Returns ``None`` if the file is missing or cannot be parsed; never raises
    (Requirement 1.7).
    """
    try:
        with open(path, encoding="utf-8") as f:
            obj = json.load(f)
        return bbox_from_geojson(obj, BBOX_PAD_DEG)
    except Exception:  # noqa: BLE001 - any failure means "no usable boundary"
        return None


BOSTON_BBOX: list[float] | None = load_boston_bbox(REPO_ROOT / BOSTON_GEOJSON)


def abs_path(rel: Path) -> Path:
    """Absolute path for a repo-relative path."""
    return REPO_ROOT / rel


def ensure_work_dir() -> Path:
    """Create ``pipeline/work/`` (and parents) if missing; return its absolute path."""
    work = abs_path(WORK_DIR)
    work.mkdir(parents=True, exist_ok=True)
    return work


def require_boston_bbox() -> list[float]:
    """Return BOSTON_BBOX, or print how to create it and exit with status 1."""
    if BOSTON_BBOX is None:
        print(
            f"error: {BOSTON_GEOJSON} is missing or unreadable. "
            "Run `python3 pipeline/boston_boundary.py` first."
        )
        raise SystemExit(1)
    return BOSTON_BBOX
