"use client";
// The action plan inside the report (Recommendations tab): renter / owner choice,
// then POST /api/action-plan. Every action is a checked program from data/programs.
import { useEffect, useState } from "react";
import ActionPlanList from "@/components/ActionPlanList";
import { card } from "@/components/ui/classes";
import FilterChips, { type ChipOption } from "@/components/ui/FilterChips";
import type { Tenure } from "@/lib/types";
import { loadActionPlan, type ActionPlanOutcome } from "@/services/climateClient";

const TENURES: ChipOption<Tenure>[] = [
  { id: "renter", label: "I rent" },
  { id: "owner", label: "I own" },
];

export default function ReportPlan({ cellId }: { cellId: string }) {
  const [tenure, setTenure] = useState<Tenure>("renter");
  const key = `${cellId}:${tenure}`;
  const [fetched, setFetched] = useState<{ key: string; outcome: ActionPlanOutcome } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadActionPlan(cellId, tenure).then((outcome) => {
      if (!cancelled) setFetched({ key, outcome });
    });
    return () => {
      cancelled = true;
    };
  }, [cellId, tenure, key]);

  const outcome = fetched?.key === key ? fetched.outcome : null;

  return (
    <div className="flex flex-col gap-3">
      <FilterChips<Tenure> ariaLabel="Do you rent or own?" options={TENURES} value={tenure} onChange={setTenure} />
      <div aria-live="polite">
        {outcome === null ? (
          <ActionPlanList plan={null} loading />
        ) : outcome.origin === "api" ? (
          <ActionPlanList plan={outcome.plan} />
        ) : (
          <p className={`${card} p-4 text-sm text-ink-dim`}>
            We couldn&apos;t load your action plan right now. Please try again in a moment.
          </p>
        )}
      </div>
    </div>
  );
}
