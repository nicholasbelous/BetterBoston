// Client-side data access for the screens.
//
// Every call tries the real API route first (GET /api/geocode, GET /api/score,
// POST /api/action-plan). If the backend is not built yet (501), errors out, or
// is unreachable, we fall back to the clearly labeled mock data in mocks/ so the
// UI still works. Real "not found" answers (404) are NEVER replaced by mock data.
//
// This file only reads the API contracts in lib/types.ts. It does not change them.
import type {
  ActionPlan,
  GridResponse,
  LiveBundle,
  LocationResult,
  PlanAudience,
  ScoreCell,
  ScoreCellFeature,
  ScoreGrid,
  ScoreLookupResponse,
  ScoreMetadata,
} from "@/lib/types";
import { DEMO_ADDRESSES, type DemoAddress } from "@/mocks/demoAddresses.mock";
import { findMockCell, MOCK_GRID, MOCK_METADATA } from "@/mocks/climate.mock";
import { mockExtrasFor, type HomeExtras } from "@/mocks/homeExtras.mock";

export type DataOrigin = "api" | "mock";

// ---------- helpers ----------

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 6000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null; // network error or timeout
  } finally {
    clearTimeout(timer);
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- geocoding ----------

export interface ResolvedLocation {
  lat: number;
  lng: number;
  label: string;
  origin: DataOrigin | "device";
}

export type AddressErrorKind = "empty" | "not_found" | "unavailable";

export class AddressError extends Error {
  kind: AddressErrorKind;
  constructor(kind: AddressErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function matchDemoAddress(query: string): DemoAddress | null {
  const n = normalize(query);
  if (n.length < 3) return null;
  return (
    DEMO_ADDRESSES.find(
      (a) =>
        a.aliases.some((alias) => n.includes(alias) || (n.length >= 4 && alias.startsWith(n))) ||
        normalize(`${a.label} ${a.cityLine}`).includes(n),
    ) ?? null
  );
}

export function demoToLocation(a: DemoAddress): ResolvedLocation {
  return { lat: a.lat, lng: a.lng, label: `${a.label}, ${a.cityLine}`, origin: "mock" };
}

export async function geocodeAddress(q: string): Promise<ResolvedLocation> {
  const query = q.trim().slice(0, 200);
  if (!query) throw new AddressError("empty", "Type an address to search.");

  const res = await fetchWithTimeout(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (res?.ok) {
    const body = (await res.json()) as LocationResult;
    return { lat: body.lat, lng: body.lng, label: body.label, origin: "api" };
  }
  if (res?.status === 404) {
    throw new AddressError("not_found", "We couldn't find that address. Try adding the city.");
  }

  // Backend not built yet (501), provider trouble (502), or offline: use demo addresses.
  const demo = matchDemoAddress(query);
  if (demo) return demoToLocation(demo);
  throw new AddressError(
    "unavailable",
    "Live address search isn't connected yet. Try one of the demo addresses.",
  );
}

// ---------- score lookup ----------

export interface ReportData {
  status: "ok" | "no_data" | "out_of_coverage";
  origin: DataOrigin;
  /** true when the numbers are sample/mock. The SAMPLE banner must show. */
  isSample: boolean;
  cell: ScoreCell | null;
  geometry: ScoreCellFeature["geometry"] | null;
  metadata: ScoreMetadata;
  /** Flood and air quality are always mock for now (no dataset yet). */
  extras: HomeExtras;
}

function mockReport(lat: number, lng: number): ReportData {
  const hit = findMockCell(lat, lng);
  if (!hit) {
    return {
      status: "out_of_coverage",
      origin: "mock",
      isSample: true,
      cell: null,
      geometry: null,
      metadata: MOCK_METADATA,
      extras: mockExtrasFor(null),
    };
  }
  return {
    status: "ok",
    origin: "mock",
    isSample: true,
    cell: hit.properties,
    geometry: hit.geometry,
    metadata: MOCK_METADATA,
    extras: mockExtrasFor(hit.properties.neighborhood),
  };
}

export async function loadReport(lat: number, lng: number): Promise<ReportData> {
  const res = await fetchWithTimeout(`/api/score?lat=${lat}&lng=${lng}`);
  if (res?.ok) {
    try {
      const body = (await res.json()) as ScoreLookupResponse;
      const cell = body.status === "out_of_coverage" ? null : body.cell;
      return {
        status: body.status,
        origin: "api",
        isSample: body.metadata.is_sample,
        cell,
        geometry: body.status === "out_of_coverage" ? null : body.geometry,
        metadata: body.metadata,
        extras: mockExtrasFor(cell?.neighborhood),
      };
    } catch {
      // malformed body: fall through to the mock
    }
  }
  return mockReport(lat, lng);
}

// ---------- score grid for the map ----------

export interface GridData {
  origin: DataOrigin;
  isSample: boolean;
  grid: GridResponse | ScoreGrid;
}

let gridCache: Promise<GridData> | null = null;

/** Every score cell, for coloring the map. Same cells and ids as /api/score. Cached per page load. */
export function loadGrid(): Promise<GridData> {
  gridCache ??= (async (): Promise<GridData> => {
    // The citywide grid is a few MB, so give slow phone connections time.
    const res = await fetchWithTimeout("/api/grid", {}, 30000);
    if (res?.ok) {
      try {
        const body = (await res.json()) as GridResponse;
        return { origin: "api", isSample: body.metadata.is_sample, grid: body };
      } catch {
        /* fall through */
      }
    }
    gridCache = null; // try the API again next time
    return { origin: "mock", isSample: true, grid: MOCK_GRID };
  })();
  return gridCache;
}

// ---------- live data (GET /api/live) ----------

/** Live context for a point. Null when the route fails; each source may still be ok: false (hide its card). */
export async function loadLive(lat: number, lng: number): Promise<LiveBundle | null> {
  const res = await fetchWithTimeout(`/api/live?lat=${lat}&lng=${lng}`, {}, 15000);
  if (!res?.ok) return null;
  try {
    return (await res.json()) as LiveBundle;
  } catch {
    return null;
  }
}

// ---------- action plan ----------

export type ActionPlanOutcome = { origin: "api"; plan: ActionPlan } | { origin: "mock" };

export async function loadActionPlan(cellId: string, tenure: PlanAudience): Promise<ActionPlanOutcome> {
  const res = await fetchWithTimeout(
    "/api/action-plan",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cell_id: cellId, tenure }),
    },
    20000, // model calls are slower than lookups
  );
  if (res?.ok) {
    try {
      return { origin: "api", plan: (await res.json()) as ActionPlan };
    } catch {
      /* fall through */
    }
  }
  return { origin: "mock" };
}
