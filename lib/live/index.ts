// Live data registry. Each source is independent: one failing never breaks
// the others, and a failed source is reported as { ok: false } so the UI
// hides that card. Nothing here is ever made up.
import "server-only";
import { config } from "@/lib/config";
import type { LiveBundle, LiveResult, LiveSourceId } from "@/lib/types";
import { getAir } from "@/lib/live/air";
import { getArea } from "@/lib/live/area";
import { getClimate } from "@/lib/live/climate";
import { getFlood } from "@/lib/live/flood";
import { inMassachusetts } from "@/lib/live/http";
import { getPlaces } from "@/lib/live/places";
import { getTrees } from "@/lib/live/trees";
import { getWeather } from "@/lib/live/weather";

type Loader = (lat: number, lng: number) => Promise<LiveResult<unknown>>;

export const LIVE_SOURCES: Record<LiveSourceId, Loader> = {
  weather: getWeather,
  air: getAir,
  flood: getFlood,
  trees: getTrees,
  places: getPlaces,
  area: getArea,
  climate: getClimate,
};

export const LIVE_SOURCE_IDS = Object.keys(LIVE_SOURCES) as LiveSourceId[];

export function isLiveSource(id: string): id is LiveSourceId {
  return id in LIVE_SOURCES;
}

const UNAVAILABLE = { ok: false, error: "unavailable", message: "This data source isn't responding right now." } as const;
const TIMED_OUT = { ok: false, error: "unavailable", message: "This data source took too long to respond." } as const;

function withTimeout<T>(promise: Promise<LiveResult<T>>, ms: number): Promise<LiveResult<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(TIMED_OUT), ms);
    promise
      .then(resolve, (err: unknown) => {
        console.warn("live source failed:", (err as Error).message);
        resolve(UNAVAILABLE);
      })
      .finally(() => clearTimeout(timer));
  });
}

/** One live source for a point, never throws. */
export async function getLiveSource<T = unknown>(
  id: LiveSourceId,
  lat: number,
  lng: number,
  timeoutMs = 20_000,
): Promise<LiveResult<T>> {
  if (!config.liveDataEnabled) {
    return { ok: false, error: "disabled", message: "Live data is turned off (LIVE_DATA_ENABLED=false)." };
  }
  if (!inMassachusetts(lat, lng)) {
    return { ok: false, error: "outside_coverage", message: "Live data is only available for Massachusetts." };
  }
  return withTimeout(LIVE_SOURCES[id](lat, lng) as Promise<LiveResult<T>>, timeoutMs);
}

/** All live sources for a point, fetched in parallel. Never throws. */
export async function getLiveBundle(lat: number, lng: number, timeoutMs = 20_000): Promise<LiveBundle> {
  const results = await Promise.all(LIVE_SOURCE_IDS.map((id) => getLiveSource(id, lat, lng, timeoutMs)));
  const byId = Object.fromEntries(LIVE_SOURCE_IDS.map((id, i) => [id, results[i]])) as Omit<
    LiveBundle,
    "lat" | "lng" | "fetched_at"
  >;
  return { lat, lng, fetched_at: new Date().toISOString(), ...byId };
}
