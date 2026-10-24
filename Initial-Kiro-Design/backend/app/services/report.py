"""Builds the climate report for a block."""

from __future__ import annotations

import re

from app.models import DataNotes, HeatScore, Location, Reason, Report, SolarScore, TreeScore, score_to_label
from app.pipeline import heat as heat_pipeline
from app.pipeline import trees as tree_pipeline
from app.services.data import sample_blocks
from app.services.geocode import known_location, _match_sample

DATA_NOTES = DataNotes(
    surface_temp_source="Landsat, July 2025",
    imagery_source="MassGIS, spring 2025",
    comparison_area="the rest of the city",
)

GRID_ID = re.compile(r"^grid-(-?\d+\.\d+)_(-?\d+\.\d+)$")


class BlockNotFound(Exception):
    pass


def _reasons(pavement_heavy: bool, canopy_pct: float, roof_is_dark: bool) -> list[Reason]:
    reasons: list[Reason] = []
    if pavement_heavy:
        reasons.append(Reason(id="pavement", title="Lots of pavement",
                              text="Streets, sidewalks and parking soak up sun all day and give off heat at night."))
    if canopy_pct < 20:
        reasons.append(Reason(id="few_trees", title="Few trees",
                              text=f"Only about {round(canopy_pct)}% of your block has trees or greenery to give shade."))
    if roof_is_dark:
        reasons.append(Reason(id="dark_roofs", title="Dark roofs",
                              text="Dark roofs soak up sunlight and get much hotter than light-colored ones."))
    if not reasons:
        reasons.append(Reason(id="shade", title="Good shade nearby",
                              text="Trees and green space on your block help keep the ground cooler."))
    return reasons


def _location_for(block_id: str) -> Location:
    loc = known_location(block_id)
    if loc:
        return loc
    for block in sample_blocks()["blocks"]:
        if block["block_id"] == block_id:
            return _match_sample(block["match"][0])  # type: ignore[return-value]
    m = GRID_ID.match(block_id)
    if m:
        lat, lon = float(m.group(1)), float(m.group(2))
        return Location(block_id=block_id, label="Your block", city_line="Boston, MA", lat=lat, lon=lon)
    raise BlockNotFound(block_id)


def build_report(block_id: str) -> Report:
    location = _location_for(block_id)
    samples = sample_blocks()
    city_avg = samples["city_avg_surface_temp_f"]
    coolest = samples["coolest_neighborhood_surface_temp_f"]

    sample = next((b for b in samples["blocks"] if b["block_id"] == block_id), None)
    if sample:
        heat_score = sample["heat_score"]
        block_temp = sample["block_surface_temp_f"]
        tree_score = sample["tree_score"]
        canopy = sample["canopy_pct"]
        roof_dark = sample["roof_is_dark"]
        pavement = sample["pavement_heavy"]
    else:
        # Real pipeline goes here. Until it's built, these return stable demo estimates.
        h = heat_pipeline.estimate_for_block(location.lat, location.lon, city_avg)
        t = tree_pipeline.estimate_for_block(location.lat, location.lon)
        heat_score, block_temp = h.score, h.surface_temp_f
        tree_score, canopy = t.score, t.canopy_pct
        roof_dark, pavement = h.roof_is_dark, h.pavement_heavy

    return Report(
        location=location,
        heat=HeatScore(
            score=heat_score,
            label=score_to_label(heat_score),
            block_surface_temp_f=block_temp,
            city_avg_surface_temp_f=city_avg,
            coolest_neighborhood_surface_temp_f=coolest,
            delta_vs_city_f=round(block_temp - city_avg, 1),
            reasons=_reasons(pavement, canopy, roof_dark),
        ),
        trees=TreeScore(score=tree_score, label=score_to_label(tree_score), canopy_pct=canopy),
        solar=SolarScore(status="coming_soon"),
        roof_is_dark=roof_dark,
        data_notes=DATA_NOTES,
        demo_data=True,
    )
