"""FastAPI app. Run from the backend folder:  uvicorn app.main:app --reload --port 8000
Interactive API docs: http://localhost:8000/docs
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models import LookupResponse, Plan, PlanRequest, Report
from app.services import geocode
from app.services.data import programs
from app.services.plan import build_plan
from app.services.report import BlockNotFound, build_report

app = FastAPI(title="Climate Report Card API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "ai_plan_enabled": bool(settings.anthropic_api_key)}


@app.get("/api/lookup", response_model=LookupResponse)
def lookup(
    address: str | None = Query(None, max_length=200),
    lat: float | None = None,
    lon: float | None = None,
) -> LookupResponse:
    """Step 1 – 'Finding your block…'  Pass either ?address=… or ?lat=…&lon=… ('Use my location')."""
    if lat is not None and lon is not None:
        return geocode.lookup_coords(lat, lon)
    if not address:
        raise HTTPException(status_code=422, detail="Send an address, or lat and lon.")
    return geocode.lookup(address)


@app.get("/api/report/{block_id}", response_model=Report)
def report(block_id: str) -> Report:
    """Step 2 – 'Reading satellite data…'"""
    try:
        return build_report(block_id)
    except BlockNotFound:
        raise HTTPException(status_code=404, detail="We don't have data for this block.")


@app.post("/api/plan", response_model=Plan)
def plan(req: PlanRequest) -> Plan:
    """Step 3 – 'Building your plan…'"""
    try:
        rep = build_report(req.block_id)
    except BlockNotFound:
        raise HTTPException(status_code=404, detail="We don't have data for this block.")
    return build_plan(rep, req.role)


@app.get("/api/programs")
def list_programs() -> list[dict]:
    """The verified program catalog the plan is allowed to use."""
    return programs()
