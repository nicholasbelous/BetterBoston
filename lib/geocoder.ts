// Geocoder: address string -> LocationResult. Server-side only.
// GEOCODER_PROVIDER=census (default): try the US Census geocoder first, then
//   fall back to Nominatim. Census only matches street addresses; Nominatim
//   also understands places like "Chinatown, Boston".
// GEOCODER_PROVIDER=nominatim: use Nominatim only.
import "server-only";
import { config } from "@/lib/config";
import type { LocationResult } from "@/lib/types";

const TIMEOUT_MS = 5000;
const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
/** Massachusetts bounding box (minLng, maxLat, maxLng, minLat) for Nominatim's viewbox */
const MA_VIEWBOX = "-73.51,42.89,-69.93,41.24";

/** Adds ", MA" unless the query already names Massachusetts or has a ZIP code. */
export function withMassachusetts(query: string): string {
  // Not "mass": that would skip queries like "100 Mass Ave, Boston".
  const hasMa = /\b(ma|massachusetts)\b/i.test(query);
  const hasZip = /\b\d{5}(-\d{4})?\b/.test(query);
  return hasMa || hasZip ? query : `${query}, MA`;
}

interface CensusResponse {
  result?: {
    addressMatches?: {
      matchedAddress: string;
      coordinates: { x: number; y: number };
    }[];
  };
}

async function geocodeCensus(query: string): Promise<LocationResult | null> {
  const url = new URL(CENSUS_URL);
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Census geocoder returned HTTP ${res.status}`);
  const data = (await res.json()) as CensusResponse;

  const match = data.result?.addressMatches?.[0];
  if (!match) return null;
  return {
    lat: match.coordinates.y,
    lng: match.coordinates.x,
    label: match.matchedAddress,
    source: "census",
  };
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocodeNominatim(query: string): Promise<LocationResult | null> {
  const url = new URL("/search", config.nominatimBaseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", MA_VIEWBOX);
  url.searchParams.set("bounded", "1");

  // Nominatim's usage policy requires an identifying User-Agent.
  const res = await fetch(url, {
    headers: { "User-Agent": config.geocoderUserAgent },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nominatim returned HTTP ${res.status}`);
  const data = (await res.json()) as NominatimResult[];

  const hit = data[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: hit.display_name, source: "nominatim" };
}

/**
 * Returns the best match, or null if no provider found the address.
 * Throws only if every provider failed with an error (network, timeout, HTTP error).
 */
export async function geocodeAddress(rawQuery: string): Promise<LocationResult | null> {
  const query = withMassachusetts(rawQuery.trim());
  const providers =
    config.geocoderProvider === "nominatim" ? [geocodeNominatim] : [geocodeCensus, geocodeNominatim];

  const errors: unknown[] = [];
  for (const provider of providers) {
    try {
      const result = await provider(query);
      if (result) return result;
    } catch (err) {
      errors.push(err);
    }
  }
  if (errors.length === providers.length) {
    throw new Error("All geocoders failed", { cause: errors });
  }
  return null;
}
