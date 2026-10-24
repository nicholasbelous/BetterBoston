# [PROJECT_NAME] (working name: ClimateCheck MA)

Type a Massachusetts address and get a plain-English climate report for your block: how hot the ground gets on a summer day, how green the block is, and an action plan built only from real Massachusetts programs.

> This README is the team plan for the hackathon. The full write-up (problem, data sources, architecture, limitations, "How we used Kiro") gets filled in during the last hour. See "Final hour" below.

## Where things stand

| Part | Status |
|---|---|
| Next.js config, `.gitignore`, `.env.example` | Done |
| Shared types (`lib/types.ts`) | Done. This is the contract between everyone |
| Pages, components, API routes, `lib/` | Stubs with TODO comments that point to task numbers |
| `pipeline/`, `data/scores/`, `data/programs/` | Not created yet |
| `.kiro/steering/`, `.kiro/specs/`, hooks | Not created yet |
| `Initial-Kiro-Design/` | Earlier FastAPI + Vite prototype. Reference only, not part of the app. Copy useful pieces out of it |

## Quick start (everyone, first 15 minutes)

```bash
git clone https://github.com/nicholasbelous/Hackachusetts.git
cd Hackachusetts
npm install
cp .env.example .env.local      # fill in AWS keys later (Person 3)
npm run dev                     # http://localhost:3000
```

Python pipeline (Person 2):

