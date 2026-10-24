# Implementation Plan: Landsat Data Pipeline

## Overview

Build the pipeline as small Python 3 scripts in `pipeline/`, in the order set by the design's "Notes for the Tasks Phase": setup and config first, then the boundary script, the pure scoring module, the raster helpers and fetcher, the grid builder, and the README. `find_scene.py` is optional and comes last. Every script imports its constants, URLs, and paths from `pipeline/config.py` (Requirement 1.10) and runs from the repo root. All tests run offline with `pytest pipeline/tests -q`.

## Tasks

- [x] 1. Set up dependencies, config, smoke test, and test harness
  - [x] 1.1 Create `pipeline/requirements.txt` and `pipeline/config.py`
    - `requirements.txt`: the 10 packages from the design, one per line, `>=` or unversioned, no `==`
    - `config.py` (stdlib only): `REPO_ROOT`, `CELL_SIZE_M`, `NDVI_THRESHOLD`, `PROCESSING_CRS`, `OUTPUT_CRS`, `MIN_VALID_FRAC`, `CLEAR_FRACTION_MIN`, `HTTP_TIMEOUT_S`, `DEFAULT_SCENE_*`, ordered `DEMO_BBOXES`, `STAC_API_URL`, `COLLECTION_ID`, `CENSUS_ZIP_URLS`, `ASSET_KEYS`, `LOCAL_BAND_NAMES`, all repo-relative paths, `BBOX_PAD_DEG`
    - Implement `bbox_from_geojson`, `load_boston_bbox` (returns `None` on missing or unparseable file, never raises), `BOSTON_BBOX`, `abs_path`, `ensure_work_dir`, `require_boston_bbox`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [x] 1.2 Create `pipeline/tests/conftest.py`
    - Insert `pipeline/` into `sys.path`; register and load the hypothesis profile `max_examples=100, deadline=None`
    - _Requirements: 4.14_

  - [x] 1.3 Create `pipeline/raster_io.py` (initial helpers) and `pipeline/smoke_test.py`
    - In `raster_io.py`, add only `open_stac(timeout=HTTP_TIMEOUT_S)` and `write_json_atomic(path, text)` for now; task 4.1 adds the raster functions
    - `smoke_test.py`: `SMOKE_POINT`, `asset_report`, `format_item`, `main`; search at most 3 items at `(-71.06, 42.36)`, print "n/a" for missing `platform` / `eo:cloud_cover`, report present/missing Asset_Keys
    - Exit 1 on STAC error or timeout (print underlying error) and on zero items; exit 0 otherwise, even with missing keys; read metadata only, write no files
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 1.4 Write property test for Boston bbox in `pipeline/tests/test_config.py`
    - **Property 1: Boston bbox is the padded total bounds**
    - **Validates: Requirements 1.6**

  - [ ]* 1.5 Write config example tests in `pipeline/tests/test_config.py`
    - Constant values; `DEMO_BBOXES` equal `make_sample_data.AREAS` names, values, and order; paths are relative; missing or malformed `boston.geojson` gives `None`; `requirements.txt` lists all 10 packages with no `==`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [ ]* 1.6 Write property test for asset report in `pipeline/tests/test_smoke.py`
    - **Property 2: Asset report partitions the four asset keys**
    - **Validates: Requirements 2.3**

  - [ ]* 1.7 Write smoke test examples in `pipeline/tests/test_smoke.py`
    - Mock `open_stac`: STAC error exits 1 with the error printed; zero items exits 1; items with missing keys exit 0
    - _Requirements: 2.4, 2.5, 2.6_

- [x] 2. Implement the Boston boundary script
  - [x] 2.1 Create `pipeline/boston_boundary.py`
    - `DownloadError`, `download` (urllib, 60 s timeout, temp file), `download_with_fallback` (GENZ2022 only on HTTP 404 from GENZ2023), `select_boston` (`NAME == "Boston"`, case-sensitive, all matches), `main`
    - Read with `geopandas.read_file("zip://...")`, reproject to EPSG:4326, save with `write_json_atomic`, print source URL and feature count
    - On download failure, unreadable zip, or no Boston feature: print which condition and URL/reason, exit 1, leave any existing `boston.geojson` unchanged
    - _Requirements: 1.9, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 2.2 Write boundary example tests in `pipeline/tests/test_boundary.py`
    - Mocked downloads: 404 falls back to GENZ2022; other error exits 1 and keeps the existing file; no Boston feature exits 1; local zip fixture is saved in EPSG:4326
    - _Requirements: 3.2, 3.4, 3.5, 3.6_

