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
  /** Boston neighborhood (BPDA name) this cell belongs to, e.g. "Chinatown" */
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
  /** Live sources whose facts were used in this plan (e.g. ["weather", "trees"]) */
  live_sources_used: LiveSourceId[];
}

export interface ActionPlanRequest {
  cell_id: string;
  tenure: Tenure;
}

export interface ApiError {
  error: string;
  message: string;
}

// ---------- Score grid for the map (GET /api/grid) ----------

export interface GridCellSummary {
  type: "Feature";
  geometry: ScoreCellFeature["geometry"];
  properties: Pick<
    ScoreCellProperties,
    "cell_id" | "neighborhood" | "heat_score" | "tree_score" | "temp_diff_f" | "pct_vegetated" | "is_sample"
  >;
}

export interface GridResponse {
  type: "FeatureCollection";
  features: GridCellSummary[];
  metadata: Pick<ScoreMetadata, "is_sample" | "generated_at" | "area" | "heat" | "tree">;
}

// ---------- Live data (GET /api/live, GET /api/live/[source]) ----------
// Live values come straight from public APIs. They are never made up and
// never mixed with the pipeline scores. Every result carries its source and
// fetch time. Live weather is AIR temperature, not ground temperature.

export type LiveSourceId = "weather" | "air" | "flood" | "trees" | "places" | "area" | "climate";

export interface LiveCitation {
  /** Human-readable source, e.g. "National Weather Service" */
  name: string;
  url: string;
}

/** Wrapper for one live source. `ok: false` means hide the card; never show a substitute. */
export type LiveResult<T> =
  | { ok: true; data: T; sources: LiveCitation[]; fetched_at: string; note?: string }
  | { ok: false; error: "outside_coverage" | "unavailable" | "disabled"; message: string };

export interface WeatherAlert {
  event: string;
  headline: string | null;
  severity: string | null;
  ends: string | null;
}

export interface WeatherPeriod {
  name: string;
  temperature_f: number;
  is_daytime: boolean;
  short_forecast: string;
  precip_chance_pct: number | null;
}

export interface WeatherDay {
  date: string; // YYYY-MM-DD
  high_f: number | null;
  low_f: number | null;
  feels_like_high_f: number | null;
  uv_index_max: number | null;
  precip_chance_pct: number | null;
}

export interface LiveWeather {
  /** Latest observation at the nearest NWS station (air temperature) */
  observed: {
    station: string;
    station_name: string;
    time: string;
    temperature_f: number | null;
    heat_index_f: number | null;
    humidity_pct: number | null;
    description: string | null;
  } | null;
  /** NWS forecast periods (today, tonight, ...) */
  forecast: WeatherPeriod[];
  /** 7-day outlook from Open-Meteo */
  daily: WeatherDay[];
  current_uv_index: number | null;
  /** Days in the next 7 with a forecast high of 90°F or more */
  hot_days_next_7: number;
  alerts: WeatherAlert[];
  /** true when an active NWS heat product covers this point */
  heat_alert: boolean;
  air_quality_alert: boolean;
}

export type AqiCategory =
  | "Good"
  | "Moderate"
  | "Unhealthy for Sensitive Groups"
  | "Unhealthy"
  | "Very Unhealthy"
  | "Hazardous";

export interface LiveAir {
  us_aqi: number;
  category: AqiCategory;
  pm2_5_ugm3: number | null;
  ozone_ugm3: number | null;
  /** Main driver of the AQI right now */
  main_pollutant: "PM2.5" | "Ozone" | null;
  max_aqi_next_24h: number | null;
  max_category_next_24h: AqiCategory | null;
  /** Open-Meteo air quality is a model estimate, not a monitor reading */
  modeled: true;
}

export interface FloodScenario {
  sea_level_rise_in: 9 | 21 | 36;
  /** Flooded at high tide (monthly high tide) */
  high_tide: boolean;
  /** Flooded in a storm with a 10% chance each year */
  storm_10pct: boolean;
  /** Flooded in a storm with a 1% chance each year ("100-year storm") */
  storm_1pct: boolean;
}

export interface LiveFlood {
  fema_zone: string | null;
  fema_zone_description: string | null;
  /** Special Flood Hazard Area (high-risk zone) per FEMA */
  fema_high_risk: boolean | null;
  future: FloodScenario[];
  /** Smallest sea level rise (inches) at which a 1% storm floods this point, or null if none of the scenarios */
  first_flooded_at_in: 9 | 21 | 36 | null;
}

export interface LiveTrees {
  radius_m: number;
  /** City-owned street and park trees in the inventory (empty pits excluded) */
  tree_count: number;
  /** Empty pits / planting sites: spots where the City could plant a tree */
  empty_planting_sites: number;
  top_species: { name: string; count: number }[];
  size_mix: { small: number; medium: number; large: number; unknown: number };
}

export interface NearbyPlace {
  kind: "community_center" | "pool" | "library";
  name: string;
  address: string | null;
  neighborhood: string | null;
  /** As listed in the City dataset (no area code added) */
  phone: string | null;
  distance_mi: number;
  lat: number;
  lng: number;
}

export interface LivePlaces {
  community_centers: NearbyPlace[];
  pools: NearbyPlace[];
  libraries: NearbyPlace[];
}

export interface LiveArea {
  neighborhood: string | null;
  in_boston: boolean;
  tract: {
    geoid: string;
    name: string | null;
    population: number;
    /**
     * Shares of the tract population, 0-100 (2008-2012 ACS estimates, Climate Ready Boston 2016).
     * Limited English and medical illness are left out on purpose: the dataset's definitions for them are unclear.
     */
    pct_older_adults: number | null;
    pct_children_under_5: number | null;
    /** Below 150% of the poverty level */
    pct_low_to_no_income: number | null;
    pct_with_disability: number | null;
  } | null;
}

export interface LiveClimate {
  /** Most recent complete summer (June-August) */
  last_summer: {
    year: number;
    days_90f_or_more: number;
    hottest_f: number;
    hottest_date: string;
  };
  /** 1991-2020 average, ERA5 reanalysis via Open-Meteo */
  baseline_days_90f_per_year: number;
  /** CMIP6 high-resolution models via Open-Meteo, days per year with highs of 90°F or more */
  projection: {
    model_count: number;
    period_past: "1995-2014";
    period_future: "2031-2050";
    median_days_past: number;
    median_days_future: number;
    range_days_future: [number, number];
  } | null;
}

export interface LiveBundle {
  lat: number;
  lng: number;
  fetched_at: string;
  weather: LiveResult<LiveWeather>;
  air: LiveResult<LiveAir>;
  flood: LiveResult<LiveFlood>;
  trees: LiveResult<LiveTrees>;
  places: LiveResult<LivePlaces>;
  area: LiveResult<LiveArea>;
  climate: LiveResult<LiveClimate>;
}
