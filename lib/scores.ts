// Score lookup: loads data/scores/demo_grid.geojson + demo_grid.meta.json
// once per server process and finds the cell containing a point.
// The pipeline output is the ONLY source of scores. Never compute or
// adjust scores here.
import "server-only";
import type {
  ScoreCellFeature,
  ScoreGrid,
  ScoreLookupResponse,
  ScoreMetadata,
} from "@/lib/types";

export const GRID_PATH = "data/scores/demo_grid.geojson";
export const META_PATH = "data/scores/demo_grid.meta.json";

/**
 * TODO (task 1.2): read both files with fs/promises from process.cwd(),
 * JSON.parse, cache in a module-level variable. Throw a clear error if
 * either file is missing ("run npm run sample:data").
 */
export async function loadScores(): Promise<{ grid: ScoreGrid; metadata: ScoreMetadata }> {
  throw new Error("loadScores not implemented yet (task 1.2)");
}

/**
 * Ray-casting point-in-polygon test on the outer ring.
 * TODO (task 1.2): implement. ~15 lines; no dependency needed.
 * Check the feature's bbox first as a fast reject.
 */
export function pointInCell(lng: number, lat: number, feature: ScoreCellFeature): boolean {
  void lng;
  void lat;
  void feature;
  return false;
}

/**
 * TODO (task 1.2):
 * - No containing cell -> { status: "out_of_coverage" }
 * - Cell found but heat_score AND tree_score are null -> { status: "no_data" }
 * - Otherwise -> { status: "ok", cell, geometry, metadata }
 */
export async function lookupScore(lng: number, lat: number): Promise<ScoreLookupResponse> {
  void lng;
  void lat;
  throw new Error("lookupScore not implemented yet (task 1.2)");
}

/** TODO (task 4.2): used by /api/action-plan so the client never sends scores. */
export async function getCellById(cellId: string): Promise<ScoreCellFeature | null> {
  void cellId;
  return null;
}
