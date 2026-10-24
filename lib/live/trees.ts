// Street trees: City of Boston Parks Department tree inventory (BPRD Trees).
// Counts City-managed trees only. Yard trees aren't in the inventory, so this
// complements the green cover score and never replaces it.
import "server-only";
import type { LiveResult, LiveTrees } from "@/lib/types";
import { getBostonNeighborhood } from "@/lib/live/area";
import { arcgisPointQuery, cached, coordKey, HOUR } from "@/lib/live/http";

const TREES_LAYER = "https://services.arcgis.com/sFnw0xNflSi8J0uh/arcgis/rest/services/BPRD_Trees/FeatureServer/0";
export const TREE_RADIUS_M = 100;

interface TreeAttrs {
  spp_com: string | null;
  dbh: string | null;
}

const EMPTY_SITE = /empty|planting site|vacant/i;
const NOT_A_TREE = /stump/i;

export async function getTrees(lat: number, lng: number): Promise<LiveResult<LiveTrees>> {
  const neighborhood = await getBostonNeighborhood(lat, lng);
  if (!neighborhood) {
    return { ok: false, error: "outside_coverage", message: "The street tree inventory covers Boston only." };
  }

  const features = await cached(`trees:${coordKey(lat, lng)}`, 24 * HOUR, () =>
    arcgisPointQuery<TreeAttrs>(TREES_LAYER, lat, lng, { outFields: "spp_com,dbh", distanceM: TREE_RADIUS_M }),
  );

  let trees = 0;
  let empty = 0;
  const species = new Map<string, number>();
  const size = { small: 0, medium: 0, large: 0, unknown: 0 };

  for (const { attributes: a } of features) {
    const name = (a.spp_com ?? "").trim();
    if (EMPTY_SITE.test(name)) {
      empty += 1;
      continue;
    }
    if (NOT_A_TREE.test(name)) continue;
    trees += 1;
    if (name) species.set(name, (species.get(name) ?? 0) + 1);
    const dbh = Number(a.dbh);
    if (!Number.isFinite(dbh) || dbh <= 0) size.unknown += 1;
    else if (dbh < 6) size.small += 1;
    else if (dbh <= 18) size.medium += 1;
    else size.large += 1;
  }

  return {
    ok: true,
    data: {
      radius_m: TREE_RADIUS_M,
      tree_count: trees,
      empty_planting_sites: empty,
      top_species: [...species.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count })),
      size_mix: size,
    },
    sources: [{ name: "City of Boston street tree inventory (BPRD Trees)", url: "https://data.boston.gov/dataset/bprd-trees" }],
    fetched_at: new Date().toISOString(),
    note: "Counts City street and park trees only. Trees in private yards aren't included. Trunk size: small under 6 in, medium 6-18 in, large over 18 in.",
  };
}
