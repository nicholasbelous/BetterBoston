// Screen 2: interactive climate map. /map?lat=..&lng=..&q=<label>
import type { Metadata } from "next";
import MapScreen from "@/components/map/MapScreen";
import { parseLocation, recordGetter } from "@/services/locationContext";

export const metadata: Metadata = { title: "Climate map | ClimateCheck MA" };

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const ctx = parseLocation(recordGetter(await searchParams));
  return <MapScreen initial={ctx} />;
}
