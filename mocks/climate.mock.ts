// ============================================================================
// MOCK DATA - NOT REAL. Generated sample score grid for the frontend.
//
// Everything here is made up so the UI can be built and demoed before the real
// pipeline output (data/scores/demo_grid.*) exists. All cells have
// is_sample: true and the metadata says so, so the UI shows the SAMPLE banner.
// Shapes match lib/types.ts (ScoreCellProperties, ScoreGrid, ScoreMetadata).
// ============================================================================
import type {
  BBox,
  ScoreCell,
  ScoreCellFeature,
  ScoreGrid,
  ScoreMetadata,
} from "@/lib/types";
import { DEMO_ADDRESSES } from "@/mocks/demoAddresses.mock";

/** Per-area "personality" of the fake data. anchor* values are set exactly on the demo address cell. */
const AREAS: Record<
  string,
  { baseHeat: number; baseTree: number; anchorHeat: number; anchorTree: number; seed: number }
> = {
  "Beacon Hill": { baseHeat: 66, baseTree: 34, anchorHeat: 82, anchorTree: 24, seed: 1.3 },
  Chinatown: { baseHeat: 80, baseTree: 16, anchorHeat: 91, anchorTree: 11, seed: 4.1 },
  "West Roxbury": { baseHeat: 30, baseTree: 78, anchorHeat: 28, anchorTree: 84, seed: 2.7 },
  "East Boston": { baseHeat: 58, baseTree: 38, anchorHeat: 62, anchorTree: 40, seed: 5.9 },
};

const COLS = 21;
const ROWS = 15;
// ~100 m cells at Boston's latitude
const D_LAT = 0.0009;
const D_LNG = 0.00122;

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Deterministic pseudo-random in [0, 1) so the map looks the same on every load. */
function hash(i: number, j: number, seed: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function buildCells(): ScoreCellFeature[] {
  const features: ScoreCellFeature[] = [];
  for (const area of DEMO_ADDRESSES) {
    const tune = AREAS[area.neighborhood];
    if (!tune) continue;
    const midCol = Math.floor(COLS / 2);
    const midRow = Math.floor(ROWS / 2);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Smooth field + a little speckle, so hot and cool patches look like city blocks.
        const field =
          Math.sin(c * 0.55 + tune.seed) * Math.cos(r * 0.47 + tune.seed * 1.7) +
          0.5 * Math.sin(c * 0.21 - r * 0.33 + tune.seed * 3.1);
        const speckle = hash(c, r, tune.seed) - 0.5;
        let heat = clamp(tune.baseHeat + field * 14 + speckle * 10);
        let tree = clamp(tune.baseTree - field * 12 + (hash(r, c, tune.seed + 9) - 0.5) * 12);
        const isAnchor = c === midCol && r === midRow;
        if (isAnchor) {
          heat = tune.anchorHeat;
          tree = tune.anchorTree;
        }
        heat = Math.round(heat);
        tree = Math.round(tree);

        const centerLng = area.lng + (c - midCol) * D_LNG;
        const centerLat = area.lat + (midRow - r) * D_LAT;
        const w = centerLng - D_LNG / 2;
        const e = centerLng + D_LNG / 2;
        const s = centerLat - D_LAT / 2;
        const n = centerLat + D_LAT / 2;
        const bbox: BBox = [w, s, e, n];

        features.push({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [w, s],
                [e, s],
                [e, n],
                [w, n],
                [w, s],
              ],
            ],
          },
          properties: {
            cell_id: `mock-${area.id}-${String(c).padStart(2, "0")}-${String(r).padStart(2, "0")}`,
            bbox,
            neighborhood: area.neighborhood,
            mean_surface_temp_f: round1(86 + heat * 0.16),
            temp_diff_f: round1((heat - 50) * 0.18),
            pct_vegetated: Math.round(tree * 0.5),
            heat_score: heat,
            tree_score: tree,
            heat_valid_frac: 0.97,
            tree_valid_frac: 0.95,
            is_sample: true,
          },
        });
      }
    }
  }
  return features;
}

export const MOCK_GRID: ScoreGrid = { type: "FeatureCollection", features: buildCells() };

export const MOCK_METADATA: ScoreMetadata = {
  schema_version: 1,
  is_sample: true,
  generated_at: "2026-10-24T00:00:00Z",
  generated_by: "mocks/climate.mock.ts",
  area: {
    name: "Boston demo areas (MOCK)",
    neighborhoods: DEMO_ADDRESSES.map((a) => a.neighborhood),
    bbox: [-71.19, 42.27, -71.02, 42.38],
  },
  grid: {
    cell_size_m: 100,
    processing_crs: "EPSG:26919",
    output_crs: "EPSG:4326",
    cell_count: MOCK_GRID.features.length,
  },
  heat: {
    source: "MOCK data (not Landsat)",
    scene_id: "MOCK",
    scene_date: "SAMPLE",
    reference_area: "the Boston average (sample)",
    reference_mean_f: 94,
    min_valid_frac: 0.5,
  },
  tree: {
    source: "MOCK data (not MassGIS)",
    imagery_dates: "SAMPLE",
    ndvi_threshold: 0.3,
    leaf_off: true,
    reference_area: "other mapped blocks (sample)",
    min_valid_frac: 0.5,
  },
  sources: [],
  notes: ["MOCK DATA: generated by mocks/climate.mock.ts. Not real measurements."],
};

/** Find the mock cell that contains a point, or null when outside the demo areas. */
export function findMockCell(lat: number, lng: number): ScoreCellFeature | null {
  for (const f of MOCK_GRID.features) {
    const [w, s, e, n] = f.properties.bbox;
    if (lng >= w && lng < e && lat >= s && lat < n) return f;
  }
  return null;
}

export function findMockCellById(cellId: string): ScoreCell | null {
  return MOCK_GRID.features.find((f) => f.properties.cell_id === cellId)?.properties ?? null;
}
