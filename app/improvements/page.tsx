// "Before & after" is turned off for the demo. Old links go to the report for the same place.
// The screen itself is still in components/compare/ImprovementsScreen.tsx.
import { redirect } from "next/navigation";
import { parseLocation, recordGetter, withLocation } from "@/services/locationContext";

export default async function ImprovementsPage({ searchParams }: PageProps<"/improvements">) {
  const ctx = parseLocation(recordGetter(await searchParams));
  redirect(withLocation("/report", ctx.isDefault ? null : ctx));
}
