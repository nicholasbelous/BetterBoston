"""Save a window around Boston from the four bands of the chosen Landsat scene.

Run from the repo root:

    python3 pipeline/fetch_landsat.py              # read from the STAC API
    python3 pipeline/fetch_landsat.py --local DIR  # read EarthExplorer GeoTIFFs

The scene ID comes from ``pipeline/work/scene.json`` when it exists, otherwise
from ``DEFAULT_SCENE_ID``. The four bands (``lwir11``, ``red``, ``nir08``,
``qa_pixel``) are read over BOSTON_BBOX with Window_Read, checked for
alignment, and saved unchanged as single-band GeoTIFFs in ``pipeline/work/``.
The Clear_Fraction over the Boston boundary is printed, with a warning when it
is below ``CLEAR_FRACTION_MIN`` (Requirement 6).

Every check runs before anything is written. On an error the script exits 1
and leaves ``pipeline/work/`` and the Scene_File as they were. An existing
Scene_File is never opened for writing; the default one is written only when
it is absent, after all four bands are saved.

Exit status: 0 when the four bands are saved (even with a low Clear_Fraction),
1 on any error.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from pathlib import Path
from typing import Iterable, Sequence

from config import (
    ASSET_KEYS,
    BAND_PATHS,
    BOSTON_GEOJSON,
    CLEAR_FRACTION_MIN,
    COLLECTION_ID,
    DEFAULT_SCENE_DATE,
    DEFAULT_SCENE_ID,
    DEFAULT_SCENE_PLATFORM,
    LOCAL_BAND_NAMES,
    SCENE_FILE,
    abs_path,
    ensure_work_dir,
    require_boston_bbox,
)
from raster_io import (
    Band,
    WindowError,
    check_alignment,
    inside_mask,
    load_boundary,
    open_band,
    open_stac,
    write_band,
    write_json_atomic,
)
from scoring import clear_fraction

LOCAL_EXTENSIONS = (".tif", ".TIF")
FIND_SCENE_CMD = "python3 pipeline/find_scene.py"


class FetchError(Exception):
    """An input is missing or invalid; the message names the item, band, or key."""


# ---- pure helpers -----------------------------------------------------------


def read_scene_id(scene_file: Path) -> tuple[str, bool]:
    """Scene ID from ``scene_file`` and whether the file existed.

    A missing file gives ``(DEFAULT_SCENE_ID, False)``. A file that cannot be
    read, is not valid JSON, is not a JSON object, or has no non-empty string
    ``"id"`` raises ``FetchError`` naming the file and the problem
    (Requirements 6.1, 6.9). The ID is returned unchanged.
    """
    scene_file = Path(scene_file)
    try:
        with open(scene_file, encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        return DEFAULT_SCENE_ID, False
    except (OSError, UnicodeDecodeError) as exc:
        raise FetchError(f"{scene_file}: cannot read Scene_File: {exc}") from exc

    try:
        obj = json.loads(text)
    except ValueError as exc:
        raise FetchError(f"{scene_file}: Scene_File is not valid JSON: {exc}") from exc
    if not isinstance(obj, dict):
        raise FetchError(
            f"{scene_file}: Scene_File must be a JSON object, got {type(obj).__name__}"
        )
    if "id" not in obj:
        raise FetchError(f'{scene_file}: Scene_File has no "id" key')
    scene_id = obj["id"]
    if not isinstance(scene_id, str):
        raise FetchError(
            f'{scene_file}: Scene_File "id" must be a string, got {type(scene_id).__name__}'
        )
    if not scene_id:
        raise FetchError(f'{scene_file}: Scene_File "id" is empty')
    return scene_id, True


def _has_token(name: str, token: str) -> bool:
    """True when ``token`` appears in ``name`` as a whole token (case-insensitive).

    A token boundary is any character that is not an ASCII letter or digit,
    so ``SR_B4`` matches ``..._SR_B4.TIF`` but not ``..._SR_B45.TIF``.
    """
    pattern = rf"(?<![A-Z0-9]){re.escape(token.upper())}(?![A-Z0-9])"
    return re.search(pattern, name.upper()) is not None


def match_local_bands(filenames: Iterable[str]) -> dict[str, str]:
    """Map each Asset_Key to the single ``.tif``/``.TIF`` file holding its band.

    A file holds a band when its name contains the band's EarthExplorer token
    (``LOCAL_BAND_NAMES``: ``ST_B10``, ``SR_B4``, ``SR_B5``, ``QA_PIXEL``) as a
    whole token. Raises ``FetchError`` naming every band with no matching file
    ("missing") or with more than one ("ambiguous", listing the files)
    (Requirements 6.4, 6.9).
    """
    tifs = sorted({n for n in filenames if n.endswith(LOCAL_EXTENSIONS)})
    matches: dict[str, str] = {}
    problems: list[str] = []
    for key in ASSET_KEYS:
        token = LOCAL_BAND_NAMES[key]
        found = [n for n in tifs if _has_token(n, token)]
        if not found:
            problems.append(
                f"band {token} ({key}): missing; no .tif/.TIF file has {token} in its name"
            )
        elif len(found) > 1:
            problems.append(f"band {token} ({key}): ambiguous: {', '.join(found)}")
        else:
            matches[key] = found[0]
    if problems:
        raise FetchError("--local band files: " + "; ".join(problems))
    return matches


def default_scene_json() -> str:
    """Default Scene_File text: only ``id``, ``date``, ``platform`` (Requirement 6.7)."""
    obj = {
        "id": DEFAULT_SCENE_ID,
        "date": DEFAULT_SCENE_DATE,
        "platform": DEFAULT_SCENE_PLATFORM,
    }
    return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"


# ---- I/O --------------------------------------------------------------------


def _read_band(label: str, source: str, bbox: Sequence[float]) -> Band:
    """``open_band`` with errors turned into ``FetchError`` naming ``label``."""
    try:
        return open_band(source, bbox)
    except WindowError as exc:
        raise FetchError(
            f"band {label}: BOSTON_BBOX window is outside the raster or empty: {exc}"
        ) from exc
    except Exception as exc:  # noqa: BLE001 - rasterio/GDAL open or read errors
        raise FetchError(f"band {label}: cannot read raster: {exc}") from exc


def fetch_stac_bands(scene_id: str, bbox: Sequence[float]) -> dict[str, Band]:
    """Re-open item ``scene_id`` on the STAC API and Window_Read the four assets.

    Asset hrefs are freshly signed by ``open_stac``. Raises ``FetchError``
    naming the item ID when the API cannot be reached or has no such item
    (6.12), naming the asset keys the item lacks (6.9), or naming the band
    whose window read fails (6.13). Nothing is written.
    """
    try:
        client = open_stac()
        search = client.search(collections=[COLLECTION_ID], ids=[scene_id])
        items = [it for it in search.items() if it.id == scene_id]
    except Exception as exc:  # noqa: BLE001 - connection, HTTP, timeout, import
        raise FetchError(
            f"STAC API request for item {scene_id} in {COLLECTION_ID} failed: {exc}"
        ) from exc
    if not items:
        raise FetchError(f"collection {COLLECTION_ID} has no item with ID {scene_id}")

    item = items[0]
    missing = [k for k in ASSET_KEYS if k not in item.assets]
    if missing:
        raise FetchError(f"item {scene_id} is missing asset key(s): {', '.join(missing)}")

    bands: dict[str, Band] = {}
    for key in ASSET_KEYS:
        bands[key] = _read_band(f"{key} (item {scene_id})", item.assets[key].href, bbox)
    return bands


def fetch_local_bands(directory: Path, bbox: Sequence[float]) -> dict[str, Band]:
    """Window_Read the four EarthExplorer GeoTIFFs in ``directory``.

    Files are identified only by the band token in their names
    (``match_local_bands``). No STAC request is made. Raises ``FetchError``
    when the directory cannot be listed, a band is missing or ambiguous, or a
    band's window read fails (naming the band). Nothing is written.
    """
    directory = Path(directory)
    try:
        names = os.listdir(directory)
    except OSError as exc:
        raise FetchError(f"--local {directory}: cannot list directory: {exc}") from exc
    files = match_local_bands(names)

    bands: dict[str, Band] = {}
    for key in ASSET_KEYS:
        label = f"{LOCAL_BAND_NAMES[key]} ({key}, file {files[key]})"
        bands[key] = _read_band(label, str(directory / files[key]), bbox)
    return bands


def _clear_fraction(qa: Band) -> float:
    """Clear_Fraction of ``qa`` over the Boston boundary in the raster CRS (6.5)."""
    try:
        boundary = load_boundary(abs_path(BOSTON_GEOJSON))
    except Exception as exc:  # noqa: BLE001 - unreadable boundary file
        raise FetchError(
            f"{BOSTON_GEOJSON}: cannot read the Boston boundary ({exc}). "
            "Run `python3 pipeline/boston_boundary.py` first."
        ) from exc
    inside = inside_mask(boundary, qa.crs, qa.transform, qa.data.shape)
    return clear_fraction(qa.data, inside)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Save a Boston window of the four Landsat bands to pipeline/work/."
    )
    parser.add_argument(
        "--local",
        metavar="DIR",
        type=Path,
        help="read ST_B10, SR_B4, SR_B5, QA_PIXEL GeoTIFFs from DIR instead of the STAC API",
    )
    args = parser.parse_args(argv)

    # 1. Boundary bbox (Requirement 1.8).
    try:
        bbox = require_boston_bbox()
    except SystemExit as exc:
        return exc.code if isinstance(exc.code, int) else 1

    scene_path = abs_path(SCENE_FILE)
    try:
        # 2. Scene ID; errors exit before any network request (6.1, 6.9).
        scene_id, scene_existed = read_scene_id(scene_path)
        source = "Scene_File" if scene_existed else "DEFAULT_SCENE_ID"
        print(f"Scene: {scene_id} (from {source})")

        # 3. Read all four windows (6.2, 6.4, 6.11, 6.12, 6.13).
        if args.local is not None:
            print(f"Reading bands from {args.local} (no STAC request)")
            bands = fetch_local_bands(args.local, bbox)
        else:
            print(f"Reading bands for {scene_id} from the STAC API")
            bands = fetch_stac_bands(scene_id, bbox)

        # 4. Alignment check (6.10).
        mismatches = check_alignment({k: bands[k] for k in ASSET_KEYS})
        if mismatches:
            raise FetchError("bands are not aligned:\n  " + "\n  ".join(mismatches))

        # 5. Clear_Fraction (6.5, 6.6).
        cf = _clear_fraction(bands["qa_pixel"])
    except FetchError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if math.isnan(cf):
        print("Clear_Fraction: n/a (no pixel centers inside the Boston boundary)")
        print(
            "warning: the scene fails the clear-sky check. "
            f"`{FIND_SCENE_CMD}` can select another scene."
        )
    else:
        print(f"Clear_Fraction: {cf:.3f}")
        if cf < CLEAR_FRACTION_MIN:
            print(
                f"warning: the scene fails the clear-sky check (Clear_Fraction "
                f"{cf:.3f} < {CLEAR_FRACTION_MIN}). "
                f"`{FIND_SCENE_CMD}` can select another scene."
            )

    # 6. Save the four bands (1.9, 6.3).
    try:
        ensure_work_dir()
        for key in ASSET_KEYS:
            write_band(abs_path(BAND_PATHS[key]), bands[key])
            print(f"Saved {BAND_PATHS[key]}")
    except Exception as exc:  # noqa: BLE001 - OSError or rasterio write errors
        print(f"error: cannot write band GeoTIFF: {exc}", file=sys.stderr)
        return 1

    # 7. Default Scene_File only when absent; never rewrite an existing one (6.7, 6.8).
    if not scene_existed and not scene_path.exists():
        try:
            write_json_atomic(scene_path, default_scene_json())
        except OSError as exc:
            print(f"error: cannot write {SCENE_FILE}: {exc}", file=sys.stderr)
            return 1
        print(f"Wrote default {SCENE_FILE} ({DEFAULT_SCENE_ID})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
