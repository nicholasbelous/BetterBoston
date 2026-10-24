# Requirements Document

## Introduction

The Landsat Data Pipeline replaces the SAMPLE score data in `data/scores/` with real measurements for ClimateCheck MA. It uses one clear Landsat 8 or 9 Collection 2 Level-2 summer scene on Microsoft Planetary Computer (the Default_Scene unless the optional Scene_Finder selects another), reads only a window around Boston, and computes per-cell surface temperature and NDVI green cover on a 100 m grid in EPSG:26919. Scores are percentile ranks across all City of Boston cells. Only cells in the three demo neighborhoods are written.

The output files (`data/scores/demo_grid.geojson` and `data/scores/demo_grid.meta.json`) must match `ScoreGrid`, `ScoreCellProperties`, and `ScoreMetadata` in `lib/types.ts` exactly and must pass the existing `pipeline/validate_scores.py`, which rejects any property not in `lib/types.ts`.

Scope constraints:

- `lib/types.ts`, `pipeline/make_sample_data.py`, `pipeline/validate_scores.py`, and `package.json` are not modified.
- Every script runs from the repo root. All paths are relative to the repo root.
- Rasters and downloads go in `pipeline/work/` (gitignored). `pipeline/work/` does not exist yet, so scripts create it.

### Noted conflicts and decisions

These are differences between the request and the existing repo. The request wins in each case; they are listed so nobody is surprised.

1. **Green cover source.** `.kiro/steering/data.md` says green cover comes from MassGIS 2025 4-band aerial imagery at 15 cm, compared against the demo neighborhoods, with `leaf_off` true. This pipeline computes NDVI from the same Landsat scene (30 m), compares against the City of Boston, and sets `leaf_off` to `false`. The doc comments on `tree_valid_frac` ("usable aerial-image pixels") and `leaf_off` ("MassGIS 2025 was flown before leaf-out") in `lib/types.ts` no longer describe the data. Only comments differ; field types are unchanged and `lib/types.ts` is not edited. The steering doc should be updated separately.
2. **Scene choice.** The pipeline defaults to `DEFAULT_SCENE_ID` = `LC09_L2SP_012031_20240625_02_T1` (2024-06-25, `landsat-9`), the scene named in `.kiro/steering/data.md`. The Scene_Finder (Requirement 5) is an optional fallback, run only if the Default_Scene fails the clear-sky check (the Fetcher warns when Clear_Fraction < 0.95). The Scene_Finder writes the Scene_File, which then overrides the default. In the task list, `find_scene.py` is implemented as the last task.
3. **Reprojection approach.** The steering doc says to reproject Landsat from EPSG:32619 to EPSG:26919 before aggregating. This pipeline transforms pixel centers to EPSG:26919 instead of resampling the raster, so no pixel values are interpolated.
4. **Percentile formula.** The request defines `percentile_rank` by properties only. To match `make_sample_data.py`, the rank is `round(100 × average_rank / (n − 1))` with 0-based ranks, ties sharing the average rank, and a single value scoring 50.
5. **Rank input precision.** `make_sample_data.py` rounds values before ranking. This pipeline does the same (ranks are computed from the rounded published values), so cells showing the same value always share a score.
6. **Overwriting real data.** After this pipeline writes `is_sample: false`, `npm run sample:data` refuses to overwrite without `--force`. That is existing, intended behavior.
7. **`scene_date` vs `imagery_dates`.** Both are `string` in `lib/types.ts`. Both are set to the same `YYYY-MM-DD` scene date.
8. **`--local` scene identity.** With `--local`, the Fetcher uses the Scene_File if it exists, otherwise `DEFAULT_SCENE_ID`. Filenames are not parsed for the scene ID or date. The user must make sure the EarthExplorer files belong to that scene.
9. **`temp_diff_f` reference.** `temp_diff_f` is computed as the rounded `mean_surface_temp_f` minus the rounded `reference_mean_f` (Requirement 8.2), so it can be checked from the published values alone. `make_sample_data.py` subtracts the unrounded reference mean, so a cell's `temp_diff_f` can differ by 0.1 °F from what that formula would give.
10. **Default Scene_File.** So that `build_grid.py` always has a scene ID and date, when the Scene_File does not exist the Fetcher writes it with the default values `{"id": "LC09_L2SP_012031_20240625_02_T1", "date": "2024-06-25", "platform": "landsat-9"}`, in both normal and `--local` mode. The Fetcher never overwrites an existing Scene_File. Requirement 10.9 for the Grid_Builder is unchanged.

## Glossary

