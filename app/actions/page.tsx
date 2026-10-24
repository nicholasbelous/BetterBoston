// "Recommended actions" is turned off for the demo. Old links go to the report for the same
// place, where the Recommendations tab shows the real action plan.
// The screen itself is still in components/actions/ActionsScreen.tsx.
import { redirect } from "next/navigation";
import { parseLocation, recordGetter, withLocation } from "@/services/locationContext";

export default async function ActionsPage({ searchParams }: PageProps<"/actions">) {
  const ctx = parseLocation(recordGetter(await searchParams));
  redirect(withLocation("/report", ctx.isDefault ? null : ctx));
}
