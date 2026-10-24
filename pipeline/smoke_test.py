"""Quick check that the STAC API works and the Landsat asset keys exist.

Run from the repo root:

    python3 pipeline/smoke_test.py

Searches the Landsat Collection 2 Level-2 collection for up to 3 items that
intersect a point in downtown Boston and prints their metadata. Reads STAC
metadata only: no raster data is read and no files are written
(Requirement 2).

Exit status: 0 when at least one item is printed (even if asset keys are
missing), 1 when the STAC request fails or no items are found.
"""

from __future__ import annotations

import sys
from typing import Iterable

from config import ASSET_KEYS, COLLECTION_ID
from raster_io import open_stac

SMOKE_POINT = (-71.06, 42.36)  # lng, lat (EPSG:4326)
MAX_ITEMS = 3
NOT_AVAILABLE = "n/a"


def asset_report(asset_keys: Iterable[str]) -> tuple[list[str], list[str]]:
    """Split ASSET_KEYS into those present in ``asset_keys`` and those missing.

    Every key in ASSET_KEYS appears in exactly one of the two lists, in
    ASSET_KEYS order.
    """
    available = set(asset_keys)
    present = [k for k in ASSET_KEYS if k in available]
    missing = [k for k in ASSET_KEYS if k not in available]
    return present, missing


def _item_date(item) -> str:
    """Acquisition date as YYYY-MM-DD, or "n/a" if the item has none."""
    dt = getattr(item, "datetime", None)
    if dt is not None:
        return dt.strftime("%Y-%m-%d")
    props = getattr(item, "properties", None) or {}
    raw = props.get("datetime") or props.get("start_datetime")
    if isinstance(raw, str) and len(raw) >= 10:
        return raw[:10]
    return NOT_AVAILABLE


def format_item(item) -> str:
    """Human-readable summary of one STAC item's metadata."""
    props = getattr(item, "properties", None) or {}
    platform = props.get("platform")
    cloud = props.get("eo:cloud_cover")
    keys = list((getattr(item, "assets", None) or {}).keys())
    present, missing = asset_report(keys)
    lines = [
        f"Item: {item.id}",
        f"  date:        {_item_date(item)}",
        f"  platform:    {platform if platform is not None else NOT_AVAILABLE}",
        f"  cloud cover: {cloud if cloud is not None else NOT_AVAILABLE}",
        f"  asset keys:  {', '.join(keys) if keys else '(none)'}",
        f"  present:     {', '.join(present) if present else '(none)'}",
        f"  missing:     {', '.join(missing) if missing else '(none)'}",
    ]
    return "\n".join(lines)


def main() -> int:
    try:
        client = open_stac()
        search = client.search(
            collections=[COLLECTION_ID],
            intersects={"type": "Point", "coordinates": list(SMOKE_POINT)},
            max_items=MAX_ITEMS,
        )
        items = list(search.items())[:MAX_ITEMS]
    except Exception as exc:  # noqa: BLE001 - connection, HTTP, timeout, import
        print(f"STAC API request failed: {exc}")
        return 1

    if not items:
        print(
            f"No items in collection {COLLECTION_ID} intersect the point "
            f"({SMOKE_POINT[0]}, {SMOKE_POINT[1]})."
        )
        return 1

    print(f"Found {len(items)} item(s) in {COLLECTION_ID} at {SMOKE_POINT}:")
    for item in items:
        print()
        print(format_item(item))
    return 0


if __name__ == "__main__":
    sys.exit(main())
