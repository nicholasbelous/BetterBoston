// GET /api/grid
// 200 GridResponse: every score cell (trimmed properties) + score metadata, for coloring the map
// 503 score files missing
// Contract: .kiro/specs/climatecheck-mvp/design.md ("API routes")
import { getGrid } from "@/lib/scores";
import type { ApiError } from "@/lib/types";

export async function GET() {
  try {
    // The citywide grid is a few MB and only changes when the pipeline reruns.
    return Response.json(await getGrid(), { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    console.error("grid load failed", err);
    return Response.json(
      { error: "scores_unavailable", message: "Score data isn't loaded yet." } satisfies ApiError,
      { status: 503 },
    );
  }
}