- [x] 3. Implement the scoring module and its tests
  - [x] 3.1 Create `pipeline/scoring.py`
    - `QA_BAD_BITS = 0b10011011`; `dn_to_fahrenheit`, `dn_to_reflectance`, `ndvi`, `qa_mask`, `clear_fraction`, `median_valid_f`, `percentile_rank`, `apply_min_valid` as specified in the design
    - Pure numpy, no I/O, inputs never modified; Python `round` (half to even) in `percentile_rank`; 50 for a single value; all-NaN for empty or all-NaN input
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.13, 4.15, 4.16, 5.5, 5.6, 6.5_

  - [x] 3.2 Write property test for DN conversions in `pipeline/tests/test_scoring.py`
    - **Property 3: DN conversions match the Collection 2 formulas**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 3.3 Write property test for NDVI in `pipeline/tests/test_scoring.py`
    - **Property 4: NDVI is float32, clipped, and NaN where undefined**
    - **Validates: Requirements 4.4, 4.5, 4.11**

  - [x] 3.4 Write property test for QA mask in `pipeline/tests/test_scoring.py`
    - **Property 5: QA mask is the bit test**
    - **Validates: Requirements 4.6, 4.12**

  - [x] 3.5 Write property test for percentile_rank vs sample data in `pipeline/tests/test_scoring.py`
    - **Property 6: percentile_rank matches the sample-data reference**
    - Compare against `make_sample_data.percentile_scores`
    - **Validates: Requirements 4.7, 4.8**

  - [x] 3.6 Write property test for percentile_rank bounds and monotonicity in `pipeline/tests/test_scoring.py`
    - **Property 7: percentile_rank is bounded, tie-consistent, and monotone**
    - **Validates: Requirements 4.10**

  - [x] 3.7 Write property test for NaN handling in `pipeline/tests/test_scoring.py`
    - **Property 8: NaN inputs do not affect percentile_rank**
    - **Validates: Requirements 4.9, 4.16**

  - [x] 3.8 Write property test for input immutability in `pipeline/tests/test_scoring.py`
    - **Property 9: Scoring functions do not modify their inputs**
    - **Validates: Requirements 4.1**

  - [x] 3.9 Write property test for apply_min_valid in `pipeline/tests/test_scoring.py`
    - **Property 10: apply_min_valid uses an inclusive threshold**
    - **Validates: Requirements 4.13, 4.15**

  - [x] 3.10 Write property test for clear fraction and median temperature in `pipeline/tests/test_scoring.py`
    - **Property 11: Clear fraction and median temperature use only valid Boston pixels**
    - **Validates: Requirements 5.5, 5.6, 6.5**

  - [ ]* 3.11 Write scoring example tests in `pipeline/tests/test_scoring.py`
    - `[1, 2, 3]` → `[0, 50, 100]`; `[1, 1, 2]` → `[25, 25, 100]`; single value → 50; empty → empty; `apply_min_valid` at exactly 0.5
    - _Requirements: 4.7, 4.8, 4.13, 4.16_

