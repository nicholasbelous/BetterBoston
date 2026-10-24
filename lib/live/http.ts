// Shared helpers for live data sources: JSON fetch with timeout, a small
// in-memory TTL cache with in-flight de-duplication, ArcGIS point queries,
// and distance math. Server-side only.
import "server-only";
import { config } from "@/lib/config";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Massachusetts bounding box. Live routes only answer for points inside it. */
const MA_BOUNDS = { minLat: 41.2, maxLat: 42.9, minLng: -73.6, maxLng: -69.85 };

export function inMassachusetts(lat: number, lng: number): boolean {
  return lat >= MA_BOUNDS.minLat && lat <= MA_BOUNDS.maxLat && lng >= MA_BOUNDS.minLng && lng <= MA_BOUNDS.maxLng;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(
  url: string | URL,
  { timeoutMs = 6000, headers = {} }: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": config.geocoderUserAgent, ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new UpstreamError(`Request to ${new URL(url).host} failed: ${(err as Error).message}`);
  }
  if (!res.ok) throw new UpstreamError(`${new URL(url).host} returned HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

// ---------- cache ----------

interface Entry {
  expires: number;
  value: Promise<unknown>;
}

const cache = new Map<string, Entry>();
const MAX_ENTRIES = 2000;

/**
 * Returns the cached value for `key`, or runs `load` once and caches it for `ttlMs`.
 * Concurrent callers share the same in-flight promise. Failures are not cached.
 */
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;

  const value = load().catch((err: unknown) => {
    cache.delete(key);
    throw err;
  });
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expires: now + ttlMs, value });
  return value;
}

/** Rounds coordinates for cache keys. 3 decimals is about 100 m. */
export function coordKey(lat: number, lng: number, decimals = 3): string {
  return `${lat.toFixed(decimals)},${lng.toFixed(decimals)}`;
}

// ---------- ArcGIS REST ----------

export interface ArcgisFeature<A> {
  attributes: A;
  geometry?: { x: number; y: number };
}

interface ArcgisQueryResponse<A> {
  features?: ArcgisFeature<A>[];
  count?: number;
  error?: { code: number; message: string };
}

/**
 * Point query against an ArcGIS FeatureServer/MapServer layer.
 * With `distanceM`, returns features within that distance of the point.
 */
export async function arcgisPointQuery<A>(
  layerUrl: string,
  lat: number,
  lng: number,
  opts: { outFields?: string; distanceM?: number; returnGeometry?: boolean; timeoutMs?: number } = {},
): Promise<ArcgisFeature<A>[]> {
  const url = new URL(`${layerUrl}/query`);
  url.searchParams.set("geometry", `${lng},${lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", opts.outFields ?? "*");
  url.searchParams.set("returnGeometry", opts.returnGeometry ? "true" : "false");
  if (opts.returnGeometry) url.searchParams.set("outSR", "4326");
  if (opts.distanceM) {
    url.searchParams.set("distance", String(opts.distanceM));
    url.searchParams.set("units", "esriSRUnit_Meter");
  }
  url.searchParams.set("f", "json");

  const body = await fetchJson<ArcgisQueryResponse<A>>(url, { timeoutMs: opts.timeoutMs ?? 8000 });
  if (body.error) throw new UpstreamError(`ArcGIS error ${body.error.code}: ${body.error.message}`);
  return body.features ?? [];
}

/** True if the point falls inside any feature of the layer. */
export async function arcgisPointHit(layerUrl: string, lat: number, lng: number): Promise<boolean> {
  const url = new URL(`${layerUrl}/query`);
  url.searchParams.set("geometry", `${lng},${lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("returnCountOnly", "true");
  url.searchParams.set("f", "json");
  const body = await fetchJson<ArcgisQueryResponse<unknown>>(url, { timeoutMs: 8000 });
  if (body.error) throw new UpstreamError(`ArcGIS error ${body.error.code}: ${body.error.message}`);
  return (body.count ?? 0) > 0;
}

// ---------- math ----------

/** Straight-line distance in miles. */
export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

export function round(n: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}
