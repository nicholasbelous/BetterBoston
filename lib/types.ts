// Shared types for ClimateCheck MA.
// The score types mirror the pipeline output schema exactly
// (see .kiro/specs/climatecheck-mvp/design.md, "GeoJSON schema").
// If you change a field here, change pipeline/build_grid.py,
// pipeline/make_sample_data.py, and pipeline/validate_scores.py too.

/** [minLng, minLat, maxLng, maxLat] in EPSG:4326 */
export type BBox = [number, number, number, number];

export type Tenure = "renter" | "owner";

// ---------- Scores (data/scores/) ----------

/** Properties of one grid cell in data/scores/demo_grid.geojson */
export interface ScoreCellProperties {
  cell_id: string;
  bbox: BBox;
  /** Demo neighborhood this cell belongs to, e.g. "Chinatown" */
  neighborhood: string;
  /** Mean land surface temperature (°F) on the scene date. null = not enough valid pixels */
  mean_surface_temp_f: number | null;
  /** mean_surface_temp_f minus the reference-area average (°F). Positive = hotter */
  temp_diff_f: number | null;
  /** Percent of the cell classified as vegetated by NDVI, 0-100 */
  pct_vegetated: number | null;
  /** 0-100, higher = hotter ground than other blocks in the reference area */
  heat_score: number | null;
  /** 0-100, higher = greener than other mapped blocks */
  tree_score: number | null;
  /** Fraction (0-1) of usable Landsat pixels (not cloud, shadow, water, fill) */
  heat_valid_frac: number;
  /** Fraction (0-1) of usable aerial-image pixels */
  tree_valid_frac: number;
  /** true for generated SAMPLE data. Must match ScoreMetadata.is_sample */
  is_sample: boolean;
}

export interface ScoreCellFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: ScoreCellProperties;
}

export interface ScoreGrid {
  type: "FeatureCollection";
  features: ScoreCellFeature[];
}

/** Convenience alias used by the app: a cell's properties are "the scores" */
export type ScoreCell = ScoreCellProperties;

export interface SourceRef {
  name: string;
  url: string;
}

/** data/scores/demo_grid.meta.json */
export interface ScoreMetadata {
  schema_version: 1;
  /** true = SAMPLE data. The UI must show SampleDataBanner and never present it as real */
  is_sample: boolean;
  generated_at: string; // ISO 8601
  generated_by: string; // script name
  area: {
    name: string;
    neighborhoods: string[];
    bbox: BBox;
  };
  grid: {
    cell_size_m: number;
    processing_crs: string; // e.g. "EPSG:26919"
    output_crs: "EPSG:4326";
    cell_count: number;
  };
  heat: {
    source: string;
    scene_id: string;
    scene_date: string; // YYYY-MM-DD
    reference_area: string; // what temp_diff_f and heat_score compare against
    reference_mean_f: number | null;
    min_valid_frac: number;
  };
  tree: {
    source: string;
    imagery_dates: string; // e.g. "2025-03-18 to 2025-04-23"
    ndvi_threshold: number;
    leaf_off: boolean; // MassGIS 2025 was flown before leaf-out
    reference_area: string;
    min_valid_frac: number;
  };
  sources: SourceRef[];
  notes: string[];
}

/** Response of GET /api/score */
export type ScoreLookupResponse =
  | { status: "ok"; cell: ScoreCell; geometry: ScoreCellFeature["geometry"]; metadata: ScoreMetadata }
  | { status: "out_of_coverage"; metadata: ScoreMetadata }
  | { status: "no_data"; cell: ScoreCell; geometry: ScoreCellFeature["geometry"]; metadata: ScoreMetadata };

// ---------- Location ----------

export type LocationSource = "census" | "nominatim" | "device";

/** Response of GET /api/geocode, also built client-side for "use my location" */
export interface LocationResult {
  lat: number;
  lng: number;
  /** Human-readable label, e.g. the matched address */
  label: string;
  source: LocationSource;
}

// ---------- Programs (data/programs/) ----------

export type ProgramCategory =
  | "cooling_center"
  | "tree_request"
  | "rebate"
  | "community_solar"
  | "rooftop_solar";

export type ProgramTopic = "heat" | "trees" | "energy" | "solar";

export interface Program {
  /** Stable id the AI must cite, e.g. "boston-tree-request". Unique across all files */
  id: string;
  category: ProgramCategory;
  name: string;
  /** Plain-language description. Only verified facts */
  description: string;
  link: string;
  /** Who can use it */
  audience: Tenure[];
  /** Which scores make it relevant */
  topics: ProgramTopic[];
  /** YYYY-MM-DD when a human last checked the facts; null = NOT verified, never shown to users */
  last_verified: string | null;
  /** Optional verified details (address, hours, phone). Leave out anything not verified */
  details?: Record<string, string>;
}

export interface ProgramFile {
  category: ProgramCategory;
  programs: Program[];
}

// ---------- Action plan ----------

export interface ActionItem {
  title: string;
  /** Why this matters for this block, tied to its scores */
  why: string;
  /** Must be an id from data/programs. Validated server-side */
  program_id: string;
  /** Filled server-side from the program record, never from the model */
  link: string;
}

/** Response of POST /api/action-plan */
export interface ActionPlan {
  summary: string;
  actions: ActionItem[]; // 3-5 items
  tenure: Tenure;
  cell_id: string;
  /** "ai" = written by Claude from the program list; "rules" = built-in fallback (no key, or AI output failed checks) */
  source: "ai" | "rules";
  /** Claude model id, or "rules" */
  model_id: string;
  generated_at: string;
  /** true when the scores behind this plan are SAMPLE data */
  based_on_sample_data: boolean;
}

export interface ActionPlanRequest {
  cell_id: string;
  tenure: Tenure;
}

export interface ApiError {
  error: string;
  message: string;
}
