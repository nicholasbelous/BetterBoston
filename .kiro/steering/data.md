# Data sources, score definitions, and rules

## Sources

| Data | Source | Used for |
|---|---|---|
| Land surface temperature | [USGS Landsat Collection 2 Level-2](https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products), band `ST_B10` + `QA_PIXEL` | Heat score |
| Surface reflectance (red + NIR) | Same Landsat scene (C2 L2 SR bands), 30 m | Green cover score (decided by the pipeline spec: summer, leaf-on, `leaf_off: false`) |
| Aerial photo tiles (RGB only) | MassGIS 2025 Aerial Imagery tile service on ArcGIS Online. Statewide; returns 404 outside Massachusetts | Map screen and report photo (display only) |
| Programs | Curated JSON in `data/programs/`, from official pages (boston.gov, masssave.com, masscec.com, mass.gov) | Action plan |

### Chosen Landsat scene

- `LC09_L2SP_012031_20240625_02_T1`: Landsat 9, **June 25, 2024**, overpass about 11:26 a.m. EDT, WRS-2 path 12 / row 31.
- Under 1% cloud over Boston land. Clear over Chinatown, West Roxbury, and East Boston. Boston's daily high that day was about 89°F.
- It was chosen over July 30, 2025 because that scene had 6-9% cloud over West Roxbury and East Boston.
- Native CRS: **EPSG:32619** (WGS 84 / UTM 19N), 30 m pixels.

### MassGIS 2025 imagery

- Flown **March 18 to April 23, 2025**, leaf-off, so NDVI undercounts deciduous trees. Call the score "green cover."
- Native CRS: **EPSG:26919** (NAD83 / UTM 19N) for Boston tiles. Find tiles with the `Color_2025_Aerial_Imagery_Index` feature service.

## Formulas

**Surface temperature (Landsat C2 L2 ST_B10):**

```
Kelvin     = DN * 0.00341802 + 149.0
Fahrenheit = (Kelvin - 273.15) * 9/5 + 32
```

Mask out `QA_PIXEL` bits 0 (fill), 1 (dilated cloud), 3 (cloud), 4 (cloud shadow), and 7 (water).

**NDVI (MassGIS):**

```
NDVI = (NIR - Red) / (NIR + Red)      # float32, skip pixels where NIR + Red == 0
vegetated = NDVI > NDVI_THRESHOLD     # configurable in pipeline/config.py
```

## Grid and scores

- Grid cells are about 100 m (`CELL_SIZE_M`, configurable), built in **EPSG:26919**. Reproject Landsat from EPSG:32619 to EPSG:26919 before aggregating.
- Output GeoJSON is **EPSG:4326** (lon/lat), as the GeoJSON spec requires.
- Per cell:
  - `mean_surface_temp_f`: mean °F of valid Landsat pixels
  - `temp_diff_f` = `mean_surface_temp_f` − reference mean (`metadata.heat.reference_mean_f`). Positive means hotter.
  - `pct_vegetated`: percent of valid aerial pixels above the NDVI threshold, 0-100
  - `heat_score`: percentile rank of `mean_surface_temp_f` among cells in the reference area, 0-100. **Higher = hotter.**
  - `tree_score`: percentile rank of `pct_vegetated`, 0-100. **Higher = greener.**
  - `heat_valid_frac` / `tree_valid_frac`: share of usable pixels, 0-1
- If a valid fraction is below `min_valid_frac`, that score is `null`. The app shows "not enough clear data."
- Reference areas: heat is compared with **Boston** (citywide mean from the same scene). Green cover is compared with the processed demo neighborhoods. Both are recorded in the metadata.

## Files

- `data/scores/demo_grid.geojson`: FeatureCollection of Polygon cells. Properties follow `ScoreCellProperties` in `lib/types.ts`.
- `data/scores/demo_grid.meta.json`: follows `ScoreMetadata` (scene id and date, sources, thresholds, CRS, area, `is_sample`).
- **SAMPLE data** must have `is_sample: true` in the metadata **and** on every cell. Real pipeline output has `false` everywhere. Never mix the two.
- Run `npm run validate:data` after any change to `data/scores/`.

## Program data rules

- The AI may **only** cite programs from `data/programs/*.json`, by `id`.
- Every fact in a program record must come from the program's official page. Leave out any phone number, dollar amount, or eligibility rule that can't be confirmed there.
- `last_verified` is a `YYYY-MM-DD` date set by a **person** after checking the page. `null` means not verified, and the program is hidden from users and the AI.
- Links shown to users come from program records, never from model output.
- Model text containing a phone number, dollar amount, email, or URL that isn't in the program data is rejected, and the rule-based plan is used instead.

## Live data (lib/live/, GET /api/live)

Live values come straight from public APIs. They add context next to the scores. They **never** change, replace, or estimate a score.

| Source id | Data | Provider | Coverage | Cache |
|---|---|---|---|---|
| `weather` | Latest observation, forecast periods, 7-day highs, "feels like" highs, UV, active alerts, `heat_alert` | National Weather Service (`api.weather.gov`) + Open-Meteo forecast | US | 5-30 min |
| `air` | US AQI, category, PM2.5, ozone, max AQI next 24 h | Open-Meteo Air Quality (CAMS **model**) | Global | 60 min |
| `flood` | FEMA flood zone + high-risk flag. Future flooding at 9/21/36 in of sea level rise (high tide, 10% storm, 1% storm) | FEMA NFHL + Climate Ready Boston | FEMA: US. Sea level rise: Boston | 24 h |
| `trees` | City street trees within 100 m, empty planting sites, top species, trunk sizes | Boston BPRD tree inventory | Boston | 24 h |
| `places` | Nearest 3 BCYF community centers, pools, libraries, with straight-line miles | Analyze Boston | Boston | 24 h |
| `area` | Boston neighborhood. Census tract shares: older adults, children under 5, low-to-no income, disability | BPDA boundaries + Climate Ready Boston Social Vulnerability (2008-2012 ACS) | Boston | 24 h |
| `climate` | Boston hot days (90°F+): last summer, 1991-2020 average, 2031-2050 model median and range | Open-Meteo archive + CMIP6 HighResMIP, prebuilt by `npm run build:climate` into `data/live/climate_boston.json` | Boston | file |

### Live data rules

- **Weather, air, and climate numbers are AIR temperatures and regional values.** Never mix them with the ground-temperature heat score, and never label one as the other.
- Every live result carries `sources` and `fetched_at`. Show both near the value.
- If a source returns `{ ok: false }`, **hide that card**. Never show mock, cached-from-elsewhere, or estimated live values.
- Air quality is a **modeled estimate**. Always say so.
- Street tree counts are **City trees only**, not yard trees. They complement the green cover score and never replace it.
- Place phone numbers are shown **exactly as the City lists them** (often with no area code). Never add an area code.
- BCYF centers open as cooling centers **only during declared heat emergencies**. The places data does not say which are open today. Link to boston.gov/heat.
- Census tract shares describe the tract (2008-2012 estimates), not the household. Limited-English and medical-illness fields are left out because the dataset's definitions are unclear. People-of-color counts are left out on purpose: they aren't needed for the action plan.
- Points outside Massachusetts get `outside_coverage` for every source. Boston-only sources return `outside_coverage` elsewhere in Massachusetts.
- The action plan receives a small `<live_conditions>` block (`lib/live/context.ts`). The model may repeat those facts exactly. The validator allows phone numbers, dollar amounts, emails, and URLs only if they appear in the program data or the live facts.
