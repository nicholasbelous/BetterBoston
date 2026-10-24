"""Heat risk from Landsat land surface temperature.

RIGHT NOW: `estimate_for_block` returns stable fake values so any Boston address works in the demo.

THE REAL VERSION (do this ahead of time, not per request):
1. Get a clear-sky Landsat 8/9 Collection 2 Level-2 scene over Boston from a July 2025 afternoon
   (USGS EarthExplorer, or the Landsat collection on Microsoft Planetary Computer / AWS).
2. Use the surface temperature band (ST_B10). Convert to Kelvin with the Collection 2 scale factor
   (value * 0.00341802 + 149.0), then to °F. Mask clouds using the QA_PIXEL band.
3. Get block polygons (2020 Census blocks for Suffolk County, or MassGIS) and clip them to Boston.
4. For each block, take the mean surface temperature (zonal stats: rasterio + rasterstats or exactextract).
5. Score = the block's percentile rank among all Boston blocks, 0-100. Store the city mean too.
6. Save the results as a table (CSV/Parquet/SQLite) keyed by block ID, and have the API read from it.

Libraries you'd add for this: rasterio, geopandas, rasterstats (or exactextract), numpy.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass
class HeatEstimate:
    score: int
    surface_temp_f: float
    roof_is_dark: bool
    pavement_heavy: bool


def _unit(lat: float, lon: float, salt: str) -> float:
    h = hashlib.sha1(f"{lat:.3f},{lon:.3f},{salt}".encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def estimate_for_block(lat: float, lon: float, city_avg_f: float) -> HeatEstimate:
    """DEMO ONLY: deterministic fake numbers. Replace with a lookup into the precomputed table."""
    score = int(20 + _unit(lat, lon, "heat") * 72)  # 20-92
    temp = round(city_avg_f + (score - 50) / 4, 1)  # roughly -7.5°F .. +10.5°F around the city average
    return HeatEstimate(
        score=score,
        surface_temp_f=temp,
        roof_is_dark=_unit(lat, lon, "roof") > 0.4,
        pavement_heavy=score > 55,
    )
