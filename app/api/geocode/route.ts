// GET /api/geocode?q=<address>
// 200 LocationResult | 400 missing/too-long q | 404 no match | 502 geocoder error
// Contract: .kiro/specs/betterboston-mvp/design.md ("API routes")
import type { NextRequest } from "next/server";
import { geocodeAddress } from "@/lib/geocoder";
import type { ApiError, LocationResult } from "@/lib/types";

const MAX_QUERY_LENGTH = 200;

function error(status: number, code: string, message: string) {
  return Response.json({ error: code, message } satisfies ApiError, { status });
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return error(400, "bad_request", "Missing q");
  if (q.length > MAX_QUERY_LENGTH) {
    return error(400, "bad_request", `q must be ${MAX_QUERY_LENGTH} characters or fewer`);
  }

  try {
    const result = await geocodeAddress(q);
    if (!result) {
      return error(404, "not_found", "We couldn't find that address. Try adding the street number and city.");
    }
    return Response.json(result satisfies LocationResult);
  } catch (err) {
    console.error("geocode failed", err);
    return error(502, "geocoder_error", "The address lookup service isn't responding. Try again in a moment.");
  }
}
