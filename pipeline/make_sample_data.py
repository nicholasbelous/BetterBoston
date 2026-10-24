#!/usr/bin/env python3
"""Generate SAMPLE score data for local development.

Writes (relative to the repo root):
  data/scores/demo_grid.geojson    -> ScoreGrid          (lib/types.ts)
  data/scores/demo_grid.meta.json  -> ScoreMetadata      (lib/types.ts)

Every value here is synthetic. Nothing is measured. The metadata and every
cell are flagged is_sample: true so the UI shows SampleDataBanner.

Standard library only. Run from anywhere:
  python3 pipeline/make_sample_data.py           (or: npm run sample:data)
  python3 pipeline/make_sample_data.py --force   (overwrite real data)
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GRID_PATH = REPO_ROOT / "data" / "scores" / "demo_grid.geojson"
META_PATH = REPO_ROOT / "data" / "scores" / "demo_grid.meta.json"

SEED = 20261024
CELL_SIZE_M = 100
# ~100 m at Boston's latitude (~42.3 N)
DLAT = 0.000899
DLNG = 0.001216
COORD_DECIMALS = 6

MIN_VALID_FRAC = 0.5  # below this a score is null
NULL_CELL_RATE = 0.05  # ~5% of cells get null scores

# name, slug, (minLng, minLat, maxLng, maxLat), profile
AREAS = [
    ("Chinatown", "chinatown", (-71.066, 42.346, -71.056, 42.354), "hot"),
    ("West Roxbury", "west-roxbury", (-71.170, 42.270, -71.140, 42.290), "green"),
    ("East Boston", "east-boston", (-71.045, 42.365, -71.025, 42.385), "mixed"),
]


def r(x: float, nd: int) -> float:
    return round(x, nd)


def build_cells(rng: random.Random) -> list[dict]:
    """Lay out square cells inside each area bbox and draw raw values."""
    cells = []
    for name, slug, (min_lng, min_lat, max_lng, max_lat), profile in AREAS:
        # floor so every cell stays inside the area bbox
        n_cols = int((max_lng - min_lng) / DLNG + 1e-9)
        n_rows = int((max_lat - min_lat) / DLAT + 1e-9)
        idx = 0
        for row in range(n_rows):
            for col in range(n_cols):
                idx += 1
                # Compute each edge from integer offsets (no accumulated drift);
                # neighbouring cells share exactly the same rounded edge.
                w = r(min_lng + col * DLNG, COORD_DECIMALS)
                e = r(min_lng + (col + 1) * DLNG, COORD_DECIMALS)
                s = r(min_lat + row * DLAT, COORD_DECIMALS)
                n = r(min_lat + (row + 1) * DLAT, COORD_DECIMALS)

                # Position within the area, 0..1, for smooth spatial patterns
                u = (col + 0.5) / n_cols  # west -> east
                v = (row + 0.5) / n_rows  # south -> north
                wave = math.sin(u * math.pi * 2.3) * math.cos(v * math.pi * 1.7)

                if profile == "hot":
                    temp = 103.0 + 2.0 * wave + rng.gauss(0, 1.2)
                    veg = 7.0 + 4.0 * wave + rng.gauss(0, 2.5)
                elif profile == "green":
                    temp = 87.0 + 2.5 * wave + rng.gauss(0, 1.5)
                    veg = 66.0 - 10.0 * wave + rng.gauss(0, 6.0)
                else:  # mixed: dense/hot to the west, greener to the east
                    temp = 99.0 - 9.0 * u + 2.0 * wave + rng.gauss(0, 1.8)
                    veg = 12.0 + 38.0 * u - 6.0 * wave + rng.gauss(0, 6.0)

                cells.append(
                    {
                        "cell_id": f"sample-{slug}-{idx:04d}",
                        "neighborhood": name,
                        "ring": [[w, s], [e, s], [e, n], [w, n], [w, s]],
                        "bbox": [w, s, e, n],
                        "temp": temp,
                        "veg": min(100.0, max(0.0, veg)),
                        "heat_valid_frac": rng.uniform(0.82, 1.0),
                        "tree_valid_frac": rng.uniform(0.88, 1.0),
                    }
                )
    return cells


def apply_nulls(cells: list[dict], rng: random.Random) -> None:
    """Drop ~5% of cells below MIN_VALID_FRAC: heat-only, tree-only, or both."""
    n_null = max(3, round(len(cells) * NULL_CELL_RATE))
    for i, cell in enumerate(rng.sample(cells, n_null)):
        kind = ("heat", "tree", "both")[i % 3]  # guarantees each case exists
        if kind in ("heat", "both"):
            cell["heat_valid_frac"] = rng.uniform(0.0, MIN_VALID_FRAC - 0.01)
        if kind in ("tree", "both"):
            cell["tree_valid_frac"] = rng.uniform(0.0, MIN_VALID_FRAC - 0.01)


def percentile_scores(values: list[float]) -> list[int]:
    """0-100 percentile rank (ties share the average rank)."""
    n = len(values)
    if n == 1:
        return [50]
    order = sorted(range(n), key=lambda i: values[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return [round(100 * rk / (n - 1)) for rk in ranks]


def build_outputs(cells: list[dict]) -> tuple[dict, dict]:
    heat_ok = [c for c in cells if c["heat_valid_frac"] >= MIN_VALID_FRAC]
    tree_ok = [c for c in cells if c["tree_valid_frac"] >= MIN_VALID_FRAC]

    for c in heat_ok:
        c["temp"] = r(c["temp"], 1)
    for c in tree_ok:
        c["veg"] = r(c["veg"], 1)

    ref_mean = sum(c["temp"] for c in heat_ok) / len(heat_ok)
    for c, s in zip(heat_ok, percentile_scores([c["temp"] for c in heat_ok])):
        c["heat_score"] = s
    for c, s in zip(tree_ok, percentile_scores([c["veg"] for c in tree_ok])):
        c["tree_score"] = s

    features = []
    for c in cells:
        heat_valid = c["heat_valid_frac"] >= MIN_VALID_FRAC
        tree_valid = c["tree_valid_frac"] >= MIN_VALID_FRAC
        # Key order mirrors ScoreCellProperties in lib/types.ts
        props = {
            "cell_id": c["cell_id"],
            "bbox": c["bbox"],
            "neighborhood": c["neighborhood"],
            "mean_surface_temp_f": c["temp"] if heat_valid else None,
            "temp_diff_f": r(c["temp"] - ref_mean, 1) if heat_valid else None,
            "pct_vegetated": c["veg"] if tree_valid else None,
            "heat_score": c["heat_score"] if heat_valid else None,
            "tree_score": c["tree_score"] if tree_valid else None,
            "heat_valid_frac": r(c["heat_valid_frac"], 3),
            "tree_valid_frac": r(c["tree_valid_frac"], 3),
            "is_sample": True,
        }
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [c["ring"]]},
                "properties": props,
            }
        )

    grid = {"type": "FeatureCollection", "features": features}

    area_bbox = [
        min(a[2][0] for a in AREAS),
        min(a[2][1] for a in AREAS),
        max(a[2][2] for a in AREAS),
        max(a[2][3] for a in AREAS),
    ]
    reference_area = "All SAMPLE cells (Chinatown, West Roxbury, East Boston)"
    metadata = {
        "schema_version": 1,
        "is_sample": True,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generated_by": "pipeline/make_sample_data.py",
        "area": {
            "name": "Boston demo areas (SAMPLE)",
            "neighborhoods": [a[0] for a in AREAS],
            "bbox": area_bbox,
        },
        "grid": {
            "cell_size_m": CELL_SIZE_M,
            "processing_crs": "EPSG:26919",
            "output_crs": "EPSG:4326",
            "cell_count": len(features),
        },
        "heat": {
            "source": "SAMPLE (synthetic, not Landsat)",
            "scene_id": "SAMPLE",
            "scene_date": "SAMPLE",
            "reference_area": reference_area,
            "reference_mean_f": r(ref_mean, 1),
            "min_valid_frac": MIN_VALID_FRAC,
        },
        "tree": {
            "source": "SAMPLE (synthetic, not MassGIS imagery)",
            "imagery_dates": "SAMPLE",
            "ndvi_threshold": 0.3,
            "leaf_off": False,
            "reference_area": reference_area,
            "min_valid_frac": MIN_VALID_FRAC,
        },
        "sources": [],
        "notes": [
            "SAMPLE DATA — not real measurements",
            f"Generated with a fixed random seed ({SEED}); values are synthetic.",
            "About 5% of cells have valid_frac below min_valid_frac and null scores, "
            "to exercise the UI's no-data handling.",
            "ndvi_threshold is a placeholder; no NDVI was computed.",
        ],
    }
    return grid, metadata


def refuse_overwrite_reason() -> str | None:
    """Return a reason not to overwrite META_PATH, or None if it's safe."""
    if not META_PATH.exists():
        return None
    try:
        existing = json.loads(META_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return f"could not read existing {META_PATH.relative_to(REPO_ROOT)} ({exc})"
    if isinstance(existing, dict) and existing.get("is_sample") is True:
        return None
    if isinstance(existing, dict) and existing.get("is_sample") is False:
        return f"{META_PATH.relative_to(REPO_ROOT)} has is_sample: false (real data)"
    return f"{META_PATH.relative_to(REPO_ROOT)} is not marked is_sample: true"


def write_json(path: Path, obj: dict, pretty: bool = False) -> None:
    """Write via a temp file + rename so a crash never leaves half a file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    if pretty:
        text = json.dumps(obj, ensure_ascii=False, indent=2)
    else:
        text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    tmp.write_text(text + "\n", encoding="utf-8")
    os.replace(tmp, path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--force",
        action="store_true",
        help="overwrite existing data even if it is not marked as sample",
    )
    args = parser.parse_args()

    reason = refuse_overwrite_reason()
    if reason and not args.force:
        print(f"Refusing to overwrite: {reason}.", file=sys.stderr)
        print("Re-run with --force if you really want to replace it.", file=sys.stderr)
        return 1

    rng = random.Random(SEED)
    cells = build_cells(rng)
    apply_nulls(cells, rng)
    grid, metadata = build_outputs(cells)

    write_json(GRID_PATH, grid)
    write_json(META_PATH, metadata, pretty=True)  # small; humans read it

    props = [f["properties"] for f in grid["features"]]
    by_area = {a[0]: sum(p["neighborhood"] == a[0] for p in props) for a in AREAS}
    heat_null = sum(p["heat_score"] is None for p in props)
    tree_null = sum(p["tree_score"] is None for p in props)
    both_null = sum(p["heat_score"] is None and p["tree_score"] is None for p in props)
    print(f"Wrote {GRID_PATH.relative_to(REPO_ROOT)} ({len(props)} SAMPLE cells)")
    print(f"Wrote {META_PATH.relative_to(REPO_ROOT)}")
    print("  cells: " + ", ".join(f"{k} {v}" for k, v in by_area.items()))
    print(
        f"  null scores: heat {heat_null}, tree {tree_null}, both {both_null}; "
        f"reference mean {metadata['heat']['reference_mean_f']}°F"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
