"""Request / response shapes. The frontend's src/types.ts mirrors these."""

from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["renter", "owner"]
ScoreLabel = Literal["Low", "Moderate", "High", "Very high"]


def score_to_label(score: int) -> ScoreLabel:
    """Every score is 0-100. The word label is shown next to the number so color is never the only cue."""
    if score <= 25:
        return "Low"
    if score <= 50:
        return "Moderate"
    if score <= 75:
        return "High"
    return "Very high"


class Location(BaseModel):
    block_id: str
    label: str = Field(description="Short street-level label, e.g. 'Hudson St, Chinatown'")
    city_line: str = Field(description="e.g. 'Boston, MA 02111'")
    neighborhood: str | None = None
    lat: float
    lon: float


class LookupResponse(BaseModel):
    status: Literal["ok", "out_of_coverage", "not_found"]
    searched: str
    location: Location | None = None


class Reason(BaseModel):
    id: str
    title: str
    text: str


class HeatScore(BaseModel):
    score: int
    label: ScoreLabel
    block_surface_temp_f: float
    city_avg_surface_temp_f: float
    coolest_neighborhood_surface_temp_f: float
    delta_vs_city_f: float = Field(description="Positive = hotter than the city average")
    reasons: list[Reason]


class TreeScore(BaseModel):
    score: int
    label: ScoreLabel
    canopy_pct: float = Field(description="Share of the block covered by trees or greenery, 0-100")


class SolarScore(BaseModel):
    status: Literal["coming_soon", "ready"] = "coming_soon"
    score: int | None = None


class DataNotes(BaseModel):
    surface_temp_source: str
    imagery_source: str
    comparison_area: str


class Report(BaseModel):
    location: Location
    heat: HeatScore
    trees: TreeScore
    solar: SolarScore
    roof_is_dark: bool
    data_notes: DataNotes
    demo_data: bool = Field(description="True while scores come from sample values, not the real pipeline")


class PlanRequest(BaseModel):
    block_id: str
    role: Role


class PlanAction(BaseModel):
    program_id: str
    title: str
    why: str
    cta_label: str
    cta_url: str | None
    tag: str | None
    icon: str


class Plan(BaseModel):
    role: Role
    summary: str
    actions: list[PlanAction]
    generated_by: Literal["claude", "rules"]
