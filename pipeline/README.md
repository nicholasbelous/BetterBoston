# Landsat data pipeline

Builds `data/scores/demo_grid.geojson` and `data/scores/demo_grid.meta.json` from one Landsat Collection 2 Level-2 scene over Boston. Intermediate files go in `pipeline/work/`.

## Install

From the repo root:

```sh
python3 -m pip install -r pipeline/requirements.txt
```

## Run order

Run every command from the repo root. Each command must exit with status 0 before you run the next one.

1. `python3 pipeline/smoke_test.py`
2. `python3 pipeline/boston_boundary.py`
3. `python3 pipeline/fetch_landsat.py`
4. `python3 pipeline/build_grid.py`
5. `npm run validate:data`

### Optional: pick a clearer scene

Run `python3 pipeline/find_scene.py` only when `python3 pipeline/fetch_landsat.py` warns that the Clear_Fraction is below 0.95. It writes a new Scene_File (`pipeline/work/scene.json`). Then rerun `python3 pipeline/fetch_landsat.py`, followed by `python3 pipeline/build_grid.py`.

## Fallback: local EarthExplorer files (`--local DIR`)

Use this when the STAC API is unreachable.

1. Download these 4 GeoTIFFs of the scene from EarthExplorer: `ST_B10`, `SR_B4`, `SR_B5`, `QA_PIXEL`.
2. Put all 4 files in one directory, keeping the band name in each filename (for example `..._ST_B10.TIF`).
3. Run `python3 pipeline/fetch_landsat.py --local DIR`, where `DIR` is that directory.

`python3 pipeline/fetch_landsat.py --local DIR` replaces the `python3 pipeline/fetch_landsat.py` step of the run order. `python3 pipeline/boston_boundary.py` must still run before it.

Which scene to download: with `--local`, the scene ID and date come from the Scene_File (`pipeline/work/scene.json`) when it exists, and otherwise from `DEFAULT_SCENE_ID` (`LC09_L2SP_012031_20240625_02_T1`, 2024-06-25). Download the `ST_B10`, `SR_B4`, `SR_B5`, and `QA_PIXEL` files of that scene. The Fetcher never overwrites an existing Scene_File; it writes the default one only when none exists.

## Tests

From the repo root (offline, no network needed):

```sh
pytest pipeline/tests -q
```
