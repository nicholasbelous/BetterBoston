"""Tests for ``pipeline/build_grid.py``.

Property tests use hypothesis with the shared "pipeline" profile from
``conftest.py`` (100 examples, no deadline). Each property test is tagged
with its design-document property number. All tests run offline.
"""

import datetime
import json

import numpy as np
from hypothesis import given
from hypothesis import strategies as st
from pyproj import Transformer

import build_grid
import validate_scores
from build_grid import CellStats, SceneInfo
from config import CELL_SIZE_M, EXCLUDED_NEIGHBORHOODS

# ---------------------------------------------------------------------------
# Shared geometry helpers
# ---------------------------------------------------------------------------

# Offline EPSG:26919 <-> EPSG:4326 transforms (pyproj ships its own database).
_TO_4326 = Transformer.from_crs("EPSG:26919", "EPSG:4326", always_xy=True).transform
_TO_26919 = Transformer.from_crs("EPSG:4326", "EPSG:26919", always_xy=True).transform


def _cells_with_center_in(bbox, size=CELL_SIZE_M):
    """Lower-left corners of every cell whose center lies in a lng/lat bbox."""
    min_lng, min_lat, max_lng, max_lat = bbox
    corners = [
        _TO_26919(lng, lat)
        for lng in (min_lng, max_lng)
        for lat in (min_lat, max_lat)
    ]
    e0 = int(min(x for x, _ in corners) // size) * size - size
    e1 = int(max(x for x, _ in corners) // size) * size + size
    n0 = int(min(y for _, y in corners) // size) * size - size
    n1 = int(max(y for _, y in corners) // size) * size + size
    half = size / 2
    out = []
    for e in range(e0, e1 + 1, size):
        for n in range(n0, n1 + 1, size):
            lng, lat = _TO_4326(e + half, n + half)
            if min_lng <= lng <= max_lng and min_lat <= lat <= max_lat:
                out.append((e, n))
    return out


# Stand-in neighborhoods (lng/lat boxes) for the builder's ``neighborhood_of``.
# West Roxbury is in config.EXCLUDED_NEIGHBORHOODS, so its cells are never written.
_TEST_AREAS = (
    ("Chinatown", (-71.066, 42.346, -71.056, 42.354)),
    ("West Roxbury", (-71.170, 42.270, -71.140, 42.290)),
    ("East Boston", (-71.045, 42.365, -71.025, 42.385)),
)


def _neighborhood_of(x, y):
    """Name of the first test box containing the EPSG:26919 point, or None."""
    lng, lat = _TO_4326(x, y)
    for name, (min_lng, min_lat, max_lng, max_lat) in _TEST_AREAS:
        if min_lng <= lng <= max_lng and min_lat <= lat <= max_lat:
            return name
    return None


# Candidate cells per test neighborhood, in _TEST_AREAS order.
_AREA_CELLS = [_cells_with_center_in(b) for _, b in _TEST_AREAS]

# Boston cells in no test neighborhood (inside the validator's Boston envelope),
# so scoring ranks over more cells than are written out.
_OTHER_CELLS = [
    c
    for c in _cells_with_center_in((-71.12, 42.30, -71.08, 42.33))
    if _neighborhood_of(c[0] + 50, c[1] + 50) is None
]


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------


@st.composite
def cell_stats(draw):
    """``CellStats`` covering every test neighborhood, with both reference sets nonempty.

    Counts satisfy ``1 <= n_inside``, ``n_tree <= n_heat <= n_inside``; means
    are NaN exactly where their count is 0. Small even ``n_inside`` values
    make fractions exactly 0.5 common.
    """
    keys = set()
    for candidates in _AREA_CELLS:
        keys.update(
            draw(st.lists(st.sampled_from(candidates), min_size=1, max_size=4, unique=True))
        )
    keys.update(draw(st.lists(st.sampled_from(_OTHER_CELLS), max_size=6, unique=True)))
    keys = sorted(keys)
    k = len(keys)

    # One cell is fully valid so neither reference set is empty.
    full = draw(st.integers(min_value=0, max_value=k - 1))

    n_inside, n_heat, n_tree, mean_temp, pct_veg = [], [], [], [], []
    for i in range(k):
        ni = draw(st.integers(min_value=1, max_value=12))
        if i == full:
            nh = nt = ni
        else:
            nh = draw(st.integers(min_value=0, max_value=ni))
            nt = draw(st.integers(min_value=0, max_value=nh))
        temp = (
            draw(st.floats(min_value=40.0, max_value=140.0, allow_nan=False))
            if nh > 0
            else np.nan
        )
        veg = 100.0 * draw(st.integers(min_value=0, max_value=nt)) / nt if nt > 0 else np.nan
        n_inside.append(ni)
        n_heat.append(nh)
        n_tree.append(nt)
        mean_temp.append(temp)
        pct_veg.append(veg)

    n_inside_a = np.array(n_inside, dtype=np.int64)
    n_heat_a = np.array(n_heat, dtype=np.int64)
    n_tree_a = np.array(n_tree, dtype=np.int64)
    return CellStats(
        easting=np.array([e for e, _ in keys], dtype=np.int64),
        northing=np.array([n for _, n in keys], dtype=np.int64),
        n_inside=n_inside_a,
        n_heat=n_heat_a,
        n_tree=n_tree_a,
        mean_temp=np.array(mean_temp, dtype=np.float64),
        pct_veg=np.array(pct_veg, dtype=np.float64),
        heat_frac=n_heat_a / n_inside_a,
        tree_frac=n_tree_a / n_inside_a,
    )


@st.composite
def scene_infos(draw):
    """Any valid ``SceneInfo``: non-empty id, real calendar date."""
    scene_id = draw(st.text(min_size=1, max_size=40))
    date = draw(st.dates()).isoformat()  # always zero-padded YYYY-MM-DD
    platform = draw(st.one_of(st.none(), st.sampled_from(["landsat-8", "landsat-9"])))
    return SceneInfo(id=scene_id, date=date, platform=platform)


generated_ats = st.datetimes(
    min_value=datetime.datetime(2000, 1, 1), max_value=datetime.datetime(2100, 1, 1)
).map(lambda d: d.strftime("%Y-%m-%dT%H:%M:%SZ"))


# ---------------------------------------------------------------------------
# Property 29: validator compatibility
# ---------------------------------------------------------------------------


def test_generators_cover_area_and_other_cells():
    """Sanity check for the Property 29 generator inputs."""
    assert all(_AREA_CELLS), "every test neighborhood needs candidate cells"
    assert _OTHER_CELLS


# Feature: landsat-data-pipeline, Property 29: Builder output passes the existing validator
@given(stats=cell_stats(), scene=scene_infos(), generated_at=generated_ats)
def test_builder_output_passes_validator(stats, scene, generated_at):
    """**Validates: Requirements 9.10, 10.4, 11.5**"""
    grid, meta = build_grid.build_outputs(stats, scene, generated_at, _TO_4326, _neighborhood_of)

    # Validate what would be written to disk, parsed back as the validator does.
    grid = json.loads(build_grid.dumps_grid(grid))
    meta = json.loads(build_grid.dumps_meta(meta))

    errors = validate_scores.Errors()
    validate_scores.validate_metadata(meta, errors)
    n_features, _, _ = validate_scores.validate_grid(grid, meta, errors)

    assert errors.items == []
    assert n_features == len(grid["features"])
    assert meta["grid"]["cell_count"] == len(grid["features"])
    # Exactly the cells in included neighborhoods are written out.
    kept = [
        name
        for name in (
            _neighborhood_of(int(e) + 50, int(n) + 50)
            for e, n in zip(stats.easting, stats.northing)
        )
        if name is not None and name not in EXCLUDED_NEIGHBORHOODS
    ]
    names = {f["properties"]["neighborhood"] for f in grid["features"]}
    assert len(grid["features"]) == len(kept)
    assert names == {name for name, _ in _TEST_AREAS if name not in EXCLUDED_NEIGHBORHOODS}
    assert meta["area"]["neighborhoods"] == sorted(names)
