// Screen 4: before and after home improvements. /improvements?lat=..&lng=..&q=<label>
import type { Metadata } from "next";
import ImprovementsScreen from "@/components/compare/ImprovementsScreen";
import { parseLocation, recordGetter } from "@/services/locationContext";

export const metadata: Metadata = { title: "Home improvements | ClimateCheck MA" };

export default async function ImprovementsPage({ searchParams }: PageProps<"/improvements">) {
  const ctx = parseLocation(recordGetter(await searchParams));
  return <ImprovementsScreen initial={ctx} />;
}
