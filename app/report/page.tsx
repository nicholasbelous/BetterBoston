// Report page (screen 3, home analysis): /report?lat=..&lng=..&q=<label>
// Shows the house picture, risk summary, and score cards for one place.
// Loading, out-of-coverage and sample-data states are handled in ReportScreen.
import type { Metadata } from "next";
import ReportScreen from "@/components/report/ReportScreen";
import { parseLocation, recordGetter } from "@/services/locationContext";

export const metadata: Metadata = { title: "Home analysis | ClimateCheck MA" };

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const ctx = parseLocation(recordGetter(await searchParams));
  return <ReportScreen initial={ctx} />;
}
