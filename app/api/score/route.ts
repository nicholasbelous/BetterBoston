// GET /api/score?lat=<num>&lng=<num>
// 200 ScoreLookupResponse (status: ok | no_data | out_of_coverage)
// 400 bad coordinates | 503 score files missing
// Contract: .kiro/specs/climatecheck-mvp/design.md ("API routes")
import type { NextRequest } from "next/server";
import { lookupScore } from "@/lib/scores";
import type { ApiError } from "@/lib/types";

function parseCoord(value: string | null, limit: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = parseCoord(params.get("lat"), 90);
  const lng = parseCoord(params.get("lng"), 180);
  if (lat === null || lng === null) {
    return Response.json(
      { error: "bad_request", message: "lat and lng must be valid numbers" } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    return Response.json(await lookupScore(lng, lat));
  } catch (err) {
    console.error("score lookup failed", err);
    return Response.json(
      { error: "scores_unavailable", message: "Score data isn't loaded yet." } satisfies ApiError,
      { status: 503 },
    );
  }
}
