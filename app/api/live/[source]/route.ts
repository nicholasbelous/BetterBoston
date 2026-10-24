// GET /api/live/<source>?lat=<num>&lng=<num>
// source: weather | air | flood | trees | places | area | climate
// 200 LiveResult for that source ({ ok: false } means hide the card)
// 400 bad coordinates | 404 unknown source
// Contract: .kiro/specs/betterboston-mvp/design.md ("Live data")
import type { NextRequest } from "next/server";
import { getLiveSource, isLiveSource, LIVE_SOURCE_IDS } from "@/lib/live";
import { parseLatLng } from "@/lib/live/params";
import type { ApiError } from "@/lib/types";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/live/[source]">) {
  const { source } = await ctx.params;
  if (!isLiveSource(source)) {
    return Response.json(
      { error: "not_found", message: `Unknown source. Use one of: ${LIVE_SOURCE_IDS.join(", ")}` } satisfies ApiError,
      { status: 404 },
    );
  }
  const point = parseLatLng(request.nextUrl.searchParams);
  if (!point) {
    return Response.json(
      { error: "bad_request", message: "lat and lng must be valid numbers" } satisfies ApiError,
      { status: 400 },
    );
  }
  return Response.json(await getLiveSource(source, point.lat, point.lng));
}
