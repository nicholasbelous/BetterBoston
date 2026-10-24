"""Shared pytest setup for the pipeline tests.

Adds ``pipeline/`` to ``sys.path`` so tests can ``import config``,
``import scoring``, etc. when run from the repo root with
``pytest pipeline/tests -q``. Also registers the hypothesis profile used by
every property test (100 examples, no deadline because numpy/rasterio calls
have variable latency).
"""

import sys
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent.parent
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from hypothesis import settings  # noqa: E402

settings.register_profile("pipeline", max_examples=100, deadline=None)
settings.load_profile("pipeline")
