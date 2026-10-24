# ClimateCheck MA

**Type a Boston address. See your block from above, how hot its ground got on a summer day, how green it is, what's happening there right now, and which real Massachusetts programs can help you.**

Built in one day at Hackachusetts 2026, Track 3: Climate Tech.

## The problem

On the same summer day, some Boston blocks get far hotter than others. On June 25, 2024, the Landsat 9 satellite measured the ground on our Chinatown demo block at about 13°F hotter than the Boston average, while a block on Perkins St in Jamaica Plain, next to Jamaica Pond, was about 15°F cooler. The free satellite data that shows this exists, but almost nobody can read it. Renters especially don't know which cooling centers, alerts, tree programs, or energy rebates they can use.

## What it does

1. **Search an address** or tap "Use my location."
2. **See your block from above:** the real MassGIS 2025 aerial photo, for any address in Massachusetts, with your home pinned and the scored area outlined.
3. **Read your scores:**
   - **Ground heat:** how hot streets and rooftops got on June 25, 2024, compared with all of Boston (Landsat 9 thermal band).
   - **Green cover:** how much of the block is green (NDVI from the same Landsat image).
   - Each score shows its source and date, and says it's a comparison, not an official assessment.
4. **Right now near you:** live National Weather Service weather and heat alerts, modeled air quality, FEMA flood zone and future flooding with sea level rise, City street trees, and the nearest community centers and libraries for cooling off.
5. **Get an action plan:** choose "I rent" or "I own." The plan uses only programs a person checked on their official pages (cooling centers, AlertBoston, street tree requests, Mass Save, community solar, heat pumps, SMART rooftop solar).
6. **Climate map:** every scored block colored by heat or green cover, on top of the aerial photo.

Scores cover the **City of Boston**: 11,780 blocks (100 m cells) in 24 neighborhoods, from Brighton to Hyde Park. West Roxbury and the Harbor Islands are not scored (`EXCLUDED_NEIGHBORHOODS` in `pipeline/config.py`). Anywhere else, the report still shows the aerial photo and live conditions, and says "Coverage coming soon" in place of scores. It never shows an estimated score.

## Demo addresses

| Neighborhood | Heat score (0-100, higher = hotter) | Ground vs. Boston average | Green cover score (higher = greener) |
|---|---|---|---|
| Chinatown (Hudson St) | 97 | about 13°F hotter | 5 |
| East Boston (Meridian St) | 94 | about 11°F hotter | 5 |
| Beacon Hill (72 Beacon St) | 43 | about the same | 39 |
| Jamaica Plain (Perkins St) | 8 | about 15°F cooler | 78 |

Use the demo buttons on the home page.

## How it works

```
Offline (Python, pipeline/)                         Online (Next.js 16, app/ + lib/)
Landsat 9 scene (June 25, 2024)                     Browser ──► /api/geocode ─► US Census → Nominatim
  ST_B10 surface temp + SR_B4/B5 + QA_PIXEL               ──► /api/score, /api/grid ◄── data/scores/
  ─► 100 m grid over all of Boston                        ──► /api/live ─► NWS, Open-Meteo, FEMA,
  ─► percentile ranks ─► data/scores/*.geojson                              Climate Ready Boston, Analyze Boston
                                                          ──► /api/action-plan ─► Claude (forced JSON)
data/programs/*.json (checked by a person) ───────────────►                     └► validator ─► rules fallback
MassGIS 2025 aerial tiles ──────────────────────────► browser map + report photo (display only)
```

- **Scores only come from the pipeline files.** The app never computes, adjusts, or guesses a score. Live data adds context and never changes a score.
- **Every external call runs on the server**, with timeouts and caching. A failing source hides its card. It is never replaced with fake data.
- **The AI can't make things up.** The action plan must cite program ids from `data/programs/`. Links come from our records, not from the model. Any phone number, dollar amount, email, or URL that isn't in our program data or live facts gets the plan rejected, and the rule-based plan is used instead. The app works with no API key.

## Data sources

