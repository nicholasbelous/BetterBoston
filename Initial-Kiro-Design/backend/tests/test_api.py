from fastapi.testclient import TestClient

from app.config import settings

# Keep tests offline and deterministic.
settings.use_census_geocoder = False
settings.anthropic_api_key = None

from app.main import app  # noqa: E402

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_sample_lookup_and_report():
    r = client.get("/api/lookup", params={"address": "Hudson St, Chinatown"}).json()
    assert r["status"] == "ok"
    block_id = r["location"]["block_id"]

    rep = client.get(f"/api/report/{block_id}").json()
    assert rep["heat"]["score"] == 82
    assert rep["heat"]["label"] == "Very high"
    assert rep["heat"]["delta_vs_city_f"] == 9
    assert rep["trees"]["label"] == "Low"
    assert rep["trees"]["canopy_pct"] == 8


def test_out_of_coverage():
    r = client.get("/api/lookup", params={"address": "North St, Pittsfield, MA"}).json()
    assert r["status"] == "out_of_coverage"


def test_other_boston_address_gets_demo_report():
    r = client.get("/api/lookup", params={"address": "12 Main St, Charlestown"}).json()
    assert r["status"] == "ok"
    rep = client.get(f"/api/report/{r['location']['block_id']}").json()
    assert 0 <= rep["heat"]["score"] <= 100


def test_plans_have_four_actions_from_catalog():
    ids = {p["id"] for p in client.get("/api/programs").json()}
    for role in ("renter", "owner"):
        plan = client.post("/api/plan", json={"block_id": "sample-chinatown", "role": role}).json()
        assert len(plan["actions"]) == 4
        assert all(a["program_id"] in ids for a in plan["actions"])
        assert plan["generated_by"] == "rules"


def test_owner_plan_matches_design():
    plan = client.post("/api/plan", json={"block_id": "sample-chinatown", "role": "owner"}).json()
    assert [a["program_id"] for a in plan["actions"]] == ["heat_pump", "cool_roof", "yard_trees", "rooftop_solar"]


def test_unknown_block_404():
    assert client.get("/api/report/nope").status_code == 404
