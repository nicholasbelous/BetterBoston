// GET /api/score?lat=<num>&lng=<num>
// 200 ScoreLookupResponse (status: ok | no_data | out_of_coverage) | 400 bad coordinates
// Contract: .kiro/specs/climatecheck-mvp/design.md ("API routes")
import type { NextRequest } from "next/server";
import type { ApiError } from "@/lib/types";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json(
      { error: "bad_request", message: "lat and lng must be numbers" } satisfies ApiError,
      { status: 400 },
    );
  }
  // TODO (task 1.2): return Response.json(await lookupScore(lng, lat)).
  return Response.json(
    { error: "not_implemented", message: "Score lookup is not built yet" } satisfies ApiError,
    { status: 501 },
  );
}
