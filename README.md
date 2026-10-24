# [PROJECT_NAME] (working name: ClimateCheck MA)

Type a Massachusetts address and get a plain-English climate report for your block: how hot the ground gets on a summer day, how green the block is, live weather, air, and flood information for that spot, and an action plan built only from real Massachusetts programs.

> This README is the team plan for the hackathon. The full write-up (problem, data sources, architecture, limitations, "How we used Kiro") gets filled in during the last hour. See "Final hour" below.

## Where things stand

| Part | Status |
|---|---|
| Next.js app, config, `.env.example`, shared types | Done |
| Backend API: `/api/geocode`, `/api/score`, `/api/grid`, `/api/action-plan` (Person 3) | Done. The action plan uses the rules fallback until `ANTHROPIC_API_KEY` is set, and needs programs verified |
| Frontend: `/`, `/map`, `/report`, `/actions`, `/improvements`, `/about` (Person 1) | Merged. Calls the real APIs, falls back to labeled mocks. Fixes needed, see Person 1's list |
| Sample score grid + validator (Person 2) | Done: 944 SAMPLE cells in Chinatown, West Roxbury, East Boston. `npm run validate:data` passes |
| Real scores: NDVI + Landsat heat pipeline (Person 2) | **Not started.** Landsat scene is downloaded. This is the biggest demo risk |
| Program data, `data/programs/` (Person 3) | 8 programs drafted from official pages. `npm run check:programs` passes (all links load, all facts found on their pages). **A person still has to set `last_verified`**. Until then `/api/action-plan` returns 503 `no_programs` |
| Live data: `/api/live` with weather + heat alerts, air quality, flood, street trees, cooling places, area, and climate (Person 3) | **Done.** Tested for all 3 neighborhoods plus outside Boston and outside MA. Person 1 builds the cards (contract in Person 3's section) |
| Kiro: steering, spec, hooks in `.kiro/` | Done |
| `Initial-Kiro-Design/` | Old FastAPI + Vite prototype. Reference only, excluded from lint and tsc |

### Where the numbers come from (no AI makes up a score)

| What the user sees | Source | Type |
|---|---|---|
| Heat score | Landsat 9, June 25, 2024, through our pipeline | Offline, `data/scores/` |
| Green cover score | MassGIS 2025 aerial photos (NDVI), through our pipeline | Offline, `data/scores/` |
| Today's weather, 7-day outlook, heat alerts | National Weather Service + Open-Meteo | Live, `/api/live` |
| Air quality | Open-Meteo Air Quality API (modeled) | Live, `/api/live` |
| Flood zone + future sea-level-rise flooding | FEMA flood maps + Climate Ready Boston | Live, `/api/live` |
| Street trees + empty planting spots nearby | City of Boston street tree inventory (BPRD Trees) | Live, `/api/live` |
| Nearest community centers, pools, libraries | Analyze Boston (BCYF centers, pools, BPL branches) | Live, `/api/live` |
| Neighborhood + census tract context | BPDA boundaries + Climate Ready Boston Social Vulnerability | Live, `/api/live` |
| Boston hot days: last summer, 1991-2020, 2031-2050 | Open-Meteo historical + CMIP6 climate models | Prebuilt, `data/live/climate_boston.json` |
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
- [ ] **Map colors.** `MapScreen` always colors `MOCK_GRID`, so the colors contradict the score cards. Color the map from `GET /api/grid` (ready now) and drop `MOCK_GRID`. Make the `selected-outline` layer match real `cell_id`s.
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
- [ ] **Live data cards.** One call to `GET /api/live?lat&lng` returns everything. The full contract, fields, and required labels are in "Live data contract" under Person 3.
  - [ ] Weather card: today's high and "feels like" from `weather` in `/api/live`, labeled **"Air temperature today (National Weather Service)"** so it's never confused with the ground-temperature score.
  - [ ] Heat alert banner: if `weather.data.heat_alert` is true, show it at the top of every screen with a link to the cooling centers action.
  - [ ] Replace the mock **Air Quality** tile with `air` from `/api/live` (US AQI plus a plain category like "Moderate"). Label it "Modeled estimate (Open-Meteo)."
  - [ ] Replace the mock **Flood Risk** tile with `flood` from `/api/live`. Show the FEMA zone ("Zone X: minimal flood hazard") and the Climate Ready Boston future-flooding result ("Could flood in a 1% storm with 21 inches of sea level rise"). Remove the "Sample" tag once it's real.
  - [ ] Street trees card from `trees`: "23 City street trees within 100 m · 4 empty planting spots." Add a caption: "Counts City-owned street trees only, not yard or park trees."
  - [ ] Nearest community centers, pools, and libraries from `places`, inside the cooling centers action, with distance and address. Add the caption: "Open as cooling centers during declared heat emergencies."
  - [ ] "Boston is getting hotter" card from `climate`: last summer's 90°F+ days vs. the 1991-2020 average vs. the 2031-2050 projection range. This is the strongest closing line for the demo.
  - [ ] 7-day outlook chips from `weather.data.daily`, highlighting days at 90°F or more.
  - [ ] Every live card shows its source and "Updated <time>." Hide the card when its source is `ok: false`. Never show mock live data.
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

Owns `app/api/`, `lib/` (except the score fields), `data/programs/`, `data/live/`, `scripts/`, `.env.example`, and `.kiro/`.

**Done: core API**
- [x] Switched from Bedrock to the Anthropic API (`lib/claude.ts`, forced tool call → JSON).
- [x] Landsat scene picked (June 25, 2024, under 1% cloud over Boston) and downloaded to `pipeline/raw/landsat/`.
- [x] `GET /api/geocode`: Census → Nominatim fallback, ", MA" bias, 5-second timeouts.
- [x] `GET /api/score`: point-in-polygon lookup returning `ok` / `no_data` / `out_of_coverage`. Reloads when the files change.
- [x] `GET /api/grid`: every score cell (trimmed) + metadata, so Person 1 can color the map with real cells (~330 KB).
- [x] `POST /api/action-plan`:
  - zod validation; rejects unknown program ids and invented phone numbers, dollar amounts, emails, and URLs
  - rules fallback when Claude is unavailable or its answer fails the checks
  - per-cell cache
  - live facts included (see below)
- [x] 8 programs drafted from official pages in `data/programs/`. `npm run check:programs` confirms all 8 links load and every phone number, email, and dollar amount appears on its page.
- [x] Kiro steering (4 files, including live data rules), spec (requirements, design with every route contract, tasks), and two validation hooks.

**Done: live data layer** (`lib/live/`, all free, no keys). Tested for Chinatown, West Roxbury, East Boston, Worcester (MA, outside Boston), and New York (outside MA).
- [x] `lib/live/http.ts`: JSON fetch with timeout + User-Agent, TTL cache with in-flight de-duplication, ArcGIS point helpers, Massachusetts bounds check.
- [x] **weather:** National Weather Service latest observation (nearest station), forecast periods, and active alerts with a `heat_alert` flag (handles the 2025 "Excessive → Extreme Heat" rename). Plus Open-Meteo 7-day highs, "feels like" highs, UV, and hot days (90°F+) in the next 7.
- [x] **air:** Open-Meteo US AQI, EPA category, PM2.5, ozone, main pollutant, and worst AQI in the next 24 h. Always marked `modeled: true`.
- [x] **flood:** FEMA flood zone and high-risk flag, plus Climate Ready Boston future flooding at 9, 21, and 36 inches of sea level rise (high tide, 10% storm, 1% storm). Example: Chinatown is FEMA Zone X today, but a 1% storm floods it with 21 inches of sea level rise.
- [x] **trees:** City street trees within 100 m, **empty planting sites** (spots where the City could plant), top species, and trunk-size mix. Example: Chinatown has 23 trees and 4 empty sites.
- [x] **places:** nearest 3 BCYF community centers, BCYF pools, and library branches, with straight-line miles. Example: Chinatown's nearest community center is Quincy (0.3 mi) and its nearest library is the Chinatown branch (0.2 mi).
- [x] **area:** Boston neighborhood (BPDA), plus census tract shares of older adults, children under 5, low-to-no income, and disability (Climate Ready Boston, 2008-2012 ACS).
- [x] **climate:** Boston hot days (90°F+): 13 in summer 2026 (hottest 99°F on July 3), about 8.5 a year in 1991-2020, and a median of 14.4 a year for 2031-2050 across 7 models (range 8.3-15.8). These are prebuilt by `npm run build:climate`, because long climate series hit Open-Meteo's free-tier limits.
- [x] `GET /api/live?lat&lng` (all sources in one call, ~1-2 s cold, instant cached) and `GET /api/live/<source>?lat&lng`.
- [x] **The action plan uses live facts.** A `<live_conditions>` block goes into the prompt, and the validator allows only facts that appear in the program data or the live data. For example, a center's phone with an added area code gets rejected. The rules plan puts cooling centers + AlertBoston first and leads with the warning when NWS has a heat alert, names the nearest community center, and cites empty tree planting sites. `ActionPlan.live_sources_used` lists the sources used.
- [x] `LIVE_DATA_ENABLED=false` turns off every live call for an offline demo.

**Still to do: only a person can do these**
- [ ] **Verify the 8 programs (~15 min).** Run `npm run check:programs`, then open each link, read each sentence, and set `last_verified` to today (`YYYY-MM-DD`). Until then `/api/action-plan` returns 503 `no_programs`. For local testing, use `ALLOW_UNVERIFIED_PROGRAMS=true` in `.env.local`.
- [ ] **Add `ANTHROPIC_API_KEY`** to `.env.local`. Restart `npm run dev` and confirm `source: "ai"` for a Chinatown cell.
- [ ] **Check AI output.** Read 5-10 plans (both tenures, all 3 neighborhoods). Every program name and number must appear in `data/programs/` or the live data. Tighten the prompt in `lib/actionPlanPrompt.ts` if anything drifts.
- [ ] **Hand Person 1 the contracts below** and help wire the first live card (weather + heat alert).
- [ ] Before the demo, run `npm run build:climate` once more (about 2 min) so "last summer" is current.

**Stretch (only if everything above is done)**
- [ ] `GET /api/live/solar`: Google Solar API (`buildingInsights:findClosest`, needs `GOOGLE_SOLAR_API_KEY`). Show it for owners only. (NREL PVWatts timed out from our network, so skip it.)
- [ ] EPA AirNow monitor readings next to the modeled AQI (free key, `AIRNOW_API_KEY`).
- [ ] Prefetch `/api/live` for the 3 demo addresses right before recording, so every card loads instantly.

**Final hour**
- [ ] README sections: architecture, environment variables, and "How we used Kiro." Drafts are in "Write-up drafts" below.
- [ ] Help Person 1 record the demo video. Follow the demo script below.

#### Live data contract (for Person 1)

`GET /api/live?lat=42.3498&lng=-71.0603` returns one object with seven sources. Each source looks like this:

```ts
{ ok: true,  data: {...}, sources: [{ name, url }], fetched_at: "2026-10-24T19:05:00Z", note?: "..." }
{ ok: false, error: "outside_coverage" | "unavailable" | "disabled", message: "..." }   // hide the card
```

| Card | Field(s) | Show as | Required label |
|---|---|---|---|
| Heat alert banner (top of every screen) | `weather.data.heat_alert`, `weather.data.alerts[].event` | "Heat Advisory in effect (National Weather Service)" + link to the cooling centers action | Source + time |
| Weather today | `weather.data.forecast[0]`, `observed.temperature_f`, `daily[0].feels_like_high_f`, `current_uv_index` | "Today: 60°F, Sunny · Feels like 58°F · UV 3" | **"Air temperature (National Weather Service)."** Never next to the heat score without this label |
| Hot days this week | `weather.data.hot_days_next_7`, `daily[]` | 7 small day chips, highlighted when `high_f >= 90` | "Forecast (Open-Meteo)" |
| Air quality (replaces the mock tile) | `air.data.us_aqi`, `category`, `max_category_next_24h` | "AQI 65 · Moderate" with the EPA color | **"Modeled estimate (Open-Meteo)"** |
| Flood (replaces the mock tile) | `flood.data.fema_zone`, `fema_zone_description`, `fema_high_risk`, `first_flooded_at_in`, `future[]` | "FEMA Zone X: minimal flood hazard today. Could flood in a 1-in-100-year storm with 21 inches of sea level rise." | "FEMA + Climate Ready Boston" |
| Street trees | `trees.data.tree_count`, `empty_planting_sites`, `top_species[0].name` | "23 City street trees within 100 m · 4 empty planting spots · Most common: Ginkgo" | **"City street trees only, not yard trees"** |
| Places to cool off | `places.data.community_centers[]`, `libraries[]`, `pools[]` | Name, address, "0.3 mi" | **"BCYF centers open as cooling centers during declared heat emergencies. Check boston.gov/heat."** Phone exactly as given |
| Boston is getting hotter | `climate.data.baseline_days_90f_per_year`, `last_summer.days_90f_or_more`, `projection.median_days_future`, `range_days_future` | "Boston had 13 days of 90°F+ in 2026. The 1991-2020 average was about 8.5. Models project about 14 a year by 2031-2050 (range 8-16)." | "Boston-area air temperature, from weather and climate models" |
| Who lives here (optional) | `area.data.neighborhood`, `area.data.tract.pct_*` | "Older adults: 13.8% of this census tract" | "2008-2012 census estimates (Climate Ready Boston). Describes the tract, not your household" |

`GET /api/grid` returns every cell with `heat_score`, `tree_score`, `temp_diff_f`, `pct_vegetated`, and `is_sample`, so you can replace `MOCK_GRID` in `MapScreen`. `ActionPlan` now includes `source` (`"ai"` or `"rules"`) and `live_sources_used`.

---

## Timeline (7 hours)

| Hour | Milestone | Who |
|---|---|---|
| 0:15 | Decisions made, everyone running `npm run dev` | All ✅ |
| 1:00 | Sample grid committed. Landsat scene downloaded | P2, P3 ✅ |
| 2:00 | Address search → map → report works end to end on sample data | P1, P3 ✅ |
| 3:00 | Real green cover scores committed (heat `null`). Programs verified. `/api/grid` merged ✅ | P2, P3 |
| 4:00 | All live data routes merged ✅. Frontend default location and map colors fixed | P3, P1 |
| 4:30 | Real heat scores in the grid. AI plan working with a key | P2, P3 |
| 5:30 | **Feature freeze.** Live data cards and honesty fixes in the UI | P1 |
| 6:30 | Demo addresses tested on a phone. Video recorded. README finished | All |
| 7:00 | Submit | All |

If real data runs late, demo with the sample grid and keep the "SAMPLE DATA" banner visible. Never remove a banner to make the demo look finished.

## Final hour (5:30 – 7:00)

- **Person 1:** demo video, plus the README sections for the problem, how it works, and setup.
- **Person 2:** README sections for data sources (with links), scores and formulas, and limitations (surface vs. air temperature, one summer day, spring leaf-off imagery, demo area only).
- **Person 3:** README sections for architecture, environment variables, and "How we used Kiro."

## Demo script (2 minutes, built to win)

1. **The problem (15 s).** On June 25, 2024, Landsat measured the ground around Chinatown at about 109°F, versus about 102°F in West Roxbury. That's an 8°F gap across one city on one day. But nobody can read a satellite thermal image, and renters especially don't know what help exists.
2. **Chinatown (40 s).** Type the demo address. Show:
   - the aerial photo of the block
   - the heat score: the ground got hotter than most of Boston on June 25, 2024. Point at the "ground, not air" label.
   - low green cover
   - the live cards: today's NWS weather, AQI, the FEMA zone plus future flooding at 21 inches of sea level rise, nearby street trees with **empty planting spots** (near 50 Hudson St: 23 trees, 4 empty spots), and the nearest community center (Quincy, 0.3 mi)
3. **Renter → owner (20 s).** Flip the toggle. The plan changes: renters get cooling centers, tree requests, and community solar; owners also get heat pumps and rooftop solar. Every action links to a real, verified Massachusetts program.
4. **West Roxbury (20 s).** Cooler ground, much greener, a different plan. Same honesty labels.
5. **Why trust it (15 s).**
   - Scores come from our own satellite pipeline, and every source and date is shown.
   - The AI can only cite verified programs and facts we fetched. Invented phone numbers or dollar amounts get rejected automatically.
   - Out-of-area addresses get "coverage coming soon," never a fake score.
6. **Boston is getting hotter (10 s).** 13 days of 90°F+ in summer 2026, against about 8.5 a year in 1991-2020. Climate models project a median of about 14 a year for 2031-2050. That's why this matters.

**If something fails live:** live cards hide themselves, and the action plan falls back to the rules version. Set `LIVE_DATA_ENABLED=false` for a fully offline run.

## Write-up drafts (finish in the final hour)

### Architecture

```
Offline (Python, pipeline/)                    Online (Next.js, app/ + lib/)
Landsat 9 ST_B10 ─┐                            Browser ──► /api/geocode  ─► Census → Nominatim
MassGIS 2025 NIR ─┴► 100 m grid ─► data/scores ─► /api/score, /api/grid
                                                       ──► /api/live    ─► NWS, Open-Meteo, FEMA,
data/programs (verified) ─────────────────────────►        Climate Ready Boston, Analyze Boston
                                                       ──► /api/action-plan ─► Claude (forced JSON)
                                                                              └► validator ─► rules fallback
```

- Scores come only from the pipeline files. Live data adds context and never changes a score.
- Every external call runs server-side, with timeouts and an in-memory cache. A failing source hides its card instead of breaking the page.
- The AI writes only the plan text. It must cite a verified program `id`. Links come from our records, and any phone number, dollar amount, email, or URL not found in our data gets the plan rejected.

### Environment variables

| Variable | Needed? | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | For the AI plan | Without it, the rules plan is used |
| `CLAUDE_MODEL` | No | Default `claude-haiku-5-5` |
| `GEOCODER_PROVIDER` | No | `census` (default, with Nominatim fallback) or `nominatim` |
| `GEOCODER_USER_AGENT` | Recommended | Identifies us to Nominatim and NWS, as their usage policies require |
| `NEXT_PUBLIC_BASEMAP_TILE_URL` | No | MassGIS 2025 aerial tiles by default |
| `LIVE_DATA_ENABLED` | No | `false` turns off all live API calls |
| `ALLOW_UNVERIFIED_PROGRAMS` | Dev only | Shows programs whose `last_verified` is null |
| `SCORES_DIR` | Testing only | Points the app at a different score grid |
| `GOOGLE_SOLAR_API_KEY` | Stretch | Solar card |

### How we used Kiro

- **Steering** (`.kiro/steering/`): `product.md` holds the honesty rules and the 8th-grade reading level, `data.md` the formulas, CRS handling, and live data rules, `tech.md` the stack and conventions, and `structure.md` the ownership map. Every Kiro request on the team followed them.
- **Spec** (`.kiro/specs/climatecheck-mvp/`): requirements in WHEN/SHALL form, a design with every API contract and the prompt/output schema, and tasks numbered to match the `TODO (task X.Y)` comments in the code.
- **Hooks** (`.kiro/hooks/`): saving or creating a file in `data/scores/` runs the schema validator, so SAMPLE data can never be marked real.
- **Agents:** Kiro scaffolded the repo, picked and downloaded the cloud-free Landsat scene by checking cloud cover over each neighborhood, tested every public API against Boston addresses before we built on it, audited the merged frontend against the honesty rules, and resolved our merge conflict.

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
