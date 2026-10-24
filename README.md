# [PROJECT_NAME] (working name: ClimateCheck MA)

Type a Massachusetts address and get a plain-English climate report for your block: how hot the ground gets on a summer day, how green the block is, live weather, air, and flood information for that spot, and an action plan built only from real Massachusetts programs.

> This README is the team plan for the hackathon. The full write-up (problem, data sources, architecture, limitations, "How we used Kiro") gets filled in during the last hour. See "Final hour" below.

## Where things stand

| Part | Status |
|---|---|
| Next.js app, config, `.env.example`, shared types | Done |
| Backend API: `/api/geocode`, `/api/score`, `/api/action-plan` (Person 3) | Done. Action plan uses the rules fallback until `ANTHROPIC_API_KEY` is set **and** programs are verified |
| Frontend: `/`, `/map`, `/report`, `/actions`, `/improvements`, `/about` (Person 1) | Merged. Calls the real APIs, falls back to labeled mocks. Fixes needed, see Person 1's list |
| Sample score grid + validator (Person 2) | Done: 944 SAMPLE cells in Chinatown, West Roxbury, East Boston. `npm run validate:data` passes |
| Real scores: NDVI + Landsat heat pipeline (Person 2) | **Not started.** Landsat scene is downloaded. This is the biggest demo risk |
| Program data, `data/programs/` (Person 3) | 8 programs drafted from official pages. **None verified**, so `/api/action-plan` returns 503 `no_programs` |
| Live data APIs: weather, heat alerts, air, flood, street trees, cooling centers (Person 3) | **Not started.** Sources picked and tested, see Person 3's list |
| Kiro: steering, spec, hooks in `.kiro/` | Done |
| `Initial-Kiro-Design/` | Old FastAPI + Vite prototype. Reference only, excluded from lint and tsc |

### Where the numbers come from (no AI makes up a score)

| What the user sees | Source | Type |
|---|---|---|
| Heat score | Landsat 9, June 25, 2024, through our pipeline | Offline, `data/scores/` |
| Green cover score | MassGIS 2025 aerial photos (NDVI), through our pipeline | Offline, `data/scores/` |
| Today's weather + heat alerts | National Weather Service API, Open-Meteo fallback | Live, Person 3 |
| Air quality | Open-Meteo Air Quality API (modeled) | Live, Person 3 |
| Flood zone + future sea-level-rise flooding | FEMA flood maps + Climate Ready Boston | Live, Person 3 |
| Street trees nearby | City of Boston street tree inventory (BPRD Trees) | Live, Person 3 |
| Nearest community centers | City of Boston Community Centers dataset | Live, Person 3 |
| Action plan text | Claude, **only** from verified `data/programs/` and the facts above. Rules fallback if anything fails | Server-side |

## Quick start

```bash
git clone https://github.com/nicholasbelous/Hackachusetts.git
cd Hackachusetts
npm install
cp .env.example .env.local      # Person 3 adds ANTHROPIC_API_KEY; others can leave it blank
npm run dev                     # http://localhost:3000
```

Python pipeline (Person 2):