- **Pipeline**: The set of Python 3 scripts in `pipeline/` defined by this spec.
- **Config**: The module `pipeline/config.py`.
- **Smoke_Test**: The script `pipeline/smoke_test.py`.
- **Boundary_Script**: The script `pipeline/boston_boundary.py`.
- **Scoring**: The module `pipeline/scoring.py`, containing pure numpy functions with no file I/O.
- **Scene_Finder**: The script `pipeline/find_scene.py`.
- **Fetcher**: The script `pipeline/fetch_landsat.py`.
- **Grid_Builder**: The script `pipeline/build_grid.py`.
- **Validator**: The existing script `pipeline/validate_scores.py`, invoked as `python3 pipeline/validate_scores.py --grid <path> --meta <path>`.
- **STAC_API**: Microsoft Planetary Computer STAC API at `https://planetarycomputer.microsoft.com/api/stac/v1`, opened with `pystac-client` using `modifier=planetary_computer.sign_inplace`.
- **Collection**: The STAC collection `landsat-c2-l2`.
- **Asset_Keys**: The Landsat assets `lwir11` (surface temperature, ST_B10), `red` (SR_B4), `nir08` (SR_B5), and `qa_pixel` (QA_PIXEL).
- **Boston_Boundary**: The polygon(s) with `NAME == "Boston"` from the Census cartographic boundary place file, saved at `pipeline/work/boston.geojson` in EPSG:4326.
- **BOSTON_BBOX**: `[minLng, minLat, maxLng, maxLat]` in EPSG:4326, equal to the Boston_Boundary bounds expanded by 0.005° on each side.
- **Demo_Bboxes**: The three `[minLng, minLat, maxLng, maxLat]` boxes from `make_sample_data.py`: Chinatown `(-71.066, 42.346, -71.056, 42.354)`, West Roxbury `(-71.170, 42.270, -71.140, 42.290)`, East Boston `(-71.045, 42.365, -71.025, 42.385)`.
- **Window_Read**: Reading only the raster window covering BOSTON_BBOX, by converting BOSTON_BBOX to the raster CRS with `rasterio.warp.transform_bounds` and building the window with `rasterio.windows.from_bounds`.
- **Clear_Fraction**: The share of pixels whose centers fall inside the Boston_Boundary for which `qa_mask` is False.
- **Default_Scene**: The Landsat scene `DEFAULT_SCENE_ID` = `LC09_L2SP_012031_20240625_02_T1`, acquisition date `2024-06-25`, platform `landsat-9`, defined in the Config and used by the Fetcher when the Scene_File does not exist.
- **Cell**: A 100 m × 100 m square in EPSG:26919 whose lower-left corner easting and northing are integer multiples of 100.
- **Boston_Cell**: A Cell containing at least one pixel center inside the Boston_Boundary.
- **Valid_Heat_Pixel**: A pixel whose center is inside the Boston_Boundary, whose `lwir11` DN is not 0, and whose `qa_mask` value is False.
- **Valid_Tree_Pixel**: A Valid_Heat_Pixel whose `red` DN and `nir08` DN are both not 0.
- **Reference_Set_Heat**: All Boston_Cells whose unrounded `heat_valid_frac` is greater than or equal to `MIN_VALID_FRAC`.
- **Reference_Set_Tree**: All Boston_Cells whose unrounded `tree_valid_frac` is greater than or equal to `MIN_VALID_FRAC`.
- **Work_Grid / Work_Meta**: The candidate output files `pipeline/work/demo_grid.geojson` and `pipeline/work/demo_grid.meta.json`.
- **Scene_File**: `pipeline/work/scene.json`.

## Requirements

### Requirement 1: Setup and configuration

**User Story:** As the pipeline owner, I want pinned dependencies and one config module, so that every script uses the same constants and paths.

#### Acceptance Criteria

1. THE Pipeline SHALL provide `pipeline/requirements.txt` listing `rasterio`, `numpy`, `geopandas`, `shapely`, `pyproj`, `pystac-client`, `planetary-computer`, `hypothesis`, `pytest`, and `matplotlib`, one package per line, each either with a minimum version using `>=` or with no version, and with no exact `==` pins.
2. THE Config SHALL define the module-level constants `CELL_SIZE_M = 100` (integer), `NDVI_THRESHOLD = 0.3` (float), `PROCESSING_CRS = "EPSG:26919"` (string), and `MIN_VALID_FRAC = 0.5` (float).
3. THE Config SHALL define the Demo_Bboxes as three named `[minLng, minLat, maxLng, maxLat]` entries with the exact names and coordinate values used in `pipeline/make_sample_data.py`, in the order Chinatown `(-71.066, 42.346, -71.056, 42.354)`, West Roxbury `(-71.170, 42.270, -71.140, 42.290)`, East Boston `(-71.045, 42.365, -71.025, 42.385)`.
4. THE Config SHALL define `DEFAULT_SCENE_ID = "LC09_L2SP_012031_20240625_02_T1"` (string), `DEFAULT_SCENE_DATE = "2024-06-25"` (string), and `DEFAULT_SCENE_PLATFORM = "landsat-9"` (string).
5. THE Config SHALL define every URL and file path used by the Pipeline: the STAC_API URL `https://planetarycomputer.microsoft.com/api/stac/v1`, the Collection id `landsat-c2-l2`, the Census zip URLs `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_25_place_500k.zip` and `https://www2.census.gov/geo/tiger/GENZ2022/shp/cb_2022_25_place_500k.zip`, the `pipeline/work/` directory, `pipeline/work/boston.geojson`, the Scene_File, the four band GeoTIFF outputs in `pipeline/work/`, Work_Grid, Work_Meta, `data/scores/demo_grid.geojson`, `data/scores/demo_grid.meta.json`, and the Validator path `pipeline/validate_scores.py`, with each file path expressed relative to the repo root.
6. WHEN the Config is imported and `pipeline/work/boston.geojson` exists, THE Config SHALL expose `BOSTON_BBOX` as `[minLng − 0.005, minLat − 0.005, maxLng + 0.005, maxLat + 0.005]` in EPSG:4326, where `minLng, minLat, maxLng, maxLat` are the total bounds of all Boston_Boundary polygons in the file.
7. IF `pipeline/work/boston.geojson` does not exist when the Config is imported, THEN THE Config SHALL set `BOSTON_BBOX` to `None` and complete the import without raising an error, so that the Boundary_Script can import the Config before the boundary file exists.
8. IF `BOSTON_BBOX` is `None` when the Scene_Finder, the Fetcher, or the Grid_Builder starts, THEN that script SHALL print a message telling the user to run `python3 pipeline/boston_boundary.py` and exit with a non-zero status before making any network request or writing any file.
9. IF `pipeline/work/` does not exist when a Pipeline script is about to write a file there, THEN THE Pipeline SHALL create the `pipeline/work/` directory, including any missing parent directories, before writing the file.
10. THE Pipeline scripts SHALL obtain `CELL_SIZE_M`, `NDVI_THRESHOLD`, `PROCESSING_CRS`, `MIN_VALID_FRAC`, `DEFAULT_SCENE_ID`, `DEFAULT_SCENE_DATE`, `DEFAULT_SCENE_PLATFORM`, the Demo_Bboxes, `BOSTON_BBOX`, and every URL and path listed in criterion 5 by importing them from the Config, and SHALL NOT redefine any of these values as literals outside the Config.