- [x] 4. Implement raster helpers and the Landsat fetcher
  - [x] 4.1 Add raster functions to `pipeline/raster_io.py`
    - `Band` dataclass, `WindowError`, `window_read` (transform_bounds, from_bounds, round, intersect, reject empty window), `open_band`, `check_alignment`, `load_boundary`, `inside_mask` (`geometry_mask`, `all_touched=False`), `write_band` (same dtype/CRS/transform/nodata, DEFLATE, temp file + `os.replace`)
    - `window_read` is the only source-pixel read path; wrap remote reads in `rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR")`
    - _Requirements: 5.11, 6.2, 6.3, 6.10, 6.11, 6.13, 7.1, 7.9_

  - [x] 4.2 Create `pipeline/fetch_landsat.py`
    - `FetchError`, `read_scene_id`, `match_local_bands` (whole-token match, `.tif`/`.TIF`, missing or ambiguous raises), `fetch_stac_bands`, `fetch_local_bands`, `default_scene_json`, `main` with `--local DIR`
    - Follow the design flow: `require_boston_bbox` → scene ID → read all four windows → alignment check → Clear_Fraction (warn below 0.95, point to `find_scene.py`) → write four GeoTIFFs → write default Scene_File only if absent
    - No file is written before all checks pass; existing Scene_File is never opened for writing; errors name the item ID, band, or asset key
    - _Requirements: 1.8, 1.9, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13_

  - [ ]* 4.3 Write property test for Scene_File parsing in `pipeline/tests/test_fetch.py`
    - **Property 14: Fetcher reads the scene ID only from valid Scene_Files**
    - **Validates: Requirements 6.1, 6.9**

  - [ ]* 4.4 Write property test for local band matching in `pipeline/tests/test_fetch.py`
    - **Property 15: Local band matching finds exactly one file per band**
    - **Validates: Requirements 6.4, 6.9**

  - [ ]* 4.5 Write property test for GeoTIFF round trip in `pipeline/tests/test_fetch.py`
    - **Property 16: Saved bands round-trip unchanged**
    - **Validates: Requirements 6.3**

  - [ ]* 4.6 Write property test for alignment check in `pipeline/tests/test_fetch.py`
    - **Property 17: Alignment check reports every mismatch**
    - **Validates: Requirements 6.10, 7.9**

  - [ ]* 4.7 Write fetch example tests in `pipeline/tests/test_fetch.py`
    - `--local` run on synthetic TIFs writes four bands and the default Scene_File; existing Scene_File stays byte-identical; window outside raster names the band and writes nothing; low Clear_Fraction warns and exits 0
    - _Requirements: 6.4, 6.6, 6.7, 6.8, 6.13_

