"""Tree cover from MassGIS aerial imagery.

RIGHT NOW: `estimate_for_block` returns stable fake values so any Boston address works in the demo.

THE REAL VERSION (do this ahead of time, not per request):
1. Download the MassGIS 2025 aerial imagery tiles for Boston. If the imagery has a near-infrared
   band, compute NDVI = (NIR - Red) / (NIR + Red) for each pixel.
2. Call a pixel "green" when NDVI is above a threshold (start around 0.3 and check it by eye
   against the photos). If there's no NIR band, use an existing MassGIS land cover / canopy layer instead.
3. For each block polygon, canopy_pct = green pixels / all pixels * 100.
4. Score = the block's percentile rank among Boston blocks, 0-100 (higher = more shade).
5. Save to the same table as the heat results, keyed by block ID.

Bonus for the "dark roofs" reason and the cool-roof action: intersect building footprints
(MassGIS structures layer) with the imagery and flag roofs with low average brightness.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass
class TreeEstimate:
    score: int
    canopy_pct: float


def estimate_for_block(lat: float, lon: float) -> TreeEstimate:
    """DEMO ONLY: deterministic fake numbers. Replace with a lookup into the precomputed table."""
    h = hashlib.sha1(f"{lat:.3f},{lon:.3f},trees".encode()).hexdigest()
    u = int(h[:8], 16) / 0xFFFFFFFF
    score = int(10 + u * 75)  # 10-85
    canopy = round(3 + score * 0.45, 1)
    return TreeEstimate(score=score, canopy_pct=canopy)