### Requirement 2: Smoke test of the STAC API

**User Story:** As the pipeline owner, I want a quick check of the STAC API, so that I can confirm access and asset key names before running the full pipeline.

#### Acceptance Criteria

1. WHEN the Smoke_Test runs, THE Smoke_Test SHALL open the STAC_API using the STAC_API URL and Collection id defined in the Config, and search the Collection for items intersecting the point `(-71.06, 42.36)`, given as (longitude, latitude) in EPSG:4326, requesting at most 3 items.
2. WHEN the search returns items, THE Smoke_Test SHALL print, for each of the first 3 returned items (or every returned item if fewer than 3 are returned), the item ID, the acquisition date as `YYYY-MM-DD`, `platform`, `eo:cloud_cover`, and the list of asset keys, printing a placeholder indicating "not available" for any of `platform` or `eo:cloud_cover` that the item does not have.
3. WHEN the Smoke_Test prints an item, THE Smoke_Test SHALL report, for that item, which of the Asset_Keys (`lwir11`, `red`, `nir08`, `qa_pixel`) are present among the item's asset keys and which are missing, listing every one of the 4 Asset_Keys under exactly one of the two outcomes.
4. IF the STAC_API cannot be reached, returns an error response, or does not respond within 60 seconds, THEN THE Smoke_Test SHALL print an error message indicating that the STAC_API request failed, including the underlying error, and exit with a non-zero status.
5. IF the search completes and returns zero items, THEN THE Smoke_Test SHALL print a message indicating that no items in the Collection intersect the point `(-71.06, 42.36)` and exit with a non-zero status.
6. WHEN the Smoke_Test has printed every returned item (up to 3), THE Smoke_Test SHALL exit with status 0, including when one or more Asset_Keys are reported missing.
7. THE Smoke_Test SHALL read only STAC item metadata, SHALL read no raster asset data, and SHALL write no files.

### Requirement 3: Boston boundary

**User Story:** As the pipeline owner, I want the official City of Boston boundary, so that scores and reference statistics cover only Boston.

#### Acceptance Criteria

1. WHEN the Boundary_Script runs, THE Boundary_Script SHALL create the `pipeline/work/` directory if it does not exist and download `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_25_place_500k.zip` to `pipeline/work/` with a timeout of 60 seconds.
2. IF the GENZ2023 download returns HTTP 404, THEN THE Boundary_Script SHALL download `https://www2.census.gov/geo/tiger/GENZ2022/shp/cb_2022_25_place_500k.zip` to `pipeline/work/` instead, with a timeout of 60 seconds.
3. WHEN a zip download completes, THE Boundary_Script SHALL load the place shapefile from the downloaded zip and keep only features whose `NAME` attribute equals `"Boston"` exactly (case-sensitive), keeping every matching feature.
4. WHEN at least one feature with `NAME == "Boston"` is selected, THE Boundary_Script SHALL save all selected features as the Boston_Boundary to `pipeline/work/boston.geojson` in EPSG:4326, replacing any existing file, print the source URL used and the number of features saved, and exit with status 0.
5. IF the GENZ2023 download fails with any error other than HTTP 404 (connection failure, timeout of 60 seconds exceeded, or another HTTP error status), or the GENZ2022 fallback download fails for any reason, THEN THE Boundary_Script SHALL print an error message naming the URL that failed and the failure reason, and exit with a non-zero status without writing `pipeline/work/boston.geojson`, leaving any existing copy unchanged.
6. IF the downloaded zip cannot be opened as a shapefile or no feature has `NAME == "Boston"`, THEN THE Boundary_Script SHALL print an error message indicating which of these two conditions occurred, and exit with a non-zero status without writing `pipeline/work/boston.geojson`, leaving any existing copy unchanged.

### Requirement 4: Scoring functions

**User Story:** As the pipeline owner, I want the math in pure, tested functions, so that the conversion and ranking rules are verifiable without network access.

#### Acceptance Criteria

