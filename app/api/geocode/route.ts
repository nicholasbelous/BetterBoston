// GET /api/geocode?q=<address>
// 200 LocationResult | 400 missing q | 404 no match | 502 provider error
// Contract: .kiro/specs/climatecheck-mvp/design.md ("API routes")
import type { NextRequest } from "next/server";
import type { ApiError } from "@/lib/types";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return Response.json({ error: "bad_request", message: "Missing q" } satisfies ApiError, {
      status: 400,
    });
  }
  // TODO (task 1.3): cap q length (200 chars), call geocodeAddress(q) from lib/geocoder,
  // map null -> 404 "not_found", thrown errors -> 502 "geocoder_error".
  return Response.json(
    { error: "not_implemented", message: "Geocoding is not built yet" } satisfies ApiError,
    { status: 501 },
  );
}
