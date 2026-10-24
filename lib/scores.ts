// Score lookup: loads data/scores/demo_grid.geojson + demo_grid.meta.json
// and finds the cell containing a point.
// The pipeline output is the ONLY source of scores. Never compute or
// adjust scores here.
import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";
import type {
  GridResponse,
  ScoreCellFeature,
  ScoreGrid,
  ScoreLookupResponse,
  ScoreMetadata,
} from "@/lib/types";

export const GRID_FILE = "demo_grid.geojson";
export const META_FILE = "demo_grid.meta.json";

interface LoadedScores {
  grid: ScoreGrid;
  metadata: ScoreMetadata;
  byId: Map<string, ScoreCellFeature>;
  mtimeMs: number;
}

let cache: LoadedScores | null = null;

function scorePaths() {
  // data/ is already bundled via outputFileTracingIncludes in next.config.ts,
  // so the turbopackIgnore comments below stop Turbopack from tracing the whole project.
  const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), config.scoresDir);
  return { grid: path.join(dir, GRID_FILE), meta: path.join(dir, META_FILE) };
}

/**
 * Reads both files once and caches them. Reloads automatically when either
 * file changes on disk (e.g. Person 2 drops in a new grid), so no restart is needed.
 */
export async function loadScores(): Promise<LoadedScores> {
  const paths = scorePaths();
  let mtimeMs: number;
  try {
    const [g, m] = await Promise.all([
      stat(/*turbopackIgnore: true*/ paths.grid),
      stat(/*turbopackIgnore: true*/ paths.meta),
    ]);
    mtimeMs = Math.max(g.mtimeMs, m.mtimeMs);
  } catch {
    throw new Error(
      `Score files not found in ${config.scoresDir}/. Run "npm run sample:data" or the pipeline first.`,
    );
  }
  if (cache && cache.mtimeMs === mtimeMs) return cache;

  const [gridText, metaText] = await Promise.all([
    readFile(/*turbopackIgnore: true*/ paths.grid, "utf8"),
    readFile(/*turbopackIgnore: true*/ paths.meta, "utf8"),
  ]);
  const grid = JSON.parse(gridText) as ScoreGrid;
  const metadata = JSON.parse(metaText) as ScoreMetadata;

  const byId = new Map<string, ScoreCellFeature>();
  for (const feature of grid.features) byId.set(feature.properties.cell_id, feature);

  cache = { grid, metadata, byId, mtimeMs };
  return cache;
}

/** Ray-casting point-in-polygon test on the outer ring, with a bbox fast reject. */
export function pointInCell(lng: number, lat: number, feature: ScoreCellFeature): boolean {
  const [minX, minY, maxX, maxY] = feature.properties.bbox;
  if (lng < minX || lng > maxX || lat < minY || lat > maxY) return false;

  const ring = feature.geometry.coordinates[0] ?? [];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * - No containing cell -> out_of_coverage (the UI shows "coverage coming soon")
 * - Cell found but both scores are null -> no_data
 * - Otherwise -> ok
 */
export async function lookupScore(lng: number, lat: number): Promise<ScoreLookupResponse> {
  const { grid, metadata } = await loadScores();
  const feature = grid.features.find((f) => pointInCell(lng, lat, f));
  if (!feature) return { status: "out_of_coverage", metadata };

  const cell = feature.properties;
  const status = cell.heat_score === null && cell.tree_score === null ? "no_data" : "ok";
  return { status, cell, geometry: feature.geometry, metadata };
}

/** Used by /api/action-plan so the client never sends scores. */
export async function getCellById(
  cellId: string,
): Promise<{ feature: ScoreCellFeature; metadata: ScoreMetadata } | null> {
  const { byId, metadata } = await loadScores();
  const feature = byId.get(cellId);
  return feature ? { feature, metadata } : null;
}

let gridCache: { mtimeMs: number; value: GridResponse } | null = null;

/** Trimmed grid for coloring the map (GET /api/grid). Rebuilt only when the score files change. */
export async function getGrid(): Promise<GridResponse> {
  const loaded = await loadScores();
  if (gridCache && gridCache.mtimeMs === loaded.mtimeMs) return gridCache.value;

  const { grid, metadata } = loaded;
  const value: GridResponse = {
    type: "FeatureCollection",
    features: grid.features.map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        cell_id: f.properties.cell_id,
        neighborhood: f.properties.neighborhood,
        heat_score: f.properties.heat_score,
        tree_score: f.properties.tree_score,
        temp_diff_f: f.properties.temp_diff_f,
        pct_vegetated: f.properties.pct_vegetated,
        is_sample: f.properties.is_sample,
      },
    })),
    metadata: {
      is_sample: metadata.is_sample,
      generated_at: metadata.generated_at,
      area: metadata.area,
      heat: metadata.heat,
      tree: metadata.tree,
    },
  };
  gridCache = { mtimeMs: loaded.mtimeMs, value };
  return value;
}

/** Center of a cell's bounding box, used to fetch live data for a cell. */
export function cellCenter(feature: ScoreCellFeature): { lat: number; lng: number } {
  const [minX, minY, maxX, maxY] = feature.properties.bbox;
  return { lat: (minY + maxY) / 2, lng: (minX + maxX) / 2 };
}