1. THE Scoring SHALL contain only pure numpy functions that perform no file I/O and no network access, and that leave their input arrays unchanged after each call.
2. THE Scoring SHALL provide `dn_to_fahrenheit(dn)` that accepts a numpy array of uint16 DNs of any shape and returns a floating-point array of the same shape, equal to `F = (K − 273.15) × 9/5 + 32` where `K = DN × 0.00341802 + 149.0` within 0.01 °F at every position where DN is not 0, and NaN at every position where DN equals 0.
3. THE Scoring SHALL provide `dn_to_reflectance(dn)` that accepts a numpy array of uint16 DNs of any shape and returns a floating-point array of the same shape, equal to `DN × 0.0000275 − 0.2` within 1e-6 at every position where DN is not 0, and NaN at every position where DN equals 0.
4. THE Scoring SHALL provide `ndvi(red, nir)` that accepts two floating-point reflectance arrays of the same shape and returns a float32 array of that shape equal to `(nir − red) / (nir + red)`, clipped to `[-1, 1]`, at every position where `nir + red != 0` and neither input is NaN.
5. IF `nir + red == 0` or either input is NaN for a pixel, THEN THE Scoring `ndvi` function SHALL return NaN for that pixel without raising an exception.
6. THE Scoring SHALL provide `qa_mask(qa)` that accepts a numpy array of uint16 QA values of any shape and returns a boolean array of the same shape, True (bad pixel) where any of bit 0 (fill), bit 1 (dilated cloud), bit 3 (cloud), bit 4 (cloud shadow), or bit 7 (water) is set, and False otherwise.
7. THE Scoring SHALL provide `percentile_rank(values)` that accepts a 1-D floating-point array and returns a floating-point array of the same length containing, for each non-NaN value, `round(100 × r / (n − 1))`, where `r` is the value's 0-based rank among the `n` non-NaN values, tied values share the average rank, and `round` rounds half to even like Python's `round()` in `make_sample_data.py` (for example, `[1, 2, 3]` gives `[0, 50, 100]` and `[1, 1, 2]` gives `[25, 25, 100]`).
8. WHEN `percentile_rank` receives exactly one non-NaN value, THE Scoring SHALL return 50 for that value, however many NaN values the input contains.
9. THE Scoring `percentile_rank` function SHALL return NaN at every position where the input is NaN and SHALL leave the non-NaN results unchanged by the position or number of NaN values.
10. FOR ALL 1-D float arrays of length 1 to 1000 containing finite values and NaN, THE Scoring `percentile_rank` output SHALL be a whole number within `[0, 100]` for each non-NaN input, SHALL give equal outputs for equal inputs, and SHALL be non-decreasing in input value (property-based test with hypothesis).
11. FOR ALL pairs of same-shape `red` and `nir` arrays of length 0 to 1000 with values in `[-0.2, 1.61]` or NaN, including zeros and pairs whose sum is 0, THE Scoring `ndvi` output SHALL be float32 and each element SHALL lie within `[-1, 1]` or be NaN (property-based test with hypothesis).
12. FOR ALL uint16 QA values from 0 to 65535, THE Scoring `qa_mask` output SHALL equal True exactly when `qa & 0b10011011` is non-zero (property-based test with hypothesis).
13. WHEN `apply_min_valid(score, valid_frac)` is called with `valid_frac >= MIN_VALID_FRAC` (including `valid_frac` exactly equal to `MIN_VALID_FRAC`), THE Scoring SHALL return `score` unchanged, where `MIN_VALID_FRAC` is the Config value.
14. THE Pipeline SHALL provide `pipeline/tests/conftest.py` that adds `pipeline/` to `sys.path`, so that `pytest pipeline/tests -q` runs from the repo root and passes with no network connection.
15. IF `apply_min_valid(score, valid_frac)` is called with `valid_frac < MIN_VALID_FRAC`, THEN THE Scoring SHALL return `None`.
16. IF `percentile_rank` receives an empty array or an array whose values are all NaN, THEN THE Scoring SHALL return an array of the same length with every element NaN, without raising an exception.

### Requirement 5: Scene selection

**User Story:** As the pipeline owner, I want an optional fallback that chooses the clearest, hottest summer scene automatically when the Default_Scene is not clear enough, so that the heat map reflects a clear hot day over all of Boston.

#### Acceptance Criteria

1. WHERE the Default_Scene fails the clear-sky check reported by the Fetcher (Clear_Fraction below 0.95), THE Scene_Finder SHALL be available as an optional step that selects an alternative scene, and THE Pipeline SHALL complete a normal run without the Scene_Finder having run.
2. WHEN the Scene_Finder runs, THE Scene_Finder SHALL search the Collection over date ranges `2024-06-01..2024-08-31` and `2025-06-01..2025-08-31` with query `platform` in `["landsat-8", "landsat-9"]` and `eo:cloud_cover < 20`, intersecting BOSTON_BBOX, and SHALL combine the items returned for both date ranges into a single candidate list.
3. WHEN an item's footprint geometry (EPSG:4326) does not fully contain the BOSTON_BBOX rectangle (EPSG:4326), THE Scene_Finder SHALL skip that item and exclude it from evaluation.
4. WHEN candidates remain after the footprint check, THE Scene_Finder SHALL evaluate at most 10 candidates, taken in ascending `eo:cloud_cover` order with ties broken by ascending item ID, and SHALL not evaluate any candidate beyond the 10th.
5. WHEN the Scene_Finder evaluates a candidate, THE Scene_Finder SHALL Window_Read `qa_pixel` over BOSTON_BBOX and compute the Clear_Fraction using the Scoring `qa_mask` function and the Boston_Boundary reprojected to the raster CRS.
6. WHEN a candidate's Clear_Fraction is at least 0.95, THE Scene_Finder SHALL Window_Read `lwir11` over BOSTON_BBOX and compute the median surface temperature in °F, converted with the Scoring `dn_to_fahrenheit` function, of that candidate's Valid_Heat_Pixels.
7. WHEN at least one evaluated candidate has a Clear_Fraction of at least 0.95 and at least 1 Valid_Heat_Pixel, THE Scene_Finder SHALL select, among those candidates, the one with the highest median surface temperature, breaking ties by lower `eo:cloud_cover` and then by ascending item ID.
8. WHEN evaluation finishes, whether or not a scene is selected, THE Scene_Finder SHALL print a comparison table with one row per evaluated candidate showing ID, date (`YYYY-MM-DD`), platform, `eo:cloud_cover`, Clear_Fraction rounded to 3 decimals, and median °F rounded to 0.1 (blank when not computed), marking the selected scene's row when one is selected.
9. WHEN a scene is selected, THE Scene_Finder SHALL write the Scene_File, replacing any existing Scene_File, containing only the keys `"id"` (the STAC item ID), `"date"` (the item's acquisition date in UTC as `YYYY-MM-DD`), and `"platform"` (`"landsat-8"` or `"landsat-9"`, from the item's `platform` property), and exit with status 0, so that the written Scene_File overrides `DEFAULT_SCENE_ID` for later Fetcher runs.
10. IF no item passes the footprint check, or no evaluated candidate has a Clear_Fraction of at least 0.95 and at least 1 Valid_Heat_Pixel, THEN THE Scene_Finder SHALL print a message stating which of these two conditions failed and exit with a non-zero status without creating or modifying the Scene_File.
11. THE Scene_Finder SHALL read raster data only through Window_Read and SHALL download no full scene.
12. IF the STAC_API cannot be reached or the search raises an error, THEN THE Scene_Finder SHALL print the error and exit with a non-zero status without creating or modifying the Scene_File.
13. IF a Window_Read of `qa_pixel` or `lwir11` fails for a candidate, THEN THE Scene_Finder SHALL print the candidate ID and the error, treat that candidate as not selectable (blank Clear_Fraction or median °F in the comparison table), and continue evaluating the remaining candidates.

