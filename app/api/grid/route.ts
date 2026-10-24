// GET /api/grid
// 200 GridResponse: every score cell (trimmed properties) + score metadata, for coloring the map
// 503 score files missing
// Contract: .kiro/specs/climatecheck-mvp/design.md ("API routes")
import { getGrid } from "@/lib/scores";
import type { ApiError } from "@/lib/types";

export async function GET() {
  try {
    return Response.json(await getGrid());
  } catch (err) {
    console.error("grid load failed", err);
    return Response.json(
      { error: "scores_unavailable", message: "Score data isn't loaded yet." } satisfies ApiError,
      { status: 503 },
    );
  }
}
