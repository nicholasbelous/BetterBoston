// GET /api/live?lat=<num>&lng=<num>
// 200 LiveBundle: every live source for the point, each { ok: true, data, sources, fetched_at }
//     or { ok: false, error, message }. Hide any card whose source is not ok.
// 400 bad coordinates
// Contract: .kiro/specs/betterboston-mvp/design.md ("Live data")
import type { NextRequest } from "next/server";
import { parseLatLng } from "@/lib/live/params";
import { getLiveBundle } from "@/lib/live";
import type { ApiError } from "@/lib/types";

export async function GET(request: NextRequest) {
  const point = parseLatLng(request.nextUrl.searchParams);
  if (!point) {
    return Response.json(
      { error: "bad_request", message: "lat and lng must be valid numbers" } satisfies ApiError,
      { status: 400 },
    );
  }
  return Response.json(await getLiveBundle(point.lat, point.lng));
}