### Requirement 6: Landsat fetch

**User Story:** As the pipeline owner, I want the four bands of the chosen scene saved locally, so that grid building runs offline and repeatably.

#### Acceptance Criteria

1. WHEN the Fetcher runs without `--local`, THE Fetcher SHALL read the `"id"` value from the Scene_File if the Scene_File exists, otherwise use `DEFAULT_SCENE_ID`, and re-open the item with that ID from the Collection on the STAC_API to obtain freshly signed asset URLs.
2. WHEN the item is opened, THE Fetcher SHALL Window_Read `lwir11`, `red`, `nir08`, and `qa_pixel` over BOSTON_BBOX.
3. WHEN the bands are read, THE Fetcher SHALL save each of the four bands as a separate single-band GeoTIFF in `pipeline/work/` at the raster output path defined in the Config for that Asset_Key. Each file SHALL keep the source band's native CRS, data type, and DN values unchanged (no resampling, rescaling, or reprojection), and SHALL use the geotransform of the window that was read.
4. WHERE the `--local DIR` flag is given, THE Fetcher SHALL read the `ST_B10`, `SR_B4`, `SR_B5`, and `QA_PIXEL` GeoTIFFs from `DIR` (downloaded manually from USGS EarthExplorer) in place of `lwir11`, `red`, `nir08`, and `qa_pixel`, identifying each file only by the band name in its filename, and SHALL take the scene ID from the Scene_File if the Scene_File exists, otherwise from `DEFAULT_SCENE_ID`. It SHALL Window_Read each over BOSTON_BBOX and save the same four output GeoTIFFs as criterion 3, with no STAC_API request.
5. WHEN the Fetcher has read `qa_pixel`, THE Fetcher SHALL compute the Clear_Fraction using the Scoring `qa_mask` function and the Boston_Boundary reprojected to the raster CRS, and print the Clear_Fraction rounded to 3 decimals.
6. IF the Clear_Fraction computed in criterion 5 is below 0.95, THEN THE Fetcher SHALL print a warning stating that the scene fails the clear-sky check and that `python3 pipeline/find_scene.py` can select another scene, and SHALL still save the four bands and exit with status 0 unless another error criterion in this requirement applies.
7. WHEN the Fetcher has saved all four band GeoTIFFs and the Scene_File does not exist, THE Fetcher SHALL write the Scene_File with only the keys `"id"` (`DEFAULT_SCENE_ID`), `"date"` (`DEFAULT_SCENE_DATE`, `"2024-06-25"`), and `"platform"` (`DEFAULT_SCENE_PLATFORM`, `"landsat-9"`), with or without `--local`.
8. WHILE the Scene_File exists, THE Fetcher SHALL leave the Scene_File byte-for-byte unchanged, with or without `--local`.
9. IF any of these is true, THEN THE Fetcher SHALL print which input is missing or invalid and exit with a non-zero status without writing or changing the Scene_File:
   - The Scene_File exists but is not valid JSON or lacks `"id"`.
   - An Asset_Key is missing from the item.
   - A `--local` band file is missing, or more than one file in `DIR` matches the same band.
10. IF the four saved bands do not share the same CRS, shape, and transform, THEN THE Fetcher SHALL print the mismatch, naming the differing band(s) and attribute(s), and exit with a non-zero status.
11. THE Fetcher SHALL read raster data only through Window_Read and SHALL download no full scene.
12. IF the STAC_API cannot be reached, or the Collection has no item with the requested ID (from the Scene_File or `DEFAULT_SCENE_ID`), THEN THE Fetcher SHALL print the error, including the item ID that was requested, and exit with a non-zero status without writing any output GeoTIFF.
13. IF the BOSTON_BBOX window, converted to the raster CRS, does not overlap a band's raster extent or produces a window with zero rows or zero columns, THEN THE Fetcher SHALL print the band name and exit with a non-zero status without writing that band's output GeoTIFF.

### Requirement 7: Pixel validity and per-cell aggregation

**User Story:** As the pipeline owner, I want each 100 m cell to summarize only clear Boston pixels, so that scores reflect measured ground and not cloud, water, or areas outside the city.

#### Acceptance Criteria

