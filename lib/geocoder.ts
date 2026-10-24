// Geocoder: address string -> LocationResult. Server-side only.
// Provider is picked by GEOCODER_PROVIDER (see lib/config.ts).
import "server-only";
import { config } from "@/lib/config";
import type { LocationResult } from "@/lib/types";

/**
 * TODO (task 1.3):
 * - census: GET https://geocoding.geo.census.gov/geocoder/locations/onelineaddress
 *     ?address=<q>&benchmark=Public_AR_Current&format=json
 *   Take result.addressMatches[0].coordinates {x: lng, y: lat} and matchedAddress.
 * - nominatim: GET {NOMINATIM_BASE_URL}/search?q=<q>&format=jsonv2&limit=1&countrycodes=us
 *   Send the GEOCODER_USER_AGENT header (required by their usage policy).
 * - Append ", MA" if the query has no state, to bias toward Massachusetts.
 * - Return null when there is no match. Throw on network errors.
 * - Use a short timeout (AbortSignal.timeout(5000)).
 */
export async function geocodeAddress(query: string): Promise<LocationResult | null> {
  void query;
  void config.geocoderProvider;
  throw new Error("geocodeAddress not implemented yet (task 1.3)");
}
