#!/usr/bin/env python3
"""Validate data/scores/demo_grid.geojson + demo_grid.meta.json.

Checks the files against the schema in lib/types.ts (ScoreGrid,
ScoreCellProperties, ScoreMetadata) plus geometry and consistency rules.
Prints every problem and exits 1 on failure; prints one summary line and
exits 0 on success.

Standard library only:
  python3 pipeline/validate_scores.py            (or: npm run validate:data)
  python3 pipeline/validate_scores.py --grid X.geojson --meta X.meta.json
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_GRID = REPO_ROOT / "data" / "scores" / "demo_grid.geojson"
DEFAULT_META = REPO_ROOT / "data" / "scores" / "demo_grid.meta.json"

# ---------------------------------------------------------------------------
# Schema constants. These MIRROR lib/types.ts — keep them in sync.
# If you change ScoreCellProperties or ScoreMetadata there, change them here
# (and in pipeline/make_sample_data.py / pipeline/build_grid.py).
# ---------------------------------------------------------------------------

# Type tags used below
NUM = "number"
NUM_OR_NULL = "number|null"
STR = "string"
BOOL = "boolean"
BBOX = "bbox"
STR_LIST = "string[]"
SOURCE_LIST = "SourceRef[]"

# ScoreCellProperties (lib/types.ts)
CELL_PROPERTIES = {
    "cell_id": STR,
    "bbox": BBOX,
    "neighborhood": STR,
    "mean_surface_temp_f": NUM_OR_NULL,
    "temp_diff_f": NUM_OR_NULL,
    "pct_vegetated": NUM_OR_NULL,
    "heat_score": NUM_OR_NULL,
    "tree_score": NUM_OR_NULL,
    "heat_valid_frac": NUM,
    "tree_valid_frac": NUM,
    "is_sample": BOOL,
}
PERCENT_FIELDS = ("pct_vegetated", "heat_score", "tree_score")  # 0-100 or null
FRACTION_FIELDS = ("heat_valid_frac", "tree_valid_frac")  # 0-1, never null

# ScoreMetadata (lib/types.ts). Nested dicts are sub-objects.
METADATA_FIELDS = {
    "schema_version": NUM,
    "is_sample": BOOL,
    "generated_at": STR,
    "generated_by": STR,
    "area": {
        "name": STR,
        "neighborhoods": STR_LIST,
        "bbox": BBOX,
    },
    "grid": {
        "cell_size_m": NUM,
        "processing_crs": STR,
        "output_crs": STR,
        "cell_count": NUM,
    },
    "heat": {
        "source": STR,
        "scene_id": STR,
        "scene_date": STR,
        "reference_area": STR,
        "reference_mean_f": NUM_OR_NULL,
        "min_valid_frac": NUM,
    },
    "tree": {
        "source": STR,
        "imagery_dates": STR,
        "ndvi_threshold": NUM,
        "leaf_off": BOOL,
        "reference_area": STR,
        "min_valid_frac": NUM,
    },
    "sources": SOURCE_LIST,
    "notes": STR_LIST,
}
SCHEMA_VERSION = 1
OUTPUT_CRS = "EPSG:4326"

# Coverage envelope for Boston (lng/lat, EPSG:4326)
LNG_MIN, LNG_MAX = -71.20, -70.98
LAT_MIN, LAT_MAX = 42.22, 42.41

BBOX_TOLERANCE = 1e-9
MAX_ERRORS_SHOWN = 50


# ---------------------------------------------------------------------------
# Type helpers
# ---------------------------------------------------------------------------


def is_number(v) -> bool:
    # bool is a subclass of int in Python; JSON true/false are not numbers.
    # json.load accepts NaN/Infinity, which are not valid JSON numbers.
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def is_bbox(v) -> bool:
    return (
        isinstance(v, list)
        and len(v) == 4
        and all(is_number(x) for x in v)
        and v[0] <= v[2]
        and v[1] <= v[3]
    )


def check_type(value, tag: str) -> bool:
    if tag == NUM:
        return is_number(value)
    if tag == NUM_OR_NULL:
        return value is None or is_number(value)
    if tag == STR:
        return isinstance(value, str)
    if tag == BOOL:
        return isinstance(value, bool)
    if tag == BBOX:
        return is_bbox(value)
    if tag == STR_LIST:
        return isinstance(value, list) and all(isinstance(x, str) for x in value)
    if tag == SOURCE_LIST:
        return isinstance(value, list) and all(
            isinstance(x, dict)
            and isinstance(x.get("name"), str)
            and isinstance(x.get("url"), str)
            for x in value
        )
    raise ValueError(f"unknown type tag {tag}")


def describe(value) -> str:
    text = json.dumps(value)
    return text if len(text) <= 60 else text[:57] + "..."


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class Errors:
    def __init__(self) -> None:
        self.items: list[str] = []

    def add(self, where: str, msg: str) -> None:
        self.items.append(f"{where}: {msg}")

    def __bool__(self) -> bool:
        return bool(self.items)


def validate_fields(obj, spec: dict, where: str, errors: Errors) -> None:
    """Check required keys, types, and no unknown keys against a spec dict."""
    if not isinstance(obj, dict):
        errors.add(where, f"expected an object, got {describe(obj)}")
        return
    for key, tag in spec.items():
        path = f"{where}.{key}"
        if key not in obj:
            errors.add(path, "missing")
        elif isinstance(tag, dict):
            validate_fields(obj[key], tag, path, errors)
        elif not check_type(obj[key], tag):
            errors.add(path, f"expected {tag}, got {describe(obj[key])}")
    for key in obj:
        if key not in spec:
            errors.add(f"{where}.{key}", "unknown field (not in lib/types.ts)")


def validate_metadata(meta, errors: Errors) -> None:
    validate_fields(meta, METADATA_FIELDS, "meta", errors)
    if not isinstance(meta, dict):
        return
    if meta.get("schema_version") != SCHEMA_VERSION:
        errors.add("meta.schema_version", f"expected {SCHEMA_VERSION}, got {describe(meta.get('schema_version'))}")
    grid = meta.get("grid")
    if isinstance(grid, dict) and grid.get("output_crs") != OUTPUT_CRS:
        errors.add("meta.grid.output_crs", f"expected {OUTPUT_CRS!r}, got {describe(grid.get('output_crs'))}")
    for section in ("heat", "tree"):
        sec = meta.get(section)
        if isinstance(sec, dict) and is_number(sec.get("min_valid_frac")):
            if not 0 <= sec["min_valid_frac"] <= 1:
                errors.add(f"meta.{section}.min_valid_frac", f"must be 0-1, got {sec['min_valid_frac']}")


def validate_geometry(geom, bbox, where: str, errors: Errors) -> None:
    if not isinstance(geom, dict):
        errors.add(f"{where}.geometry", "missing or not an object")
        return
    if geom.get("type") != "Polygon":
        errors.add(f"{where}.geometry.type", f"expected 'Polygon', got {describe(geom.get('type'))}")
        return
    rings = geom.get("coordinates")
    if not isinstance(rings, list) or not rings:
        errors.add(f"{where}.geometry.coordinates", "must be a non-empty list of rings")
        return

    lngs: list[float] = []
    lats: list[float] = []
    for ri, ring in enumerate(rings):
        rwhere = f"{where}.geometry.coordinates[{ri}]"
        if not isinstance(ring, list) or len(ring) < 4:
            errors.add(rwhere, "ring needs at least 4 positions")
            continue
        ring_ok = True
        for pi, pos in enumerate(ring):
            if not (isinstance(pos, list) and len(pos) >= 2 and is_number(pos[0]) and is_number(pos[1])):
                errors.add(f"{rwhere}[{pi}]", f"invalid position {describe(pos)}")
                ring_ok = False
                continue
            lng, lat = pos[0], pos[1]
            if not (LNG_MIN <= lng <= LNG_MAX and LAT_MIN <= lat <= LAT_MAX):
                errors.add(
                    f"{rwhere}[{pi}]",
                    f"({lng}, {lat}) outside Boston bounds "
                    f"lng {LNG_MIN}..{LNG_MAX}, lat {LAT_MIN}..{LAT_MAX}",
                )
            if ri == 0:
                lngs.append(lng)
                lats.append(lat)
        if ring_ok and ring[0][:2] != ring[-1][:2]:
            errors.add(rwhere, f"ring not closed: first {ring[0]} != last {ring[-1]}")

    if lngs and is_bbox(bbox):
        actual = [min(lngs), min(lats), max(lngs), max(lats)]
        if any(abs(a - b) > BBOX_TOLERANCE for a, b in zip(actual, bbox)):
            errors.add(f"{where}.properties.bbox", f"{bbox} does not match polygon extent {actual}")


def validate_grid(grid, meta, errors: Errors) -> tuple[int, int, int]:
    """Returns (feature_count, null_heat_count, null_tree_count)."""
    if not isinstance(grid, dict):
        errors.add("grid", "top level must be an object")
        return 0, 0, 0
    if grid.get("type") != "FeatureCollection":
        errors.add("grid.type", f"expected 'FeatureCollection', got {describe(grid.get('type'))}")
    features = grid.get("features")
    if not isinstance(features, list):
        errors.add("grid.features", "must be a list")
        return 0, 0, 0
    if not features:
        errors.add("grid.features", "is empty")

    meta_is_sample = meta.get("is_sample") if isinstance(meta, dict) else None
    seen_ids: dict[str, int] = {}
    null_heat = null_tree = 0

    for i, feat in enumerate(features):
        where = f"features[{i}]"
        if not isinstance(feat, dict):
            errors.add(where, "not an object")
            continue
        if feat.get("type") != "Feature":
            errors.add(f"{where}.type", f"expected 'Feature', got {describe(feat.get('type'))}")

        props = feat.get("properties")
        if isinstance(props, dict) and isinstance(props.get("cell_id"), str):
            where = f"features[{i}] ({props['cell_id']})"
        validate_fields(props, CELL_PROPERTIES, f"{where}.properties", errors)
        if not isinstance(props, dict):
            continue

        cid = props.get("cell_id")
        if isinstance(cid, str):
            if not cid:
                errors.add(f"{where}.properties.cell_id", "empty string")
            elif cid in seen_ids:
                errors.add(f"{where}.properties.cell_id", f"duplicate of features[{seen_ids[cid]}]")
            else:
                seen_ids[cid] = i

        for key in PERCENT_FIELDS:
            v = props.get(key)
            if is_number(v) and not 0 <= v <= 100:
                errors.add(f"{where}.properties.{key}", f"must be 0-100 or null, got {v}")
        for key in FRACTION_FIELDS:
            v = props.get(key)
            if is_number(v) and not 0 <= v <= 1:
                errors.add(f"{where}.properties.{key}", f"must be 0-1, got {v}")

        if isinstance(props.get("is_sample"), bool) and isinstance(meta_is_sample, bool):
            if props["is_sample"] != meta_is_sample:
                errors.add(
                    f"{where}.properties.is_sample",
                    f"{describe(props['is_sample'])} but metadata.is_sample is {describe(meta_is_sample)}",
                )

        null_heat += props.get("heat_score", 0) is None
        null_tree += props.get("tree_score", 0) is None
        validate_geometry(feat.get("geometry"), props.get("bbox"), where, errors)

    cell_count = meta.get("grid", {}).get("cell_count") if isinstance(meta, dict) and isinstance(meta.get("grid"), dict) else None
    if is_number(cell_count) and cell_count != len(features):
        errors.add("meta.grid.cell_count", f"is {cell_count} but grid has {len(features)} features")

    return len(features), null_heat, null_tree


def load_json(path: Path, label: str, errors: Errors):
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        errors.add(label, f"file not found: {path} (run: npm run sample:data)")
    except (OSError, ValueError) as exc:
        errors.add(label, f"could not parse {path}: {exc}")
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate score grid + metadata against lib/types.ts")
    parser.add_argument("--grid", type=Path, default=DEFAULT_GRID)
    parser.add_argument("--meta", type=Path, default=DEFAULT_META)
    args = parser.parse_args()

    errors = Errors()
    meta = load_json(args.meta, "meta", errors)
    grid = load_json(args.grid, "grid", errors)

    n = null_heat = null_tree = 0
    if meta is not None:
        validate_metadata(meta, errors)
    if grid is not None:
        n, null_heat, null_tree = validate_grid(grid, meta, errors)

    if errors:
        shown = errors.items[:MAX_ERRORS_SHOWN]
        print(f"FAIL: {len(errors.items)} problem(s) in score data", file=sys.stderr)
        for e in shown:
            print(f"  - {e}", file=sys.stderr)
        if len(errors.items) > len(shown):
            print(f"  ... and {len(errors.items) - len(shown)} more", file=sys.stderr)
        return 1

    label = "SAMPLE" if meta.get("is_sample") else "REAL"
    print(
        f"OK: {n} cells valid ({label} data, schema v{meta['schema_version']}); "
        f"null heat_score {null_heat}, null tree_score {null_tree}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