1. WHEN the Grid_Builder loads the four band GeoTIFFs saved by the Fetcher in `pipeline/work/` (paths from the Config), THE Grid_Builder SHALL compute the inside-Boston mask with `rasterio.features.geometry_mask` using the Boston_Boundary reprojected from EPSG:4326 to the raster CRS, with `all_touched=False`, so that a pixel is inside the Boston_Boundary exactly when its pixel center lies inside the Boston_Boundary.
2. THE Grid_Builder SHALL classify each pixel as a Valid_Heat_Pixel and as a Valid_Tree_Pixel using the definitions in the Glossary and the Scoring `qa_mask` function, so that every pixel with its center outside the Boston_Boundary is neither a Valid_Heat_Pixel nor a Valid_Tree_Pixel.
3. THE Grid_Builder SHALL compute per-pixel °F with the Scoring `dn_to_fahrenheit` function and per-pixel NDVI with the Scoring `dn_to_reflectance` and `ndvi` functions, applying no rounding to per-pixel values before aggregation.
4. THE Grid_Builder SHALL compute each pixel center as the raster-CRS coordinate of pixel position (column + 0.5, row + 0.5) under the band transform, transform the pixel centers inside the Boston_Boundary to EPSG:26919 with vectorized pyproj, assign each to the Cell whose lower-left corner is (floor(easting / `CELL_SIZE_M`) × `CELL_SIZE_M`, floor(northing / `CELL_SIZE_M`) × `CELL_SIZE_M`), and aggregate per-cell counts and sums with `numpy.bincount`.
5. THE Grid_Builder SHALL compute, per Boston_Cell, `mean_surface_temp_f` as the arithmetic mean of the unrounded °F values of the cell's Valid_Heat_Pixels, and SHALL set `mean_surface_temp_f` to null for a Boston_Cell with 0 Valid_Heat_Pixels.
6. THE Grid_Builder SHALL compute, per Boston_Cell, `pct_vegetated` as 100 × (count of Valid_Tree_Pixels with NDVI > NDVI_THRESHOLD) / (count of Valid_Tree_Pixels), counting a Valid_Tree_Pixel with NaN NDVI or NDVI equal to NDVI_THRESHOLD as not vegetated, and SHALL set `pct_vegetated` to null for a Boston_Cell with 0 Valid_Tree_Pixels.
7. THE Grid_Builder SHALL compute, per Boston_Cell, `heat_valid_frac` as (count of Valid_Heat_Pixels) / (count of pixel centers inside the Boston_Boundary in that cell), and `tree_valid_frac` as (count of Valid_Tree_Pixels) / (same denominator).
8. FOR ALL Boston_Cells, THE Grid_Builder SHALL produce `heat_valid_frac` and `tree_valid_frac` as non-null numbers within `[0, 1]` with `tree_valid_frac <= heat_valid_frac`, and SHALL produce no Cell that contains 0 pixel centers inside the Boston_Boundary.
9. IF the four input bands do not share the same CRS, shape, and transform, THEN THE Grid_Builder SHALL print which of CRS, shape, or transform differs and for which bands, and exit with a non-zero status before computing any Cell and without writing Work_Grid, Work_Meta, or any file in `data/scores/`.
10. IF any of the four band GeoTIFFs in `pipeline/work/` or `pipeline/work/boston.geojson` does not exist or cannot be opened, THEN THE Grid_Builder SHALL print the path of each missing or unreadable file and exit with a non-zero status without writing Work_Grid, Work_Meta, or any file in `data/scores/`.

### Requirement 8: Reference statistics and scores

**User Story:** As a resident, I want my block compared with the whole City of Boston, so that the score means "hotter or greener than most of Boston."

#### Acceptance Criteria

1. THE Grid_Builder SHALL compute `reference_mean_f` as the arithmetic mean of the `mean_surface_temp_f` values, each first rounded to 1 decimal place, over every cell in Reference_Set_Heat (including cells outside the Demo_Bboxes), with the result rounded to 1 decimal place and written to the metadata `heat.reference_mean_f`.
2. THE Grid_Builder SHALL compute `temp_diff_f` for each cell in Reference_Set_Heat as the cell's `mean_surface_temp_f` (rounded to 1 decimal place) minus `reference_mean_f` (rounded to 1 decimal place), with the result rounded to 1 decimal place, so that every output cell with non-null values satisfies `temp_diff_f == round(mean_surface_temp_f − reference_mean_f, 1)` using the published values.
3. THE Grid_Builder SHALL compute `heat_score` for each cell in Reference_Set_Heat as the Scoring `percentile_rank` of the `mean_surface_temp_f` values rounded to 1 decimal place, with `n` equal to the number of cells in Reference_Set_Heat, so that a cell with a higher rounded `mean_surface_temp_f` never has a lower `heat_score` than a cell with a lower rounded `mean_surface_temp_f`, and cells with equal rounded values have equal `heat_score`.
4. THE Grid_Builder SHALL compute `tree_score` for each cell in Reference_Set_Tree as the Scoring `percentile_rank` of the `pct_vegetated` values rounded to 1 decimal place, with `n` equal to the number of cells in Reference_Set_Tree, so that a cell with a higher rounded `pct_vegetated` never has a lower `tree_score` than a cell with a lower rounded `pct_vegetated`, and cells with equal rounded values have equal `tree_score`.
5. IF a cell's unrounded `heat_valid_frac` is less than `MIN_VALID_FRAC` (0.5), THEN THE Grid_Builder SHALL exclude that cell from the `reference_mean_f` and `heat_score` computations, write that cell's `mean_surface_temp_f`, `temp_diff_f`, and `heat_score` as JSON `null`, and leave that cell's `pct_vegetated` and `tree_score` determined only by criteria 4 and 6.
6. IF a cell's unrounded `tree_valid_frac` is less than `MIN_VALID_FRAC` (0.5), THEN THE Grid_Builder SHALL exclude that cell from the `tree_score` computation, write that cell's `pct_vegetated` and `tree_score` as JSON `null`, and leave that cell's `mean_surface_temp_f`, `temp_diff_f`, and `heat_score` determined only by criteria 1, 2, 3, and 5.
7. THE Grid_Builder SHALL compute `reference_mean_f`, `temp_diff_f`, `heat_score`, and `tree_score` across all Boston_Cells before selecting demo cells for output, so that each output cell's values are identical to the values that cell would receive if every Boston_Cell were output.
8. IF Reference_Set_Heat contains 0 cells or Reference_Set_Tree contains 0 cells, THEN THE Grid_Builder SHALL print a message naming which reference set is empty, exit with a non-zero status, write neither Work_Grid nor Work_Meta, and leave `data/scores/demo_grid.geojson` and `data/scores/demo_grid.meta.json` unchanged.

### Requirement 9: Demo cell selection, geometry, and rounding

**User Story:** As the frontend developer, I want cells in the same shape and precision as the sample data, so that the app works unchanged when real data replaces sample data.

#### Acceptance Criteria