```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Known issue: `lib/*.ts` imports `server-only`, but it isn't in `package.json` yet. Person 3 fixes this first (`npm install server-only`).

## Decisions for the first 15 minutes (whole team)

1. **Demo neighborhoods.** Proposed: Chinatown (hot, paved), West Roxbury (green), East Boston (mixed, near water). Confirm before Person 2 downloads tiles.
2. **Leaf-off imagery.** MassGIS flew the 2025 photos between 3/18/2025 and 4/23/2025, before leaf-out. NDVI will undercount trees that drop their leaves. Pick one:
   - Call the score "green cover (spring 2025)", not "tree canopy", and say why on the About page. **(Recommended, honest, no extra work.)**
   - Use a lower NDVI threshold and say so in the metadata. This is still not true summer canopy.
3. **Project name.** Replace every `[PROJECT_NAME]` and `APP_NAME` in `lib/config.ts`.

## Who does what

Three people: one on the frontend, one on the data pipeline, and one on the backend and AI. Each person owns their files. Ask the owner before editing someone else's files.

### Person 1: Frontend — [NAME]

Owns `app/` pages (not `app/api/`), `components/`, `app/globals.css`, `public/`.

- [ ] **1.1 Map.** `components/MapView.tsx` with MapLibre and the MassGIS 2025 basemap from `NEXT_PUBLIC_BASEMAP_TILE_URL`. Add a marker at the address and outline the score cell. Load MapLibre with a dynamic import inside `useEffect`.
- [ ] **1.4 Home page.** `AddressSearch`: calls `GET /api/geocode?q=`, then goes to `/report?lat=&lng=&q=`. "Use my location" uses `navigator.geolocation`. Show friendly errors for "address not found" and "location permission denied."
- [ ] **1.5 Report page.** Calls `lookupScore` and handles all three statuses: `ok`, `no_data`, and `out_of_coverage` (show `CoverageNotice` only, never a fake score). Show `SampleDataBanner` whenever `metadata.is_sample` is true.
- [ ] **ScoreCard + DataSourceNote.** Show the score, a plain label (Low / Moderate / High), a one-line meaning, and the source and date under every score. The heat card must say "ground surface temperature on one summer day, not air temperature." If `heat_score` is `null`, show "heat data coming soon."
- [ ] **4/5 Action plan UI.** A client wrapper holds the renter/owner state. It POSTs `{ cell_id, tenure }` to `/api/action-plan` and renders `ActionPlanList`. Include a loading state. If the call fails, show the plain program list as a fallback.
- [ ] **6.2 About page.** Read the real values from `data/scores/demo_grid.meta.json`.
- [ ] **Polish.** Mobile first: test at 375 px wide. Large tap targets, readable contrast.
- [ ] **7.3 Demo buttons.** 2-3 preloaded addresses on the home page (Person 2 picks them).
- [ ] **After feature freeze:** record the demo video and write the main README sections (see "Final hour").

Reuse from the prototype: `Initial-Kiro-Design/frontend/src/components/Gauge.tsx`, `ScaleBar.tsx`, `ActionCard.tsx`, and the design tokens at the top of `styles.css`. Port them to Tailwind or plain CSS.

You can start right away. Until Person 2's sample grid lands (about hour 1), hard-code a `ScoreCell` that matches `lib/types.ts`.

### Person 2: Data pipeline — sample data, tree score, heat score — [NAME]

Owns all of `pipeline/` and everything in `data/scores/`. Owns the score schema: tell the team before changing the score types in `lib/types.ts`.

This is the longest list, so the order matters. Person 3 picks and downloads the Landsat scene during hour 1 so you don't have to.

- [ ] **First, by hour 1: sample data.** Write `make_sample_data.py` (standard library only). It writes `data/scores/demo_grid.geojson` and `demo_grid.meta.json` exactly matching `ScoreCellProperties` and `ScoreMetadata`, with `is_sample: true`. It refuses to overwrite real data without `--force`. Commit the output. **This unblocks Persons 1 and 3.**
- [ ] **validate_scores.py.** Checks the schema, value ranges (scores 0-100, fractions 0-1), unique `cell_id`s, and that every cell's `is_sample` matches the metadata. Wire it to `npm run validate:data`.
- [ ] **pipeline/config.py + requirements.txt.** Demo bounding boxes, `CELL_SIZE_M = 100`, `NDVI_THRESHOLD`, `PROCESSING_CRS = "EPSG:26919"`, and file paths. Requirements: rasterio, numpy, geopandas, shapely, pyproj.
- [ ] **Download tiles.** Find the tile names with the MassGIS 2025 index service (query by point):
      `https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Color_2025_Aerial_Imagery_Index/FeatureServer/0/query`
      Each tile is a ~20 MB zip of a 4-band JPEG 2000 in UTM 19N. Save them to `pipeline/raw/massgis/` (gitignored). Write the steps in `pipeline/DOWNLOAD.md`.
- [ ] **massgis_ndvi.py.** Read the red and NIR bands with rasterio. Compute `NDVI = (NIR - Red) / (NIR + Red)` as float32, guarding against divide-by-zero. Threshold it into a vegetation mask and write it to `pipeline/work/`. Downsample (e.g. to 1 m) before aggregating, or the 15 cm rasters will be slow.
- [ ] **build_grid.py (trees first).** Make a 100 m grid in EPSG:26919 over the demo areas. Per cell, compute `pct_vegetated` and `tree_valid_frac`. Scores are percentile ranks, 0-100. Set a score to `null` when the valid fraction is below the minimum. Reproject to EPSG:4326, write both files with `is_sample: false`, and run the validator. **Commit real tree scores by hour 3, with heat fields `null` for now.**
- [ ] **landsat_heat.py.** Use the scene Person 3 downloaded. Read `ST_B10` and `QA_PIXEL`. Mask fill, cloud, cloud shadow, and water using the QA bits. Convert: `K = DN * 0.00341802 + 149.0`, then `F = (K - 273.15) * 9/5 + 32`. Reproject to EPSG:26919. Clip to the Boston city boundary, so "compared with the Boston average" stays accurate. Write `pipeline/work/heat_f.tif`, then add the heat fields in `build_grid.py`.
- [ ] **pipeline/README.md.** Exact run order: download, `massgis_ndvi.py`, `landsat_heat.py`, `build_grid.py`, validate.
- [ ] **7.3 Demo addresses.** Pick 2-3 real addresses with clearly different results and send them to Person 1.

**Cut line:** if heat isn't working by 5:00, ship the real tree grid with heat left `null`. The heat card then says "heat data coming soon." Never fill heat with sample numbers in a grid marked real.

Reuse from the prototype: `Initial-Kiro-Design/backend/app/pipeline/trees.py` and `heat.py` have notes.

### Person 3: Backend API + AI action plan + Kiro — [NAME]

Owns `app/api/`, `lib/` (except the score types, which Person 2 owns), `data/programs/`, `.env.example`, and `.kiro/`.

- [ ] **Setup.** `npm install server-only`. Confirm that `npm run build` and `npm run lint` pass on `main`. Request AWS credentials and Bedrock model access now, since access requests can take time.
- [ ] **Hour 1: Landsat scene for Person 2.** Find a Landsat 8/9 Collection 2 Level-2 scene: summer 2024 or 2025, cloud-free over Boston, on a hot, clear day. Sources:
  - [USGS EarthExplorer](https://earthexplorer.usgs.gov/) (free account)
  - Microsoft Planetary Computer STAC, collection `landsat-c2-l2` (no account needed)
  Download `ST_B10` and `QA_PIXEL` to `pipeline/raw/landsat/`. Send Person 2 the scene ID and date.
- [ ] **1.3 Geocoder.** `lib/geocoder.ts` with the US Census geocoder (default) and Nominatim (fallback). Use a 5-second timeout and append ", MA" when the query has no state. Then implement `app/api/geocode/route.ts`.
- [ ] **1.2 Score lookup.** `lib/scores.ts`: load and cache the GeoJSON, do a bounding-box check plus a ray-casting point-in-polygon test, and return `ok`, `no_data`, or `out_of_coverage`. Then implement `app/api/score/route.ts` and `getCellById`.
- [ ] **Kiro steering + hook.** Write `.kiro/steering/` `product.md`, `tech.md`, `structure.md`, and `data.md` early, so Kiro follows the honesty rules for everyone. Add a hook that runs `npm run validate:data` when `data/scores/` changes.
- [ ] **4.1 Program data.** Create `data/programs/cooling_centers.json`, `tree_requests.json`, `mass_save_rebates.json`, and `community_solar.json` (shape: `ProgramFile` in `lib/types.ts`). **Every fact must come from the program's official page.** Set `last_verified` only after a person has checked the facts. Unverified programs are hidden. Leave out any phone number, dollar amount, or eligibility rule you can't confirm. Start from `Initial-Kiro-Design/backend/app/data/programs.json`.
- [ ] **4.2 Prompt.** `lib/actionPlanPrompt.ts`: use only the provided programs, cite them by `id`, invent no numbers or rules, explain that scores are relative and that heat is surface temperature, and write in plain English.
- [ ] **4.3 Bedrock.** `lib/bedrock.ts`: call the Converse API with one forced tool (`submit_action_plan`) so the reply is JSON. `lib/actionPlanSchema.ts`: validate with zod and drop actions with unknown program ids. Copy links from the program record, never from model output. Then implement `app/api/action-plan/route.ts`.
- [ ] **5.1 Renter/owner.** `filterByTenure` so renters get cooling centers, tree requests, and community solar, while owners also get heat pumps, cool roofs, and rooftop solar.
- [ ] **Kiro spec.** Write `.kiro/specs/climatecheck-mvp/` `requirements.md`, `design.md`, and `tasks.md`. Task numbers in the TODO comments (1.1, 1.4, 4.3...) should match `tasks.md`.
- [ ] **Stretch: solar score** (Google Solar API, `GOOGLE_SOLAR_API_KEY`). Only after everything above works.

Reuse from the prototype: `Initial-Kiro-Design/backend/app/services/plan.py` has a prompt and a rule-based fallback.

## Timeline (7 hours)

| Hour | Milestone | Who |
|---|---|---|
| 0:15 | Decisions made, everyone running `npm run dev` | All |
| 1:00 | Sample grid committed. Landsat scene downloaded. Bedrock access requested | P2, P3 |
| 2:00 | Address search → report page with map and sample score cards works end to end | P1, P3 |
| 3:00 | Real tree scores committed (heat still `null`) | P2 |
| 4:30 | Real heat scores in the grid. Action plan endpoint working | P2, P3 |
| 5:30 | **Feature freeze.** Renter/owner toggle and action plan in the UI | P1 |
| 6:30 | Demo addresses tested on a phone. Video recorded. README finished | All |
| 7:00 | Submit | All |

If the real data runs late, demo with the sample grid and keep the "SAMPLE DATA" banner visible. Never remove the banner to make the demo look finished.

## Final hour (5:30 – 7:00)

- **Person 1:** demo video, and the README sections for the problem, how it works, and setup.
- **Person 2:** README sections for data sources (with links), scores and formulas, and limitations (surface vs. air temperature, one summer day, spring leaf-off imagery, demo area only).
- **Person 3:** README sections for architecture, environment variables, and "How we used Kiro" (specs, steering, hooks).

## Handoffs between people

- **`lib/types.ts`** is the contract. Announce changes in team chat before pushing.
- **`data/scores/*`**: only Person 2 commits these files. Run `npm run validate:data` before every commit.
- **Landsat scene** goes from Person 3 to Person 2. Share the raw files by drive or AirDrop, not git, since rasters are gitignored.
- **API contracts** (`GET /api/geocode`, `GET /api/score`, `POST /api/action-plan`) are described in the comments at the top of each route file. Person 1 builds against those shapes.

## Git workflow

- One branch per person (`p1-frontend`, `p2-pipeline`, `p3-api`). Merge to `main` often with small PRs.
- `main` must always run. Run `npm run lint && npm run build` before merging.
- Never commit `.env.local`, raw imagery, or rasters. `.gitignore` already blocks them.

## Honesty rules (apply to every screen and every prompt)

- Scores compare blocks with each other. They are not official assessments. Show the source and date under each score.
- Heat is the ground surface temperature on one summer day, not air temperature.
- An address outside the demo area gets "coverage coming soon," never a made-up score.
- The AI may only cite programs from `data/programs/`. It must never invent programs, phone numbers, dollar amounts, or eligibility rules.

## Team

| Person | Role | Name |
|---|---|---|
| 1 | Frontend + demo video | [NAME] |
| 2 | Data pipeline (trees + heat) | [NAME] |
| 3 | Backend API + AI + Kiro | [NAME] |
