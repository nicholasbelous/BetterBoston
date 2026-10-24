// Which place is the user looking at? Carried between screens in the URL as
// ?lat=..&lng=..&q=<label>. When nothing is chosen yet, a demo address is used.
// Pure functions only, safe in server and client components.
import { DEFAULT_DEMO_ADDRESS } from "@/mocks/demoAddresses.mock";

export interface LocationContext {
  lat: number;
  lng: number;
  /** Full label, e.g. "50 Hudson St, Boston, MA 02111". */
  q: string;
  /** true when no location was chosen and the demo address is being shown. */
  isDefault: boolean;
}

export const DEFAULT_LOCATION: LocationContext = {
  lat: DEFAULT_DEMO_ADDRESS.lat,
  lng: DEFAULT_DEMO_ADDRESS.lng,
  q: `${DEFAULT_DEMO_ADDRESS.label}, ${DEFAULT_DEMO_ADDRESS.cityLine}`,
  isDefault: true,
};

type Getter = (key: string) => string | null | undefined;

/** Read and validate lat/lng/q. Anything invalid falls back to the demo address. */
export function parseLocation(get: Getter): LocationContext {
  const rawLat = get("lat");
  const rawLng = get("lng");
  if (!rawLat || !rawLng) return DEFAULT_LOCATION;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return DEFAULT_LOCATION;
  }
  const q = (get("q") ?? "").trim().slice(0, 200);
  return { lat, lng, q: q || "Selected location", isDefault: false };
}

/** Adapter for Next.js `searchParams` objects. */
export function recordGetter(params: Record<string, string | string[] | undefined>): Getter {
  return (key) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
}

export function locationQuery(ctx: Pick<LocationContext, "lat" | "lng" | "q">): string {
  const p = new URLSearchParams();
  p.set("lat", ctx.lat.toFixed(6));
  p.set("lng", ctx.lng.toFixed(6));
  p.set("q", ctx.q);
  return p.toString();
}

/** Build a screen link that keeps the chosen location. */
export function withLocation(path: string, ctx: Pick<LocationContext, "lat" | "lng" | "q"> | null): string {
  return ctx ? `${path}?${locationQuery(ctx)}` : path;
}

/** "72 Beacon St, Boston, MA 02108" -> { title: "72 Beacon St", sub: "Boston, MA 02108" } */
export function splitAddress(q: string): { title: string; sub: string } {
  const i = q.indexOf(",");
  if (i === -1) return { title: q, sub: "" };
  return { title: q.slice(0, i).trim(), sub: q.slice(i + 1).trim() };
}