1. THE Grid_Builder SHALL output only Boston_Cells whose center (lower-left easting + 50 m, lower-left northing + 50 m in EPSG:26919), transformed to EPSG:4326, satisfies `minLng <= lng <= maxLng` and `minLat <= lat <= maxLat` (bounds inclusive) for one of the Demo_Bboxes, and SHALL output such a cell even when part of its polygon lies outside that Demo_Bbox.
2. WHEN a cell is output, THE Grid_Builder SHALL set `neighborhood` to the name of the Demo_Bbox containing the cell's center (`"Chinatown"`, `"West Roxbury"`, or `"East Boston"`), using the first matching Demo_Bbox in Config order (Chinatown, West Roxbury, East Boston) if more than one contains the center.
3. THE Grid_Builder SHALL build each cell's geometry as a GeoJSON `Polygon` with exactly one ring of 5 positions: the 4 cell corners transformed from EPSG:26919 to EPSG:4326, in the order lower-left, lower-right, upper-right, upper-left, each position written as `[lng, lat]` with each coordinate rounded to 6 decimals, followed by the first position again to close the ring.
4. THE Grid_Builder SHALL compute each cell's `bbox` as `[minLng, minLat, maxLng, maxLat]` from the same rounded ring coordinates written to the geometry, so that `bbox` matches the ring extent exactly with no further rounding.
5. THE Grid_Builder SHALL set `cell_id` to `"c_<easting>_<northing>"`, where `<easting>` and `<northing>` are the integer EPSG:26919 coordinates of the cell's lower-left corner written without decimal point, sign padding, or leading zeros (for example `"c_330000_4690000"`), so that every `cell_id` in the output is unique.
6. THE Grid_Builder SHALL round non-null values with Python's built-in `round` (as in `make_sample_data.py`): `heat_score` and `tree_score` to whole numbers written as JSON integers, `mean_surface_temp_f`, `temp_diff_f`, and `pct_vegetated` to 0.1, and `heat_valid_frac` and `tree_valid_frac` to 3 decimals; null values SHALL be written as JSON `null` and no property SHALL contain NaN or Infinity.
7. THE Grid_Builder SHALL set `is_sample` to `false` on every cell.
8. THE Grid_Builder SHALL write each cell's properties with exactly the keys `cell_id`, `bbox`, `neighborhood`, `mean_surface_temp_f`, `temp_diff_f`, `pct_vegetated`, `heat_score`, `tree_score`, `heat_valid_frac`, `tree_valid_frac`, and `is_sample`, in that order.
9. THE Grid_Builder SHALL write the grid as a GeoJSON `FeatureCollection` whose only keys are `type` and `features`, with each `Feature` having only the keys `type`, `geometry`, and `properties`, in compact JSON (no indentation, `,` and `:` separators with no spaces), UTF-8 encoded with a single trailing newline, matching the format of `make_sample_data.py`, and with features ordered by Demo_Bbox in Config order, then by ascending lower-left northing, then by ascending lower-left easting.
10. FOR ALL output cells, THE Grid_Builder SHALL produce a ring of exactly 5 positions whose first and last positions are equal, a `bbox` equal to the extent of the cell's ring, and a `cell_id` matching the cell's lower-left corner (property-based test with hypothesis on the geometry and cell ID functions).
11. IF one or more Demo_Bboxes contain no output cell, THEN THE Grid_Builder SHALL print the names of the empty Demo_Bboxes and exit with a non-zero status without writing Work_Grid, Work_Meta, or any file in `data/scores/`.

### Requirement 10: Metadata

**User Story:** As a resident, I want the app to show where the data came from and its limits, so that I can trust and correctly read the scores.

#### Acceptance Criteria

1. THE Grid_Builder SHALL write metadata with exactly the top-level keys of `ScoreMetadata` in `lib/types.ts` (`schema_version`, `is_sample`, `generated_at`, `generated_by`, `area`, `grid`, `heat`, `tree`, `sources`, `notes`) in that order, with each nested object (`area`, `grid`, `heat`, `tree`) containing exactly the keys that `ScoreMetadata` declares for it in the declared order, and no other keys at any level.
2. THE Grid_Builder SHALL set `schema_version` to `1`, `is_sample` to `false`, `generated_at` to the UTC time at which the metadata is built, in ISO 8601 format `YYYY-MM-DDTHH:MM:SSZ` (whole seconds, literal `Z` suffix), and `generated_by` to `"pipeline/build_grid.py"`.
3. THE Grid_Builder SHALL set `area` to `{"name": "Boston demo areas", "neighborhoods": ["Chinatown", "West Roxbury", "East Boston"], "bbox": [-71.17, 42.27, -71.025, 42.385]}`, where `bbox` is the union of the Demo_Bboxes and `neighborhoods` lists the names in that exact order.
4. THE Grid_Builder SHALL set `grid` to `{"cell_size_m": 100, "processing_crs": "EPSG:26919", "output_crs": "EPSG:4326", "cell_count": <number of output features>}`, where `cell_count` is an integer equal to the number of `Feature` objects in the Work_Grid written in the same run.
5. THE Grid_Builder SHALL set `heat` to `{"source": "Landsat 8/9 Collection 2 Level-2 surface temperature (USGS, via Microsoft Planetary Computer)", "scene_id": <Scene_File id>, "scene_date": <Scene_File date as YYYY-MM-DD>, "reference_area": "City of Boston", "reference_mean_f": <reference_mean_f>, "min_valid_frac": 0.5}`, where `scene_id` is the Scene_File `"id"` string copied unchanged and `reference_mean_f` is the finite number computed in Requirement 8.1, rounded to 0.1.
6. THE Grid_Builder SHALL set `tree` to `{"source": "Landsat 8/9 Collection 2 Level-2 surface reflectance, NDVI (same scene)", "imagery_dates": <scene date as YYYY-MM-DD string>, "ndvi_threshold": 0.3, "leaf_off": false, "reference_area": "City of Boston", "min_valid_frac": 0.5}`, where `imagery_dates` is character-for-character equal to `heat.scene_date`.
7. THE Grid_Builder SHALL set `sources` to a list of exactly 3 objects, each with exactly the keys `"name"` and `"url"` holding non-empty strings and each `url` beginning with `https://`, in the order: the Planetary Computer `landsat-c2-l2` dataset page, the USGS Landsat Collection 2 page, and the Census cartographic boundary files page.
8. THE Grid_Builder SHALL set `notes` to exactly `["Surface temperature, not air temperature", "Single summer day: <scene_date>", "Landsat thermal native resolution is 100 m (delivered at 30 m)", "30 m pixels mix trees and pavement", "Scores are percentile ranks across all City of Boston cells"]`, in that order, with `<scene_date>` replaced by the same `YYYY-MM-DD` string used in `heat.scene_date`.
9. IF the Scene_File is missing, is not valid JSON, lacks `"id"` or `"date"`, has an empty `"id"`, or has a `"date"` that is not a valid calendar date in `YYYY-MM-DD` format, THEN THE Grid_Builder SHALL print an error naming the Scene_File and the missing or invalid key, and exit with a non-zero status without writing Work_Grid, Work_Meta, or any file in `data/scores/`.
10. THE Grid_Builder SHALL write the metadata as UTF-8 JSON indented with 2 spaces, with non-ASCII characters left unescaped and a single trailing newline, matching the format of `make_sample_data.py`.

