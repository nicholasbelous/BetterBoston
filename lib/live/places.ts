// Places to cool off: City of Boston community centers (BCYF), community center
// pools, and Boston Public Library branches. Nearest 3 of each.
// BCYF centers open as cooling centers during declared heat emergencies; this
// data does not say which ones are open today.
import "server-only";
import type { LivePlaces, LiveResult, NearbyPlace } from "@/lib/types";
import { getBostonNeighborhood } from "@/lib/live/area";
import { arcgisPointQuery, cached, coordKey, distanceMiles, HOUR, round } from "@/lib/live/http";

const CENTERS = "https://services.arcgis.com/sFnw0xNflSi8J0uh/arcgis/rest/services/Community_Centers/FeatureServer/0";
const POOLS = "https://services.arcgis.com/sFnw0xNflSi8J0uh/arcgis/rest/services/Community_center_pools/FeatureServer/0";
const LIBRARIES = "https://gisportal.boston.gov/arcgis/rest/services/CityServices/OpenData/MapServer/6";

const SEARCH_RADIUS_M = 5000;
const PER_KIND = 3;

interface CenterAttrs {
  SITE: string | null;
  STREET: string | null;
  NEIGH: string | null;
  PHONE: string | null;
}
interface LibraryAttrs {
  BRANCH: string | null;
  ST_ADDRESS: string | null;
  DISTRICT: string | null;
}

function clean(s: string | null | undefined): string | null {
  const t = (s ?? "").replace(/\*+$/, "").trim();
  return t || null;
}

function nearest(places: NearbyPlace[]): NearbyPlace[] {
  return places.sort((a, b) => a.distance_mi - b.distance_mi).slice(0, PER_KIND);
}

async function query<A>(layer: string, lat: number, lng: number, outFields: string) {
  return cached(`places:${layer}:${coordKey(lat, lng)}`, 24 * HOUR, () =>
    arcgisPointQuery<A>(layer, lat, lng, { outFields, distanceM: SEARCH_RADIUS_M, returnGeometry: true }),
  );
}

export async function getPlaces(lat: number, lng: number): Promise<LiveResult<LivePlaces>> {
  const neighborhood = await getBostonNeighborhood(lat, lng);
  if (!neighborhood) {
    return { ok: false, error: "outside_coverage", message: "City places data covers Boston only." };
  }

  const [centers, pools, libraries] = await Promise.allSettled([
    query<CenterAttrs>(CENTERS, lat, lng, "SITE,STREET,NEIGH,PHONE"),
    query<CenterAttrs>(POOLS, lat, lng, "SITE,STREET,NEIGH,PHONE"),
    query<LibraryAttrs>(LIBRARIES, lat, lng, "BRANCH,ST_ADDRESS,DISTRICT"),
  ]);
  if (centers.status === "rejected" && pools.status === "rejected" && libraries.status === "rejected") {
    return { ok: false, error: "unavailable", message: "City places data isn't responding right now." };
  }

  const toPlace = (
    kind: NearbyPlace["kind"],
    f: { geometry?: { x: number; y: number } },
    name: string | null,
    address: string | null,
    nbhd: string | null,
    phone: string | null,
  ): NearbyPlace | null => {
    if (!f.geometry || !name) return null;
    return {
      kind,
      name,
      address,
      neighborhood: nbhd,
      phone,
      distance_mi: round(distanceMiles(lat, lng, f.geometry.y, f.geometry.x), 1),
      lat: f.geometry.y,
      lng: f.geometry.x,
    };
  };

  const ok = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === "fulfilled" ? r.value : []);

  return {
    ok: true,
    data: {
      community_centers: nearest(
        ok(centers)
          .map((f) => toPlace("community_center", f, clean(f.attributes.SITE), clean(f.attributes.STREET), clean(f.attributes.NEIGH), clean(f.attributes.PHONE)))
          // The centers dataset also lists pool sites; those are already in `pools`.
          .filter((p): p is NearbyPlace => p !== null && !/\bpool\b/i.test(p.name)),
      ),
      pools: nearest(
        ok(pools)
          .map((f) => toPlace("pool", f, clean(f.attributes.SITE), clean(f.attributes.STREET), clean(f.attributes.NEIGH), clean(f.attributes.PHONE)))
          .filter((p): p is NearbyPlace => p !== null),
      ),
      libraries: nearest(
        ok(libraries)
          .map((f) => toPlace("library", f, clean(f.attributes.BRANCH), clean(f.attributes.ST_ADDRESS), clean(f.attributes.DISTRICT), null))
          .filter((p): p is NearbyPlace => p !== null),
      ),
    },
    sources: [
      { name: "City of Boston Community Centers", url: "https://data.boston.gov/dataset/community-centers" },
      { name: "City of Boston Community Center Pools", url: "https://data.boston.gov/dataset/community-center-pools" },
      { name: "Boston Public Library branches", url: "https://data.boston.gov/dataset/public-libraries" },
    ],
    fetched_at: new Date().toISOString(),
    note: "BCYF community centers open as cooling centers during declared heat emergencies. Check boston.gov/heat for what's open today. Distances are straight-line.",
  };
}