| What you see | Source | How |
|---|---|---|
| Ground heat score | [USGS Landsat Collection 2 Level-2](https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products), Landsat 9 scene `LC09_L2SP_012031_20240625_02_T1`, June 25, 2024, via Microsoft Planetary Computer | Offline pipeline, `data/scores/` |
| Green cover score | Same Landsat scene, NDVI from surface reflectance bands 4 and 5, threshold 0.3 | Offline pipeline, `data/scores/` |
| Aerial photo of your block | [MassGIS 2025 Aerial Imagery](https://www.mass.gov/info-details/massgis-data-2025-aerial-imagery) tile service, flown March 18 to April 23, 2025 | Loaded in the browser |
| Weather, forecast, heat alerts | [National Weather Service API](https://www.weather.gov/documentation/services-web-api) + [Open-Meteo](https://open-meteo.com/) | Live |
| Air quality (modeled) | [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) (CAMS model) | Live |
| Flood zone, future flooding | FEMA National Flood Hazard Layer + Climate Ready Boston sea level rise maps | Live |
| Street trees, empty planting spots | [City of Boston street tree inventory](https://data.boston.gov/dataset/bprd-trees) | Live |
| Community centers, pools, libraries | [Analyze Boston](https://data.boston.gov/) (BCYF centers and pools, Boston Public Library branches) | Live |
| Boston hot-day trend | Open-Meteo historical weather + CMIP6 climate models | Prebuilt, `data/live/climate_boston.json` |
| Programs in the action plan | boston.gov, masssave.com, masscec.com official pages | Curated `data/programs/`, checked October 24, 2026 |

## Limitations (we say these in the app too)

- **Heat is the ground surface temperature on one summer day**, about 11:30 a.m. on June 25, 2024. It is not the air temperature you feel, and not an average.
- **Green cover pixels are 30 m wide**, so grass, yards, and trees count together. We call it "green cover," not tree canopy.
- **Scores compare blocks with each other** (against all 13,981 Boston cells). They are not official assessments.
- **Scores cover the City of Boston, except West Roxbury and the Harbor Islands.** 672 of the 11,780 scored cells don't have enough clear pixels, and they say so.
- **Air quality is a model estimate**, not a monitor reading. Street tree counts include City trees only.
- The aerial photo was taken in spring, before most trees had leaves. It's for seeing your block. Scores don't come from it.

## Run it

Requirements: Node 20+ and npm. Python 3.11+ only if you want to rebuild the scores.

```bash
git clone https://github.com/nicholasbelous/Hackachusetts.git
cd Hackachusetts
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for AI-written plans
npm run dev                  # http://localhost:3000
```

Everything works without any keys. Without `ANTHROPIC_API_KEY`, the action plan comes from the rule-based version, which cites the same checked programs.

| Command | What it does |
|---|---|
| `npm run check` | Type check, lint, score data validation, and production build (the same checks CI runs) |
| `npm run validate:data` | Checks `data/scores/` against the schema and that sample data is never marked real |
| `npm run check:programs` | Opens every program link and checks its phone numbers, emails, and dollar amounts appear on the page |
| `npm run build:climate` | Rebuilds the Boston hot-day trend (about 2 minutes) |

Rebuild the scores from the Landsat scene: see [`pipeline/README.md`](pipeline/README.md) (`smoke_test.py` → `boston_boundary.py` → `fetch_landsat.py` → `build_grid.py` → `npm run validate:data`).

### Environment variables

| Variable | Needed? | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | AI-written action plans. Without it, the rule-based plan is used |
| `CLAUDE_MODEL` | No | Default `claude-haiku-5-5` |
| `GEOCODER_PROVIDER` | No | `census` (default, with Nominatim fallback) or `nominatim` |
| `GEOCODER_USER_AGENT` | Recommended | Identifies the app to Nominatim and the National Weather Service |
| `NEXT_PUBLIC_BASEMAP_TILE_URL` | No | MassGIS 2025 aerial tiles by default |
| `LIVE_DATA_ENABLED` | No | `false` turns off every live call, for an offline demo |
| `SCORES_DIR` | Testing only | Points the app at a different score grid |
| `ALLOW_UNVERIFIED_PROGRAMS` | Development only | Shows programs nobody has checked yet |

## How we used Kiro

We built the whole project in Kiro, with three people working in parallel on the frontend, the data pipeline, and the backend.

- **Steering files** ([`.kiro/steering/`](.kiro/steering/)) hold the rules every Kiro session on the team followed:
  - `product.md`: who the users are, the 8th-grade reading level, and our honesty rules. Heat is "the ground," never "the air." Never show a made-up score. The AI may only cite checked programs. The photo is an "aerial photo," never a "satellite image."
  - `data.md`: the Landsat formulas, QA masks, coordinate systems, score definitions, and the rules for each live data source.
  - `tech.md` and `structure.md`: the stack, conventions, and who owns which files, so parallel Kiro sessions didn't overwrite each other.
- **Specs** ([`.kiro/specs/`](.kiro/specs/)):
  - `climatecheck-mvp`: requirements in WHEN/SHALL form, a design with every API contract and the AI output schema, and numbered tasks that match `TODO (task X.Y)` comments in the code.
  - `landsat-data-pipeline`: the pipeline was built spec-first (requirements → design → tasks). Its property-based tests (Hypothesis) caught a 0-D scalar bug in the QA mask and NDVI functions before any real data ran.
- **Hooks** ([`.kiro/hooks/`](.kiro/hooks/)):
  - Saving or creating a file in `data/scores/` runs the score validator, so sample data can never be marked real.
  - Saving a file in `data/programs/` runs the program fact checker.
- **Agent work we can point to:**
  - Picked the Landsat scene by comparing cloud cover over each neighborhood (June 25, 2024 beat July 30, 2025).
  - Tested every public API against Boston addresses before we built on it.
  - Found and fixed a bug where every map drew blank: Turbopack resolved MapLibre's worker to the wrong file, and MapLibre's CSS collapsed the map to 0 px tall.
  - Audited the merged frontend against our honesty rules: removed invented numbers, fixed "tree canopy" wording, and replaced placeholder flood and air tiles with live data.
  - Added a GitHub Actions CI workflow that runs the same checks as `npm run check`.

## Project layout

```
app/            Pages (/, /map, /report, /about) and API routes (app/api/)
components/     UI components
lib/            Server logic: scores, geocoder, programs, Claude client, validators, live data sources
data/scores/    Pipeline output (real Landsat scores)
data/programs/  Checked Massachusetts programs (the only programs the AI may cite)
data/live/      Prebuilt Boston climate trend
pipeline/       Python Landsat pipeline + tests
.kiro/          Steering, specs, hooks
docs/           Team plan from hackathon day
```

`Initial-Kiro-Design/` is an earlier FastAPI + Vite prototype, kept for reference only.

## Team

| Role | Name |
|---|---|
| Frontend + demo video | [NAME] (landing page redesign: Mohammed Komou) |
| Data pipeline (Landsat heat + green cover) | [NAME] (GitHub: Oliverdhz) |
| Backend, live data, AI, Kiro | [NAME] (GitHub: nicholasbelous) |
