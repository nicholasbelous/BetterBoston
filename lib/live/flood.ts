// Flood: FEMA National Flood Hazard Layer (official flood zone, nationwide) and
// Climate Ready Boston sea level rise inundation (Boston only, future scenarios).
import "server-only";
import type { FloodScenario, LiveCitation, LiveFlood, LiveResult } from "@/lib/types";
import { getBostonNeighborhood } from "@/lib/live/area";
import { arcgisPointHit, arcgisPointQuery, cached, coordKey, HOUR } from "@/lib/live/http";

const FEMA_ZONES = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28";
const SLR = "https://services.arcgis.com/sFnw0xNflSi8J0uh/arcgis/rest/services/Climate_Ready_Boston_Sea_Level_Rise_Inundation/FeatureServer";

/** Layer ids in the Climate Ready Boston service, per sea level rise scenario. */
const SLR_LAYERS: Record<FloodScenario["sea_level_rise_in"], { high_tide: number; storm_10pct: number; storm_1pct: number }> = {
  9: { high_tide: 8, storm_10pct: 6, storm_1pct: 7 },
  21: { high_tide: 2, storm_10pct: 0, storm_1pct: 1 },
  36: { high_tide: 5, storm_10pct: 3, storm_1pct: 4 },
};

const FEMA_SOURCE: LiveCitation = {
  name: "FEMA National Flood Hazard Layer",
  url: "https://www.fema.gov/flood-maps/national-flood-hazard-layer",
};
const SLR_SOURCE: LiveCitation = {
  name: "Climate Ready Boston sea level rise flood maps",
  url: "https://www.boston.gov/departments/environment/climate-ready-boston",
};

interface FemaAttrs {
  FLD_ZONE: string | null;
  ZONE_SUBTY: string | null;
  SFHA_TF: string | null;
}

function sentenceCase(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

async function getFema(lat: number, lng: number) {
  return cached(`fema:${coordKey(lat, lng)}`, 24 * HOUR, async () => {
    const features = await arcgisPointQuery<FemaAttrs>(FEMA_ZONES, lat, lng, {
      outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
      timeoutMs: 10_000,
    });
    const a = features[0]?.attributes;
    if (!a) return { zone: null, description: null, highRisk: null };
    const highRisk = a.SFHA_TF === "T";
    const description = a.ZONE_SUBTY
      ? sentenceCase(a.ZONE_SUBTY)
      : highRisk
        ? "High-risk flood zone (1% annual chance flood)"
        : null;
    return { zone: a.FLD_ZONE, description, highRisk };
  });
}

const SCENARIOS = [9, 21, 36] as const;

async function getFutureFlooding(lat: number, lng: number): Promise<FloodScenario[]> {
  return cached(`slr:${coordKey(lat, lng)}`, 24 * HOUR, () =>
    Promise.all(
      SCENARIOS.map(async (inches) => {
        const ids = SLR_LAYERS[inches];
        const [high_tide, storm_10pct, storm_1pct] = await Promise.all([
          arcgisPointHit(`${SLR}/${ids.high_tide}`, lat, lng),
          arcgisPointHit(`${SLR}/${ids.storm_10pct}`, lat, lng),
          arcgisPointHit(`${SLR}/${ids.storm_1pct}`, lat, lng),
        ]);
        return { sea_level_rise_in: inches, high_tide, storm_10pct, storm_1pct };
      }),
    ),
  );
}

export async function getFlood(lat: number, lng: number): Promise<LiveResult<LiveFlood>> {
  const [femaResult, nbhdResult] = await Promise.allSettled([getFema(lat, lng), getBostonNeighborhood(lat, lng)]);
  const inBoston = nbhdResult.status === "fulfilled" && nbhdResult.value !== null;

  let future: FloodScenario[] = [];
  let futureOk = false;
  if (inBoston) {
    try {
      future = await getFutureFlooding(lat, lng);
      futureOk = true;
    } catch {
      futureOk = false;
    }
  }

  if (femaResult.status === "rejected" && !futureOk) {
    return { ok: false, error: "unavailable", message: "Flood map services aren't responding right now." };
  }

  const fema = femaResult.status === "fulfilled" ? femaResult.value : { zone: null, description: null, highRisk: null };
  const firstFlooded = future.find((s) => s.storm_1pct)?.sea_level_rise_in ?? null;

  const sources: LiveCitation[] = [];
  if (femaResult.status === "fulfilled") sources.push(FEMA_SOURCE);
  if (futureOk) sources.push(SLR_SOURCE);

  return {
    ok: true,
    data: {
      fema_zone: fema.zone,
      fema_zone_description: fema.description,
      fema_high_risk: fema.highRisk,
      future,
      first_flooded_at_in: firstFlooded,
    },
    sources,
    fetched_at: new Date().toISOString(),
    note: inBoston
      ? "FEMA zones show today's official flood map. Climate Ready Boston maps show where coastal storms could flood with future sea level rise."
      : "Future sea level rise maps cover Boston only.",
  };
}