```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

If you see `"/map" does not satisfy the constraint 'AppRoutes'`, run `npx next typegen` (or start `npm run dev` once).

## Decisions already made

- **Demo neighborhoods:** Chinatown (hot, paved), West Roxbury (green), East Boston (mixed, near water).
- **Leaf-off imagery:** the MassGIS 2025 photos were taken March 18 to April 23, 2025, before leaf-out. The score is called **"green cover"**, not "tree canopy," and the About page explains why.
- **Heat scene:** Landsat 9, June 25, 2024 (`LC09_L2SP_012031_20240625_02_T1`), under 1% cloud over Boston.
- **AI provider:** Anthropic API (Claude Haiku), not AWS Bedrock.
- **Still open:** the final project name. Replace every `[PROJECT_NAME]` and `APP_NAME` in `lib/config.ts`.

## Who does what

Three people. Each person owns their files (see `.kiro/steering/structure.md`). Ask the owner before editing someone else's files. Items are in priority order: do them top to bottom, and stop at the feature-freeze line.

---

### Person 1: Frontend + demo video — [NAME]

Owns `app/` pages (not `app/api/`), `components/`, `hooks/`, `services/`, `mocks/`, `app/globals.css`, `public/`.

**Done**
- [x] Six pages: home, map, report, actions, improvements, about. Mobile layout with header and bottom nav.
- [x] MapLibre map with the MassGIS 2025 aerial basemap, marker, and cell outline.
- [x] `services/climateClient.ts` calls the real `/api/geocode`, `/api/score`, and `/api/action-plan`, with labeled mock fallbacks.
- [x] Out-of-coverage locations show "Coverage coming soon" with no score.
- [x] Score cards say "ground surface temperature on one summer day, not air temperature" and mention the leaf-off photo.
- [x] Renter/owner choice (audience chips on `/actions`) re-requests the plan.

**Fix first (these break the demo)**
- [ ] **Default location.** `DEFAULT_DEMO_ADDRESS` and the first demo chip are 72 Beacon St (Beacon Hill), which is outside the score grid. Every screen opened without an address shows "Coverage coming soon." Switch the default and the chips to the demo points that hit real cells (Chinatown, West Roxbury, East Boston). Use Person 2's final demo addresses when they're ready.
- [ ] **Map colors.** `MapScreen` always colors `MOCK_GRID`, so the colors contradict the score cards. Color the map from Person 3's new `GET /api/grid` and drop `MOCK_GRID` once that's merged. Make the `selected-outline` layer match real `cell_id`s.
- [ ] **"Written by AI" label.** `ActionPlanList` shows it on every plan. Show it only when `plan.source === "ai"`. For `"rules"`, say "Built from our checked program list."
- [ ] **Silent address swap.** When `/api/geocode` fails, `geocodeAddress` quietly swaps in a demo address ("Beacon St, Brookline" becomes "72 Beacon St, Boston"). Show "Showing a demo address because live search is down" whenever `origin === "mock"`.

**Honesty fixes (judges will read these)**
- [ ] **/improvements numbers.** Remove the invented "−6 to −10°F," "−20 to −35% cooling costs," and "+60% shade" (`mocks/improvements.mock.ts`). Use plain descriptions with no numbers ("more shade," "a cooler roof") or remove the Benefits list.
- [ ] **"Green cover" wording.** Change "Tree Coverage" (`ReportScreen.tsx`), "Trees & green space" (`ScoreCard.tsx`), and the "Trees" chips and badges (`MapSheet.tsx`, `ActionsScreen.tsx`) to "Green cover."
- [ ] **Heat headline.** "This home is in a high heat exposure area" overstates the data. Use: "Your block's ground got hotter than most of Boston on a summer day."
- [ ] **Map legend.** Change "Lower risk / Higher risk" to "Cooler ground / Hotter ground."
- [ ] **Landing claims.** Drop "Real data" and "AI insights" (`app/page.tsx`, `FeatureGrid.tsx`) until real scores and the AI plan are live, or reword them as "Built on satellite and aerial imagery."
- [ ] **"Personalized for your home"** on `/actions` sits above generic placeholders. Show it only when an API plan is displayed.
- [ ] **Sample labels per item.** Banners currently depend only on `metadata.is_sample`. Once real scores land, the mock map grid and placeholders would lose their label. Show the SAMPLE note whenever *anything* on screen is mock.
- [ ] **"Dangerous heat"** in `mocks/actions.mock.ts`: change it to "very hot days."

**Connect to real data**
- [ ] **Aerial photo on the report.** The report shows a drawn house. The spec calls for the MassGIS 2025 photo of the home and block. Add a small, non-interactive `MapView` at about zoom 18, with a caption: "Aerial photo, spring 2025 (MassGIS)." Keep the drawing only as decoration.
- [ ] **Report → Recommendations tab.** Use the same `loadActionPlan` result as `/actions` instead of `MOCK_ACTIONS.slice(0, 3)`.
- [ ] **Live data cards** (after Person 3 merges each route; contracts are in Person 3's list):
  - [ ] Weather card: today's high and "feels like" from `/api/weather`, labeled **"Air temperature today (National Weather Service)"** so it's never confused with the ground-temperature score.
  - [ ] Heat alert banner: if `/api/weather` returns an active Heat Advisory or Excessive Heat Warning, show it at the top of every screen with a link to the cooling centers action.
  - [ ] Replace the mock **Air Quality** tile with `/api/air` (US AQI plus a plain category like "Moderate"). Label it "Modeled estimate (Open-Meteo)."
  - [ ] Replace the mock **Flood Risk** tile with `/api/flood`. Show the FEMA zone ("Zone X: minimal flood hazard") and the Climate Ready Boston future-flooding result ("Could flood in a 1% storm with 21 inches of sea level rise"). Remove the "Sample" tag once it's real.
  - [ ] Street trees card from `/api/trees`: "27 City street trees within 100 m." Add a caption: "Counts City-owned street trees only, not yard or park trees."
  - [ ] Nearest community centers from `/api/cooling-centers`, inside the cooling centers action, with distance and address. Add the caption: "Open as cooling centers during declared heat emergencies."
  - [ ] Every live card shows its source and "Updated <time>." Hide the card if the route fails. Never show mock live data.
- [ ] **About page.** Read `data/scores/demo_grid.meta.json` (scene date, thresholds, neighborhoods). Add the USGS and MassGIS links (TODOs at lines 6, 19, 29). Add a "Live data" section listing NWS, Open-Meteo, FEMA, Climate Ready Boston, and Analyze Boston.

**Smaller fixes**
- [ ] `MapSheet.tsx`: `no_data` currently shows "We haven't mapped this spot yet." Show "Not enough clear data for this block" and keep the report link.
- [ ] `/actions` and `/improvements` ignore `out_of_coverage`. Show `CoverageNotice` there too.
- [ ] "Copy plan" always copies the placeholders. Copy the API plan when one is shown.
- [ ] Delete the unused `components/TenureToggle.tsx` and `findMockCellById`, or use them.
- [ ] Add alt text to the `HouseScene` in `MapSheet` (it has `label=""`).
- [ ] Optional: share one `/api/score` result across screens (each screen re-fetches today).

**Polish + demo (after the fixes above)**
- [ ] Test at 375 px wide on a real phone: tap targets, contrast, nothing cut off.
- [ ] Walk through each demo address end to end: home → map → report → actions → about.
- [ ] Record the demo video with Person 3 (about 2 minutes: problem, the 3 contrasting addresses, renter vs owner, honesty labels).
- [ ] Final hour: README sections for the problem, how it works, and setup.

---

### Person 2: Data pipeline (real green cover + heat scores) — [NAME]

Owns `pipeline/` and `data/scores/`. Owns the score fields in `lib/types.ts`: tell the team before changing them.

**Done**
- [x] `pipeline/make_sample_data.py`: 944 SAMPLE cells, all marked `is_sample: true`.
- [x] `pipeline/validate_scores.py`, wired to `npm run validate:data`.

**Setup**
- [ ] `pipeline/requirements.txt`: rasterio, numpy, geopandas, shapely, pyproj.
- [ ] `pipeline/config.py`: demo bounding boxes per neighborhood, `CELL_SIZE_M = 100`, `NDVI_THRESHOLD`, `MIN_VALID_FRAC`, `PROCESSING_CRS = "EPSG:26919"`, and file paths.
- [ ] Get the Landsat files from Person 3 (AirDrop or drive) into `pipeline/raw/landsat/`.

**Green cover (NDVI): do this first, commit by hour 3**
- [ ] Find the tile names for each neighborhood with the MassGIS index service (query by point):
      `https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Color_2025_Aerial_Imagery_Index/FeatureServer/0/query`
      Each tile is a ~20 MB zip with a 4-band JPEG 2000 in UTM 19N. Save the zips to `pipeline/raw/massgis/`. Write the exact steps in `pipeline/DOWNLOAD.md`.
- [ ] `massgis_ndvi.py`: read red and NIR with rasterio. Compute `NDVI = (NIR - Red) / (NIR + Red)` as float32, skipping pixels where the sum is 0. Downsample to about 1 m before thresholding (15 cm is slow). Write the vegetation mask to `pipeline/work/`.
- [ ] Sanity-check the threshold: open 3-4 cells next to the aerial photo and confirm that parks and lawns count and roofs and streets don't. Record the chosen value in the metadata.
- [ ] `build_grid.py` (green cover only): a 100 m grid in EPSG:26919. For each cell, compute `pct_vegetated` and `tree_valid_frac`, then `tree_score` as a 0-100 percentile. Use `null` below `MIN_VALID_FRAC`. Reproject to EPSG:4326. Write both files with `is_sample: false` everywhere, with heat fields `null` for now.
- [ ] Fill the metadata correctly: `tree.source`, `imagery_dates: "2025-03-18 to 2025-04-23"`, `leaf_off: true`, `ndvi_threshold`, `reference_area`, `sources[]` with links.
- [ ] Run `npm run validate:data`, then commit and open a PR.

**Heat (Landsat)**
- [ ] `landsat_heat.py`: read `ST_B10` and `QA_PIXEL`. Mask QA bits 0 (fill), 1 (dilated cloud), 3 (cloud), 4 (shadow), and 7 (water). Convert with `K = DN × 0.00341802 + 149.0`, then `F = (K − 273.15) × 9/5 + 32`. Reproject EPSG:32619 → EPSG:26919.
- [ ] Compute the **Boston-wide mean** °F from the same scene, clipped to the city boundary (e.g. the Boston Neighborhood Boundaries feature service). Save it as `heat.reference_mean_f`, with `reference_area: "Boston"`.
- [ ] Add the heat fields in `build_grid.py`: `mean_surface_temp_f`, `temp_diff_f`, `heat_score` (percentile among Boston cells), and `heat_valid_frac`.
- [ ] Metadata: `heat.scene_id: "LC09_L2SP_012031_20240625_02_T1"`, `scene_date: "2024-06-25"`, `source`, `min_valid_frac`.
- [ ] Validate, commit, PR.
- [ ] **Cut line:** if heat isn't working by 5:00, ship the real green cover grid with heat left `null`. Never fill heat with sample numbers in a grid marked real.

**Demo support**
- [ ] Pick 3 real street addresses (one per neighborhood) with clearly different results. Run each through `/api/geocode` and check the returned label. Census sometimes matches a similar street in another neighborhood. Send them to Person 1.
- [ ] Check that the 3 demo cells aren't `null` and that their numbers look plausible next to the aerial photo.
- [ ] `pipeline/README.md`: exact run order (download → `massgis_ndvi.py` → `landsat_heat.py` → `build_grid.py` → validate) and how long each step takes.
- [ ] Optional cross-check: compare `pct_vegetated` with Person 3's street tree counts for the demo cells. Don't merge the two, just make sure neither is wildly off.
- [ ] Final hour: README sections for data sources, scores and formulas, and limitations (surface vs. air temperature, one summer day, leaf-off photos, demo area only).

---

### Person 3: Backend API, live data APIs, AI action plan, Kiro — [NAME]

Owns `app/api/`, `lib/` (except the score fields), `data/programs/`, `.env.example`, and `.kiro/`.

**Done**
- [x] Switched from Bedrock to the Anthropic API (`lib/claude.ts`, forced tool call → JSON).
- [x] Landsat scene picked (June 25, 2024, under 1% cloud over Boston) and downloaded to `pipeline/raw/landsat/`.
- [x] `GET /api/geocode`: Census → Nominatim fallback, ", MA" bias, 5-second timeouts.
- [x] `GET /api/score`: point-in-polygon lookup returning `ok` / `no_data` / `out_of_coverage`. Reloads when the files change.
- [x] `POST /api/action-plan`: zod validation, rejects unknown program ids and invented phone numbers, dollar amounts, emails, and URLs. Rules fallback. Per-cell cache.
- [x] 8 programs drafted from official pages in `data/programs/`.
- [x] Kiro steering (4 files), spec (requirements, design, tasks), and two validation hooks.

**Unblock the action plan (do first)**
- [ ] **Verify the 8 programs (~20 min).** Open every `link`, check every sentence and `details` value, and set `last_verified` to today (`YYYY-MM-DD`). Check these most carefully: the SMART rates ($0.03 / $0.06 per kWh), the phone numbers, and community solar (it came from MassCEC because mass.gov blocked automated reading).
- [ ] **Add `ANTHROPIC_API_KEY`** to `.env.local`. Restart `npm run dev` and confirm `source: "ai"` for a Chinatown cell.
- [ ] **Check AI output.** Read 5-10 plans (both tenures, all 3 neighborhoods). Every program name and number must appear in `data/programs/`. Tighten the prompt if anything drifts.

**`GET /api/grid` (Person 1 needs this for real map colors)**
- [ ] Return the full `data/scores/demo_grid.geojson` (properties trimmed to `cell_id`, `heat_score`, `tree_score`, `neighborhood`, `is_sample`) plus `metadata.is_sample`. Cache it like `loadScores`. Send the contract to Person 1.

**Live data APIs, no AI involved.** All free. The first five need no key. Put each one in `lib/live/<name>.ts` with a route in `app/api/<name>/route.ts`.
- [ ] **Shared plumbing, `lib/live/http.ts`:** `fetchJson(url, { timeoutMs: 5000, headers })`, a small in-memory TTL cache keyed by rounded lat/lng (3 decimals ≈ 100 m), and a `LiveResult<T> = { data: T, source: string, source_url: string, fetched_at: string }` type in `lib/types.ts`. Reuse `GEOCODER_USER_AGENT` for the User-Agent.
- [ ] **`GET /api/weather?lat&lng`: National Weather Service** (`api.weather.gov`, no key, needs a User-Agent).
  - `GET /points/{lat},{lng}` → `properties.forecast` URL → first 2 periods (name, temperature, shortForecast).
  - `GET /alerts/active?point={lat},{lng}` → event names. Flag `heat_alert: true` for "Heat Advisory," "Excessive Heat Warning," "Extreme Heat Warning," or "Excessive Heat Watch."
  - Fallback when NWS fails: **Open-Meteo** `api.open-meteo.com/v1/forecast?current=temperature_2m,apparent_temperature&daily=temperature_2m_max,apparent_temperature_max,uv_index_max&temperature_unit=fahrenheit`.
  - Cache the forecast for 30 min and alerts for 5 min.
  - Response: `{ today: {high_f, feels_like_high_f?, summary}, tonight: {low_f}, uv_index_max?, alerts: string[], heat_alert: boolean }` + `LiveResult` fields.
- [ ] **`GET /api/air?lat&lng`: Open-Meteo Air Quality** (`air-quality-api.open-meteo.com/v1/air-quality?current=us_aqi,pm2_5,ozone`, no key). Map the AQI to the EPA categories (0-50 Good, 51-100 Moderate, 101-150 Unhealthy for Sensitive Groups, …). Label it "modeled estimate." Cache for 60 min.
  - Optional upgrade: AirNow (EPA) for real monitor readings. It needs a free key, `AIRNOW_API_KEY`.
- [ ] **`GET /api/flood?lat&lng`: FEMA + Climate Ready Boston** (ArcGIS REST point queries, no key).
  - FEMA National Flood Hazard Layer: `hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query` → `FLD_ZONE`, `ZONE_SUBTY`, `SFHA_TF` (true means a high-risk zone).
  - Climate Ready Boston Sea Level Rise Inundation: `services.arcgis.com/sFnw0xNflSi8J0uh/arcgis/rest/services/Climate_Ready_Boston_Sea_Level_Rise_Inundation/FeatureServer/{7,1,4}/query` with `returnCountOnly=true` → whether the point floods in a 1% annual storm with 9, 21, or 36 inches of sea level rise.
  - Tested: Chinatown is FEMA Zone X but floods in the 21-inch and 36-inch scenarios. East Boston at Jeffries Point is the same. West Roxbury is not in any of the three.
  - Cache for 24 h. Response: `{ fema_zone, fema_high_risk, future_flood: {sl9in, sl21in, sl36in} }` + sources.
- [ ] **`GET /api/trees?lat&lng`: Boston street trees** (Analyze Boston BPRD Trees, `services.arcgis.com/sFnw0xNflSi8J0uh/arcgis/rest/services/BPRD_Trees/FeatureServer/0/query`, `distance=100&units=esriSRUnit_Meter`).
  - Return the count plus the top 3 species (`spp_com`).
  - Tested: Chinatown has 27, East Boston 39, West Roxbury 2. West Roxbury's trees are mostly in yards, which the city inventory doesn't count. **Always label it "City street trees only."** It complements the NDVI score and never replaces it.
  - Cache for 24 h.
- [ ] **`GET /api/cooling-centers?lat&lng`: Boston Community Centers** (Analyze Boston, 35 BCYF centers, GeoJSON or `Community_Centers/FeatureServer`).
  - Download once to `data/live/community_centers.geojson` (small, refresh before the demo), or query live.
  - Return the nearest 3 with name (`SITE`), street, neighborhood, and straight-line distance.
  - The dataset's phone numbers have no area code (e.g. "635-5120"). Don't add one. Show the phone as given or leave it out.
  - Always caption: "BCYF centers open as cooling centers during declared heat emergencies. Check boston.gov/heat."
- [ ] **Use live facts in the action plan.** Add a `<live_conditions>` block to `buildUserPrompt` (heat alert yes/no, today's high, AQI category, flood results, street tree count, nearest center name). Add those values to the corpus `validateModelPlan` checks, so real numbers pass and invented ones still fail. In `actionPlanRules.ts`, put cooling centers + AlertBoston first when `heat_alert` is true, and put the street tree request higher when the tree count is low.
- [ ] **Honesty rules for live data** (add them to `.kiro/steering/data.md`): live weather is **air** temperature and must never be mixed with the ground-temperature score. Every live value carries its source and fetch time. If a source fails, return 502/503 and the UI hides the card. **Never fall back to made-up live data.**
- [ ] Update `.env.example` (optional `AIRNOW_API_KEY`) and the design doc (`.kiro/specs/climatecheck-mvp/design.md`) with the new routes.
- [ ] Send Person 1 the route contracts as each one merges. Merge each route as its own small PR.

**Stretch**
- [ ] `GET /api/solar?lat&lng`: Google Solar API (`buildingInsights:findClosest`, `GOOGLE_SOLAR_API_KEY`). Show it for owners only, and only when the key is set.
- [ ] Climate Ready Boston Social Vulnerability (Analyze Boston) as context in the plan ("more older adults or people with medical conditions live here"). Only use the dataset's own wording.

**Final hour**
- [ ] README sections: architecture, environment variables, and "How we used Kiro" (specs, steering, hooks).
- [ ] Help Person 1 record the demo video.

---

## Timeline (7 hours)

| Hour | Milestone | Who |
|---|---|---|
| 0:15 | Decisions made, everyone running `npm run dev` | All ✅ |
| 1:00 | Sample grid committed. Landsat scene downloaded | P2, P3 ✅ |
| 2:00 | Address search → map → report works end to end on sample data | P1, P3 ✅ |
| 3:00 | Real green cover scores committed (heat `null`). Programs verified. `/api/grid` merged | P2, P3 |
| 4:00 | Weather + heat alert, air, and flood routes merged. Frontend default location and map colors fixed | P3, P1 |
| 4:30 | Real heat scores in the grid. AI plan working with a key | P2, P3 |
| 5:30 | **Feature freeze.** Live data cards and honesty fixes in the UI | P1 |
| 6:30 | Demo addresses tested on a phone. Video recorded. README finished | All |
| 7:00 | Submit | All |

If real data runs late, demo with the sample grid and keep the "SAMPLE DATA" banner visible. Never remove a banner to make the demo look finished.

## Final hour (5:30 – 7:00)

- **Person 1:** demo video, plus the README sections for the problem, how it works, and setup.
- **Person 2:** README sections for data sources (with links), scores and formulas, and limitations (surface vs. air temperature, one summer day, spring leaf-off imagery, demo area only).
- **Person 3:** README sections for architecture, environment variables, and "How we used Kiro."

## Handoffs between people

- **`lib/types.ts`** is the contract. Announce changes in team chat before pushing.
- **`data/scores/*`**: only Person 2 commits these. Run `npm run validate:data` before every commit.
- **New routes:** Person 3 posts each contract (URL, response JSON, error codes) in chat when it merges. Person 1 builds the cards against them.
- **Demo addresses:** Person 2 → Person 1.
- **Landsat files:** Person 3 → Person 2 by AirDrop or drive. Rasters are gitignored.

## Git workflow

- One branch per person (`p1-frontend` / `feature/climate-frontend`, `p2-pipeline`, `p3-api`). Small PRs into `main`, merged with **"Create a merge commit."**
- Before opening a PR: `git pull origin main`, then `npm install`, then `npm run lint && npm run build`.
- After any merge: everyone runs `git pull origin main` on their own branch.
- Announce in chat before touching `package.json` or `lib/types.ts`. If the lockfile conflicts: `git checkout --theirs package-lock.json && npm install`.
- Never commit `.env.local`, raw imagery, or rasters.

## Honesty rules (apply to every screen and every prompt)

- Scores compare blocks with each other. They are not official assessments. Show the source and date under each score.
- The heat score is the **ground surface** temperature on one summer day. Live weather is **air** temperature. Never mix the two or label one as the other.
- Green cover comes from leaf-off spring photos. Call it "green cover," not "tree canopy."
- An address outside the demo area gets "coverage coming soon," never a made-up score.
- Every live value shows its source and when it was fetched. If a live source fails, hide the card. Never show mock live data.
- The AI may only cite programs from `data/programs/` and facts we pass it. It must never invent programs, phone numbers, dollar amounts, or eligibility rules.
- Mock or illustrative content is always labeled, and has no invented numbers.

## Team

| Person | Role | Name |
|---|---|---|
| 1 | Frontend + demo video | [NAME] |
| 2 | Data pipeline (green cover + heat) | [NAME] |
| 3 | Backend API + live data APIs + AI + Kiro | [NAME] |
