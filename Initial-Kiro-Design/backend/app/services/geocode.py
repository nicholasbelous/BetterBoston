"""Turns a typed address into a block we have data for, or says it's out of coverage.

Order of checks:
1. The two sample addresses (always work, even offline).
2. The free US Census geocoder (if USE_CENSUS_GEOCODER is on).
3. A simple text fallback, so the demo still behaves sensibly offline.
"""

from __future__ import annotations

import hashlib
import logging

import httpx

from app.config import settings
from app.models import Location, LookupResponse
from app.services.data import sample_blocks

log = logging.getLogger(__name__)

# Rough bounding box around the City of Boston. Good enough for a demo coverage check.
# TODO: swap for a real point-in-polygon test against the Boston city boundary from MassGIS.
BOSTON_BBOX = {"min_lat": 42.227, "max_lat": 42.400, "min_lon": -71.191, "max_lon": -70.986}

BOSTON_NEIGHBORHOODS = [
    "allston", "back bay", "bay village", "beacon hill", "brighton", "charlestown", "chinatown",
    "dorchester", "downtown", "east boston", "fenway", "hyde park", "jamaica plain", "mattapan",
    "mission hill", "north end", "roslindale", "roxbury", "south boston", "south end", "west end",
    "west roxbury", "boston",
]

CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"


def in_boston(lat: float, lon: float) -> bool:
    b = BOSTON_BBOX
    return b["min_lat"] <= lat <= b["max_lat"] and b["min_lon"] <= lon <= b["max_lon"]


def block_id_for(lat: float, lon: float) -> str:
    """Stand-in block ID from coordinates (~100 m grid).
    TODO: replace with the real Census block GEOID from a point-in-polygon lookup."""
    return f"grid-{lat:.3f}_{lon:.3f}"


def _match_sample(address: str) -> Location | None:
    text = address.lower()
    for block in sample_blocks()["blocks"]:
        if any(m in text for m in block["match"]):
            return Location(
                block_id=block["block_id"],
                label=block["label"],
                city_line=block["city_line"],
                neighborhood=block["neighborhood"],
                lat=block["lat"],
                lon=block["lon"],
            )
    return None


def _census_lookup(address: str) -> tuple[float, float, str, str] | None:
    """Returns (lat, lon, street_label, city_line) or None."""
    params = {"address": address, "benchmark": "Public_AR_Current", "format": "json"}
    try:
        r = httpx.get(CENSUS_URL, params=params, timeout=6.0)
        r.raise_for_status()
        matches = r.json()["result"]["addressMatches"]
    except Exception as exc:  # network down, bad response, etc.
        log.warning("Census geocoder failed: %s", exc)
        return None
    if not matches:
        return None
    m = matches[0]
    lon, lat = m["coordinates"]["x"], m["coordinates"]["y"]
    parts = m.get("addressComponents", {})
    street = " ".join(
        p for p in [parts.get("preDirection"), parts.get("streetName"), parts.get("suffixType"), parts.get("suffixDirection")] if p
    ).title() or m["matchedAddress"].split(",")[0].title()
    city_line = f"{parts.get('city', '').title()}, {parts.get('state', '')} {parts.get('zip', '')}".strip()
    return lat, lon, street, city_line


def _text_fallback(address: str) -> LookupResponse:
    text = address.lower()
    if any(n in text for n in BOSTON_NEIGHBORHOODS):
        # Offline demo: pretend it's a Boston block so the flow still works.
        h = int(hashlib.sha1(text.encode()).hexdigest(), 16)
        lat = 42.30 + (h % 1000) / 10000
        lon = -71.10 + ((h // 1000) % 1000) / 10000
        label = address.split(",")[0].strip().title()
        return LookupResponse(
            status="ok",
            searched=address,
            location=Location(block_id=block_id_for(lat, lon), label=label, city_line="Boston, MA", lat=lat, lon=lon),
        )
    if "ma" in text.replace(",", " ").split() or "massachusetts" in text:
        return LookupResponse(status="out_of_coverage", searched=address)
    return LookupResponse(status="not_found", searched=address)


# Locations found this session, so /api/report can show the street label for a block ID.
# TODO: use a real cache or database if you deploy this.
_known_locations: dict[str, Location] = {}


def known_location(block_id: str) -> Location | None:
    return _known_locations.get(block_id)


def lookup(address: str) -> LookupResponse:
    result = _lookup(address)
    if result.location:
        _known_locations[result.location.block_id] = result.location
    return result


def lookup_coords(lat: float, lon: float) -> LookupResponse:
    """For 'Use my location'. TODO: reverse-geocode to show a street name instead of 'Your location'."""
    searched = f"{lat:.5f}, {lon:.5f}"
    if not in_boston(lat, lon):
        return LookupResponse(status="out_of_coverage", searched="your current location")
    loc = Location(block_id=block_id_for(lat, lon), label="Your location", city_line="Boston, MA", lat=lat, lon=lon)
    _known_locations[loc.block_id] = loc
    return LookupResponse(status="ok", searched=searched, location=loc)


def _lookup(address: str) -> LookupResponse:
    address = address.strip()
    if not address:
        return LookupResponse(status="not_found", searched=address)

    sample = _match_sample(address)
    if sample:
        return LookupResponse(status="ok", searched=address, location=sample)

    if settings.use_census_geocoder:
        found = _census_lookup(address)
        if found:
            lat, lon, street, city_line = found
            if not in_boston(lat, lon):
                return LookupResponse(status="out_of_coverage", searched=address)
            return LookupResponse(
                status="ok",
                searched=address,
                location=Location(block_id=block_id_for(lat, lon), label=street, city_line=city_line, lat=lat, lon=lon),
            )

    return _text_fallback(address)