- [x] 5. Implement the grid builder
  - [x] 5.1 Create `pipeline/build_grid.py` with scene parsing and pixel helpers
    - `SceneInfo`, `CellStats`, `SceneError`; `parse_scene` (non-empty `id`, `date` matching `^\d{4}-\d{2}-\d{2}$` and `date.fromisoformat`), `pixel_centers`, `classify_pixels`, `assign_cells`, `aggregate` (`np.unique` + `np.bincount`, unrounded values)
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 10.9_

  - [ ]* 5.2 Write property test for Grid_Builder Scene_File parsing in `pipeline/tests/test_build_grid.py`
    - **Property 30: Grid_Builder accepts exactly the valid Scene_Files**
    - **Validates: Requirements 10.9**

  - [ ]* 5.3 Write property test for inside mask in `pipeline/tests/test_build_grid.py`
    - **Property 18: Inside mask follows the pixel-center rule**
    - **Validates: Requirements 7.1**

  - [ ]* 5.4 Write property test for pixel classification in `pipeline/tests/test_build_grid.py`
    - **Property 19: Pixel classification is nested inside Boston**
    - **Validates: Requirements 7.2**

  - [ ]* 5.5 Write property test for pixel centers and cell assignment in `pipeline/tests/test_build_grid.py`
    - **Property 20: Pixel centers and cell assignment**
    - **Validates: Requirements 7.4**

  - [ ]* 5.6 Write property test for aggregation in `pipeline/tests/test_build_grid.py`
    - **Property 21: Aggregation matches a naive per-cell model**
    - **Validates: Requirements 7.3, 7.5, 7.6, 7.7, 7.8**

  - [x] 5.7 Add `score_cells` to `pipeline/build_grid.py`
    - `ScoredCells`, `EmptyReferenceSet`; unrounded `>= MIN_VALID_FRAC` reference sets, round before ranking, `reference_mean_f`, `temp_diff_f` from rounded values, independent heat/tree null rules, ranking over all Boston_Cells
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 5.8 Write property test for reference statistics in `pipeline/tests/test_build_grid.py`
    - **Property 22: Reference statistics and null rules**
    - **Validates: Requirements 8.1, 8.2, 8.5, 8.6, 8.8**

  - [x] 5.9 Add geometry, demo selection, and cell properties to `pipeline/build_grid.py`
    - `DemoCell`, `EmptyDemoAreas`; `cell_ring`, `ring_bbox`, `cell_id`, `demo_neighborhood` (inclusive, first match in config order), `select_demo_cells` (sorted by bbox order, northing, easting), `cell_properties` (exact key order, Python `round`, `None` for null, `is_sample: False`), `build_feature`, `build_grid_obj`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.11_

  - [ ]* 5.10 Write property test for ranking over all Boston cells in `pipeline/tests/test_build_grid.py`
    - **Property 23: Scores are ranked over all Boston cells**
    - **Validates: Requirements 8.3, 8.4, 8.7**

  - [ ]* 5.11 Write property test for cell geometry in `pipeline/tests/test_build_grid.py`
    - **Property 24: Cell geometry, bbox, and ID are consistent**
    - **Validates: Requirements 9.3, 9.4, 9.5, 9.10**

  - [ ]* 5.12 Write property test for demo selection in `pipeline/tests/test_build_grid.py`
    - **Property 25: Demo selection, neighborhood, and ordering**
    - **Validates: Requirements 9.1, 9.2, 9.9, 9.11**

  - [ ]* 5.13 Write property test for cell properties in `pipeline/tests/test_build_grid.py`
    - **Property 26: Cell properties have the exact schema and rounding**
    - **Validates: Requirements 9.6, 9.7, 9.8**

  - [x] 5.14 Add metadata, serialization, and `build_outputs` to `pipeline/build_grid.py`
    - `build_metadata` (exact `ScoreMetadata` key order, `area.bbox` from the union of `DEMO_BBOXES`, `generated_at` passed in), `dumps_grid` (compact + `\n`), `dumps_meta` (indent 2, `ensure_ascii=False`, + `\n`), `build_outputs` composing all pure steps
    - _Requirements: 9.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.10_

  - [ ]* 5.15 Write property test for metadata in `pipeline/tests/test_build_grid.py`
    - **Property 27: Metadata has the exact schema and values**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8**

  - [ ]* 5.16 Write property test for serialization in `pipeline/tests/test_build_grid.py`
    - **Property 28: Output serialization round-trips in the sample-data format**
    - **Validates: Requirements 9.9, 10.10**

  - [x] 5.17 Write property test for validator compatibility in `pipeline/tests/test_build_grid.py`
    - **Property 29: Builder output passes the existing validator**
    - Call `validate_scores.validate_grid` and `validate_scores.validate_metadata` on `build_outputs` results; expect zero errors and `cell_count == len(features)`
    - **Validates: Requirements 9.10, 10.4, 11.5**

  - [x] 5.18 Add I/O and `main` to `pipeline/build_grid.py`
    - `load_inputs` (list every missing or unreadable path), `run_validator` (`sys.executable`, `cwd=REPO_ROOT`, relative Work_Grid/Work_Meta args, capture stdout/stderr), `publish` (two `.tmp` copies in `data/scores/`, then `os.replace` each; remove temps and name the failed file on error), `main`
    - Check order 1.8 → 10.9 → 7.10 → 7.9 → 8.8 → 9.11, then write Work_Grid/Work_Meta, validate, publish, print per-neighborhood counts and null-score counts
    - _Requirements: 1.8, 1.9, 7.1, 7.9, 7.10, 11.1, 11.2, 11.3, 11.4, 11.6, 11.7, 11.8_

  - [ ]* 5.19 Write build_grid example tests in `pipeline/tests/test_build_grid.py`
    - Missing inputs listed (7.10); misaligned bands (7.9); exact validator argv (11.2); validator failure keeps `data/scores/` byte-identical and work files kept (11.4); copy failure removes temps (11.8)
    - _Requirements: 7.9, 7.10, 11.2, 11.4, 11.8_

  - [ ]* 5.20 Write end-to-end offline example in `pipeline/tests/test_build_grid.py`
    - Temporary repo layout with synthetic EPSG:32619 GeoTIFFs, rectangular `boston.geojson`, and Scene_File; monkeypatch config paths; run `build_grid.main()` with the real validator subprocess
    - Check exit 0, both files published, validator prints `OK:` with `REAL data, schema v1`, printed counts match the grid
    - _Requirements: 11.1, 11.3, 11.5, 11.6, 11.7_

