"""Loads the JSON files in app/data once."""

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@lru_cache
def sample_blocks() -> dict:
    return json.loads((DATA_DIR / "sample_blocks.json").read_text())


@lru_cache
def programs() -> list[dict]:
    return json.loads((DATA_DIR / "programs.json").read_text())["programs"]


def program_by_id(program_id: str) -> dict | None:
    return next((p for p in programs() if p["id"] == program_id), None)
