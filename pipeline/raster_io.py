"""Shared raster and network glue for the Landsat data pipeline.

Holds the STAC client helper and atomic file writes. Raster helpers
(window reads, masks, GeoTIFF writes) are added alongside these. No scoring
math lives here; that stays in ``scoring.py``.

Heavy libraries are imported inside the functions that need them, so the
module can be imported (for example for ``write_json_atomic``) without the
geo/STAC stack installed.
"""

from __future__ import annotations

import os
from pathlib import Path

from config import HTTP_TIMEOUT_S, STAC_API_URL


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
