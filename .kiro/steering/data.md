# Data sources, score definitions, and rules

## Sources

| Data | Source | Used for |
|---|---|---|
| Land surface temperature | [USGS Landsat Collection 2 Level-2](https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products), band `ST_B10` + `QA_PIXEL` | Heat score |
| Aerial photos, 4-band (R, G, B, NIR) | [MassGIS 2025 Aerial Imagery](https://www.mass.gov/info-details/massgis-data-2025-aerial-imagery), JPEG 2000 tiles, 15 cm | Green cover score |
| Basemap tiles (RGB only) | MassGIS 2025 Aerial Imagery tile service on ArcGIS Online | Map display only |
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
