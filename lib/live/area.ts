// Area context: Boston neighborhood (BPDA boundaries) and census-tract social
// vulnerability (Climate Ready Boston, 2008-2012 ACS estimates).
import "server-only";
import type { LiveArea, LiveCitation, LiveResult } from "@/lib/types";
import { arcgisPointQuery, cached, coordKey, HOUR, round } from "@/lib/live/http";

const NEIGHBORHOODS_LAYER =
  "https://gis.bostonplans.org/hosting/rest/services/Hosted/Boston_Neighborhood_Boundaries/FeatureServer/5";
const VULNERABILITY_LAYER =
  "https://services.arcgis.com/sFnw0xNflSi8J0uh/arcgis/rest/services/Climate_Ready_Boston_Social_Vulnerability/FeatureServer/0";

export const AREA_SOURCES: LiveCitation[] = [
  { name: "Boston Planning & Development Agency neighborhood boundaries", url: "https://data.boston.gov/" },
  {
    name: "Climate Ready Boston Social Vulnerability (2008-2012 ACS)",
    url: "https://data.boston.gov/dataset/climate-ready-boston-social-vulnerability",
  },
];

/** Boston neighborhood name for a point, or null if the point is outside Boston. Cached 24 h. */
export function getBostonNeighborhood(lat: number, lng: number): Promise<string | null> {
  return cached(`nbhd:${coordKey(lat, lng)}`, 24 * HOUR, async () => {
    const features = await arcgisPointQuery<{ name?: string }>(NEIGHBORHOODS_LAYER, lat, lng, {
      outFields: "name",
    });
    return features[0]?.attributes.name ?? null;
  });
}

interface VulnerabilityAttrs {
  GEOID10: string;
  Name: string | null;
  POP100_RE: number;
  OlderAdult: number | null;
  TotChild: number | null;
  Low_to_No: number | null;
  TotDis: number | null;
}

function pct(part: number | null, total: number): number | null {
  if (part === null || part === undefined || !total) return null;
  return round((part / total) * 100, 1);
}

async function getTract(lat: number, lng: number): Promise<LiveArea["tract"]> {
  return cached(`tract:${coordKey(lat, lng)}`, 24 * HOUR, async () => {
    const features = await arcgisPointQuery<VulnerabilityAttrs>(VULNERABILITY_LAYER, lat, lng, {
      // LEP and MedIllnes are skipped: their definitions in the dataset are unclear.
      outFields: "GEOID10,Name,POP100_RE,OlderAdult,TotChild,Low_to_No,TotDis",
    });
    const a = features[0]?.attributes;
    if (!a) return null;
    const pop = a.POP100_RE;
    return {
      geoid: a.GEOID10,
      name: a.Name,
      population: pop,
      pct_older_adults: pct(a.OlderAdult, pop),
      pct_children_under_5: pct(a.TotChild, pop),
      pct_low_to_no_income: pct(a.Low_to_No, pop),
      pct_with_disability: pct(a.TotDis, pop),
    };
  });
}

export async function getArea(lat: number, lng: number): Promise<LiveResult<LiveArea>> {
  const neighborhood = await getBostonNeighborhood(lat, lng);
  if (!neighborhood) {
    return {
      ok: true,
      data: { neighborhood: null, in_boston: false, tract: null },
      sources: AREA_SOURCES.slice(0, 1),
      fetched_at: new Date().toISOString(),
      note: "This point is outside the City of Boston, so Boston-only data (trees, places, future flooding, census tract) isn't available.",
    };
  }
  const tract = await getTract(lat, lng).catch(() => null);
  return {
    ok: true,
    data: { neighborhood, in_boston: true, tract },
    sources: tract ? AREA_SOURCES : AREA_SOURCES.slice(0, 1),
    fetched_at: new Date().toISOString(),
    note: tract
      ? "Census tract shares are 2008-2012 survey estimates used in Climate Ready Boston (2016). They describe the tract, not this household."
      : undefined,
  };
}