- [~] 6. Write the pipeline README and run the final checkpoint
  - [-] 6.1 Create `pipeline/README.md`
    - Install command, numbered 5-command run order, "run from the repo root; each must exit 0 before the next", test command `pytest pipeline/tests -q`
    - Optional `find_scene.py` step (only when Clear_Fraction < 0.95, then rerun fetch and build); `--local DIR` fallback with the 4 EarthExplorer files, replacing the fetch step, `boston_boundary.py` still first; scene ID source with `--local` and that the Scene_File is never overwritten by the Fetcher
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_
  - Checkpoint: run `pytest pipeline/tests -q` from the repo root. Ensure all tests pass, ask the user if questions arise.

- [ ]* 7. Implement the optional scene finder (last)
  - [ ]* 7.1 Create `pipeline/find_scene.py`
    - `Candidate`, `DATE_RANGES`, `MAX_CANDIDATES`, `footprint_ok`, `order_candidates` (sort by cloud then ID, dedupe, first 10), `select_best` (Clear_Fraction ≥ 0.95 and a median; highest median, then lower cloud, then lower ID), `format_table`, `main`
    - Two searches with the platform and `eo:cloud_cover < 20` query over BOSTON_BBOX; Window_Read only; per-candidate read errors print and continue; write Scene_File (`id`, `date`, `platform`) only on selection; exit 1 without touching the Scene_File on STAC error or no eligible scene
    - _Requirements: 1.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13_

  - [ ]* 7.2 Write property test for footprint check in `pipeline/tests/test_find_scene.py`
    - **Property 12: Footprint check requires full containment**
    - **Validates: Requirements 5.3**

  - [ ]* 7.3 Write property test for candidate ordering and selection in `pipeline/tests/test_find_scene.py`
    - **Property 13: Candidate ordering and selection**
    - **Validates: Requirements 5.4, 5.7, 5.10**

  - [ ]* 7.4 Write find_scene example tests in `pipeline/tests/test_find_scene.py`
    - Mocked search arguments for both date ranges; a Window_Read error for one candidate keeps evaluating; Scene_File holds only `id`, `date`, `platform`
    - _Requirements: 5.2, 5.9, 5.13_

## Notes

- Tasks marked with `*` are optional. Per the user's direction, Properties 3–11 (task 3) and Property 29 (task 5.17) are required tests; all other test sub-tasks are optional. Task 7 is optional in full and stays last.
- `raster_io.py` starts in task 1.3 with `open_stac` and `write_json_atomic` so the smoke test and boundary script can use them; task 4.1 adds the raster functions.
- Tests never touch the real `pipeline/work/` or `data/scores/`; they use `tmp_path` and monkeypatched config paths.
- `lib/types.ts`, `make_sample_data.py`, `validate_scores.py`, and `package.json` are not modified.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.1"] },
    { "id": 2, "tasks": ["1.4", "1.6", "2.1", "3.2", "4.1"] },
    { "id": 3, "tasks": ["1.5", "1.7", "2.2", "3.3", "4.2", "5.1"] },
    { "id": 4, "tasks": ["3.4", "4.3", "5.2", "5.7"] },
    { "id": 5, "tasks": ["3.5", "4.4", "5.3", "5.9"] },
    { "id": 6, "tasks": ["3.6", "4.5", "5.4", "5.14"] },
    { "id": 7, "tasks": ["3.7", "4.6", "5.17", "5.18"] },
    { "id": 8, "tasks": ["3.8", "4.7", "5.5", "6.1"] },
    { "id": 9, "tasks": ["3.9", "5.6"] },
    { "id": 10, "tasks": ["3.10", "5.8"] },
    { "id": 11, "tasks": ["3.11", "5.10"] },
    { "id": 12, "tasks": ["5.11"] },
    { "id": 13, "tasks": ["5.12"] },
    { "id": 14, "tasks": ["5.13"] },
    { "id": 15, "tasks": ["5.15"] },
    { "id": 16, "tasks": ["5.16"] },
    { "id": 17, "tasks": ["5.19"] },
    { "id": 18, "tasks": ["5.20"] },
    { "id": 19, "tasks": ["7.1"] },
    { "id": 20, "tasks": ["7.2"] },
    { "id": 21, "tasks": ["7.3"] },
    { "id": 22, "tasks": ["7.4"] }
  ]
}
```
