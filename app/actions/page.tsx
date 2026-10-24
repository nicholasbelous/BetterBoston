// Screen 5: recommended actions. /actions?lat=..&lng=..&q=<label>
import type { Metadata } from "next";
import ActionsScreen from "@/components/actions/ActionsScreen";
import { parseLocation, recordGetter } from "@/services/locationContext";

export const metadata: Metadata = { title: "Recommended actions | ClimateCheck MA" };

export default async function ActionsPage({ searchParams }: PageProps<"/actions">) {
  const ctx = parseLocation(recordGetter(await searchParams));
  return <ActionsScreen initial={ctx} />;
}