### Requirement 11: Validated publish

**User Story:** As the team, I want real data published only after it passes the validator, so that a bad run never breaks the app.

#### Acceptance Criteria

1. WHEN the Grid_Builder has computed all output cells and metadata without hitting an exit condition from Requirements 7.9, 7.10, 8.8, 9.11, or 10.9, THE Grid_Builder SHALL write Work_Grid and Work_Meta to `pipeline/work/`, replacing any existing Work_Grid and Work_Meta, before reading, writing, or copying any file in `data/scores/`.
2. WHEN Work_Grid and Work_Meta are written, THE Grid_Builder SHALL run `python3 pipeline/validate_scores.py --grid pipeline/work/demo_grid.geojson --meta pipeline/work/demo_grid.meta.json` from the repo root and capture both its standard output and standard error.
3. WHEN the Validator exits with status 0, THE Grid_Builder SHALL copy Work_Grid to `data/scores/demo_grid.geojson` and Work_Meta to `data/scores/demo_grid.meta.json`, and then exit with status 0.
4. IF the Validator exits with a non-zero status, THEN THE Grid_Builder SHALL leave both files in `data/scores/` byte-for-byte unchanged, keep Work_Grid and Work_Meta in `pipeline/work/` for inspection, print the Validator's full standard output and standard error, and exit with a non-zero status.
5. WHEN `npm run validate:data` runs after a successful publish, THE Validator SHALL exit with status 0 and print a single line starting with `OK:` that contains `REAL data, schema v1` and a cell count equal to `grid.cell_count` in `data/scores/demo_grid.meta.json`.
6. WHEN both files have been copied to `data/scores/`, THE Grid_Builder SHALL print the number of output cells for each of `"Chinatown"`, `"West Roxbury"`, and `"East Boston"` in that order (printing 0 for a neighborhood with no cells), followed by the number of output cells with a null `heat_score` and the number of output cells with a null `tree_score`.
7. WHEN the Grid_Builder copies Work_Grid and Work_Meta to `data/scores/` (criterion 3), THE Grid_Builder SHALL first copy both files to temporary files in `data/scores/` and only after both temporary copies succeed move each temporary file into place with `os.replace`, so that `data/scores/` holds either both previous files or both new files (never one previous file and one new file).
8. IF either temporary copy fails, THEN THE Grid_Builder SHALL remove the temporary files, leave `data/scores/demo_grid.geojson` and `data/scores/demo_grid.meta.json` byte-for-byte unchanged, print an error message naming the file that failed to copy, and exit with a non-zero status.

### Requirement 12: Pipeline documentation

**User Story:** As a teammate, I want a short README, so that I can rerun the pipeline without asking.

#### Acceptance Criteria

1. THE Pipeline SHALL provide `pipeline/README.md` with the run order as a numbered list of exactly these 5 commands, in this order: `python3 pipeline/smoke_test.py`, `python3 pipeline/boston_boundary.py`, `python3 pipeline/fetch_landsat.py`, `python3 pipeline/build_grid.py`, `npm run validate:data`.
2. THE Pipeline README SHALL state that every command runs from the repo root and that each command must exit with status 0 before the next command in the run order is run.
3. THE Pipeline README SHALL give the install command `python3 -m pip install -r pipeline/requirements.txt`, to be run from the repo root.
4. THE Pipeline README SHALL give the test command `pytest pipeline/tests -q`, to be run from the repo root.
5. THE Pipeline README SHALL describe `python3 pipeline/find_scene.py` as an optional step, run only when `python3 pipeline/fetch_landsat.py` warns that the Clear_Fraction is below 0.95, followed by rerunning `python3 pipeline/fetch_landsat.py` and then `python3 pipeline/build_grid.py`.
6. THE Pipeline README SHALL explain the `--local DIR` fallback by naming the 4 EarthExplorer GeoTIFFs to download (`ST_B10`, `SR_B4`, `SR_B5`, `QA_PIXEL`), stating that all 4 files go in one directory with the band name kept in each filename, and giving the command `python3 pipeline/fetch_landsat.py --local DIR`, where `DIR` is that directory.
7. THE Pipeline README SHALL state that `python3 pipeline/fetch_landsat.py --local DIR` replaces the `python3 pipeline/fetch_landsat.py` step of the run order and that `python3 pipeline/boston_boundary.py` must still run before it.
8. THE Pipeline README SHALL state that, with `--local`, the scene ID and date come from the Scene_File (`pipeline/work/scene.json`) when it exists and otherwise from `DEFAULT_SCENE_ID` (`LC09_L2SP_012031_20240625_02_T1`, 2024-06-25), that the user must download the `ST_B10`, `SR_B4`, `SR_B5`, and `QA_PIXEL` files of that scene, and that the Fetcher never overwrites an existing Scene_File.
