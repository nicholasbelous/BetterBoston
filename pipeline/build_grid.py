"""Turn the saved Landsat bands into scored 100 m cells for the demo areas.

Run from the repo root:

    python3 pipeline/build_grid.py

Pure helpers come first and do no file or network I/O, so tests can call them
on plain numpy arrays. Importing this module runs nothing.

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
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np

from config import CELL_SIZE_M, DEMO_BBOXES, MIN_VALID_FRAC, SCENE_FILE
from scoring import percentile_rank, qa_mask

if TYPE_CHECKING:  # type hints only; keeps import light
    from collections.abc import Callable, Sequence

    from affine import Affine

    # (x, y) in EPSG:26919 -> (lng, lat) in EPSG:4326, e.g. a pyproj
    # ``Transformer.from_crs(..., always_xy=True).transform``.
    To4326 = Callable[[float, float], tuple[float, float]]
    DemoBboxes = Sequence[tuple[str, Sequence[float]]]

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
class DemoCell:
    """A Boston_Cell whose center lies in a Demo_Bbox (Requirement 9)."""

    index: int  # row in ScoredCells / CellStats
    easting: int  # lower-left, EPSG:26919
    northing: int  # lower-left, EPSG:26919
    neighborhood: str
    ring: list[list[float]]  # 5 [lng, lat] positions, rounded to 6 decimals
    bbox: list[float]  # [minLng, minLat, maxLng, maxLat] of ``ring``


class EmptyDemoAreas(Exception):
    """One or more Demo_Bboxes contain no output cell (Requirement 9.11)."""

    def __init__(self, names) -> None:
        self.names = list(names)
        super().__init__("no Boston cells in demo area(s): " + ", ".join(self.names))


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


# ---- geometry, demo selection, and cell properties (Requirement 9) ----------


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


def demo_neighborhood(lng: float, lat: float, demo_bboxes: "DemoBboxes" = DEMO_BBOXES) -> str | None:
    """Name of the first Demo_Bbox (in the given order) containing the point (9.1, 9.2).

    Bounds are inclusive. Returns ``None`` when no Demo_Bbox contains it.
    """
    for name, (min_lng, min_lat, max_lng, max_lat) in demo_bboxes:
        if min_lng <= lng <= max_lng and min_lat <= lat <= max_lat:
            return name
    return None


def select_demo_cells(
    scored: ScoredCells,
    size: int = CELL_SIZE_M,
    to_4326: "To4326 | None" = None,
    demo_bboxes: "DemoBboxes" = DEMO_BBOXES,
) -> list[DemoCell]:
    """Boston_Cells whose center lies in a Demo_Bbox, with geometry (9.1–9.5, 9.9, 9.11).

    The center is ``(e + size/2, n + size/2)`` in EPSG:26919. A cell is kept
    even if part of its polygon lies outside the Demo_Bbox. Output is sorted by
    Demo_Bbox order, then ascending northing, then ascending easting. Raises
    ``EmptyDemoAreas`` naming every Demo_Bbox (in order) with no cell.
    """
    if to_4326 is None:
        raise ValueError("select_demo_cells: to_4326 is required")
    stats = scored.stats if isinstance(scored, ScoredCells) else scored
    order = {name: k for k, (name, _) in enumerate(demo_bboxes)}
    half = int(size) / 2

    cells: list[DemoCell] = []
    for i in range(len(stats)):
        e = int(stats.easting[i])
        n = int(stats.northing[i])
        lng, lat = to_4326(e + half, n + half)
        name = demo_neighborhood(float(lng), float(lat), demo_bboxes)
        if name is None:
            continue
        ring = cell_ring(e, n, size, to_4326)
        cells.append(
            DemoCell(
                index=i,
                easting=e,
                northing=n,
                neighborhood=name,
                ring=ring,
                bbox=ring_bbox(ring),
            )
        )

    found = {c.neighborhood for c in cells}
    empty = [name for name, _ in demo_bboxes if name not in found]
    if empty:
        raise EmptyDemoAreas(empty)

    cells.sort(key=lambda c: (order[c.neighborhood], c.northing, c.easting))
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


def cell_properties(cell: DemoCell, scored: ScoredCells, i: int | None = None) -> dict:
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


def build_feature(cell: DemoCell, props: dict) -> dict:
    """GeoJSON ``Feature`` with only ``type``, ``geometry``, ``properties`` (9.9)."""
    return {
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": [cell.ring]},
        "properties": props,
    }


def build_grid_obj(features) -> dict:
    """GeoJSON ``FeatureCollection`` with only ``type`` and ``features`` (9.9)."""
    return {"type": "FeatureCollection", "features": list(features)}
