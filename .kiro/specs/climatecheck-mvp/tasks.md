# Implementation plan

Ordered so the smallest working demo comes first. Task numbers match the `TODO (task X.Y)` comments in the code. Owner in brackets: P1 frontend, P2 pipeline, P3 backend + AI.

## 1. App runs with SAMPLE grid data

- [ ] 1.0 [P2] Write `pipeline/make_sample_data.py` and commit SAMPLE `data/scores/` files (`is_sample: true` everywhere). Write `pipeline/validate_scores.py` and wire it to `npm run validate:data`.
  - _Requirements: 5.2_
- [ ] 1.1 [P1] `components/MapView.tsx`: MapLibre with the MassGIS 2025 basemap, an address marker, and the cell outline.
  - _Requirements: 2.1, 2.2, 2.3_
- [x] 1.2 [P3] `lib/scores.ts` + `GET /api/score`: load and cache the grid, run point-in-polygon, return `ok` / `no_data` / `out_of_coverage`. Add `getCellById`.
  - _Requirements: 5.1, 5.3_
- [x] 1.3 [P3] `lib/geocoder.ts` + `GET /api/geocode`: Census, then Nominatim fallback, ", MA" bias, timeouts.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_
- [ ] 1.4 [P1] Home page: `AddressSearch` with loading and error states, plus "use my location."
  - _Requirements: 1.1, 1.4, 1.5, 1.6_
- [ ] 1.5 [P1] Report page: handle the three lookup statuses. Add `ScoreCard`, `DataSourceNote`, `CoverageNotice`, and `SampleDataBanner`.
  - _Requirements: 3.1-3.4, 4.1-4.4, 5.1, 5.2_

## 2. Real green cover (NDVI) score

- [ ] 2.1 [P2] `pipeline/config.py`: demo bounding boxes, `CELL_SIZE_M`, `NDVI_THRESHOLD`, CRS, paths. Write `pipeline/requirements.txt`.
- [ ] 2.2 [P2] Download the MassGIS 2025 JP2 tiles for the demo neighborhoods (index feature service). Write the steps in `pipeline/DOWNLOAD.md`.
- [ ] 2.3 [P2] `massgis_ndvi.py`: NDVI, threshold, downsample.
- [ ] 2.4 [P2] `build_grid.py` with tree fields only (heat fields `null`). Write real files with `is_sample: false`, then validate.
  - _Requirements: 4.1, 5.3_

## 3. Real Landsat heat score

- [x] 3.1 [P3] Pick and download the scene: `LC09_L2SP_012031_20240625_02_T1` (June 25, 2024). Files are in `pipeline/raw/landsat/`.
- [ ] 3.2 [P2] `landsat_heat.py`: ST_B10 → °F, QA_PIXEL mask, reproject EPSG:32619 → EPSG:26919, Boston mean.
- [ ] 3.3 [P2] Add the heat fields in `build_grid.py`, then re-validate.
  - _Requirements: 3.1, 3.4_
- [ ] 3.4 [P2] Cut line: if heat isn't working by 5:00, ship the real tree grid with heat `null`.

## 4. AI action plan from curated programs

- [x] 4.1 [P3] `data/programs/*.json` drafted from official pages, plus `lib/programs.ts` (zod-validated, hides unverified).
  - _Requirements: 6.2, 6.7_
- [ ] 4.1b [P3] **A person verifies every program**: open each link, check each fact, set `last_verified`. Until then, use `ALLOW_UNVERIFIED_PROGRAMS=true` locally.
  - _Requirements: 6.7_
- [x] 4.2 [P3] `lib/actionPlanPrompt.ts`: system and user prompt.
  - _Requirements: 6.1, 6.6_
- [x] 4.3 [P3] `lib/claude.ts`, `lib/actionPlanSchema.ts`, `lib/actionPlanRules.ts`, and `POST /api/action-plan`: forced tool JSON, validation, invented-fact check, rules fallback, cache.
  - _Requirements: 6.1-6.5, 6.8_
- [ ] 4.3b [P3] Add `ANTHROPIC_API_KEY` to `.env.local`. Read 5-10 AI plans and check that every name and number in them is in the program data.
- [ ] 4.4 [P1] `ActionPlanList`: loading state, "Written by AI from our checked program list" label only when `source === "ai"`, sample-data note, and an error state.
  - _Requirements: 6.1, 5.2_

## 5. Renter/owner toggle

- [x] 5.1 [P3] `filterByTenure` + per-tenure ordering in the rules plan.
  - _Requirements: 7.2, 7.3_
- [ ] 5.2 [P1] `TenureToggle` UI (radiogroup, renter default) that triggers a new plan request.
  - _Requirements: 7.1, 7.4_

## 5b. Live data (public APIs, no AI)

- [x] 5.3 [P3] `GET /api/grid` for real map colors.
- [x] 5.4 [P3] `lib/live/http.ts`: `fetchJson` with timeout and User-Agent, TTL cache with in-flight de-duplication, ArcGIS point helpers, Massachusetts bounds check.
- [x] 5.5 [P3] Sources: `weather` (NWS + Open-Meteo), `air` (Open-Meteo AQ), `flood` (FEMA + Climate Ready Boston), `trees` (BPRD), `places` (BCYF centers, pools, BPL), `area` (BPDA + Social Vulnerability), `climate` (prebuilt Open-Meteo history and projections).
- [x] 5.6 [P3] `GET /api/live` (bundle) and `GET /api/live/[source]`.
- [x] 5.7 [P3] Live facts in the action plan: `<live_conditions>` prompt block, validator corpus, live-aware rules plan, `live_sources_used`.
- [x] 5.8 [P3] `npm run check:programs` (link and fact checker) and `npm run build:climate`.
- [ ] 5.9 [P1] Live data cards: weather and heat alert banner, air quality tile, flood tile, street trees, nearest cooling places, climate trend. Each shows its source and time, and hides when `ok: false`.
- [ ] 5.10 [P1] Map colors from `/api/grid` instead of `MOCK_GRID`.

## 6. Polish

- [ ] 6.1 [P1] Mobile pass at 375 px wide: tap targets, contrast, colors for the heat and green cards.
- [ ] 6.2 [P1] About page reads `demo_grid.meta.json`: sources, dates, thresholds, limitations.
  - _Requirements: 8.1, 8.2_
- [x] 6.3 [P3] Kiro steering, spec, and hooks (`.kiro/`). Draft README sections for architecture, environment variables, and "How we used Kiro."

## 7. Stretch

- [ ] 7.1 [P3] Solar card with the Google Solar API, server-side, shown only when the key is set.
  - _Requirements: 9.1, 9.2_
- [ ] 7.2 [All] Feature freeze at 5:30. Test on a phone.
- [ ] 7.3 [P2 → P1] Preload 2-3 demo addresses with contrasting results. Check each geocoded label: Census can match a similar street in a different neighborhood.
