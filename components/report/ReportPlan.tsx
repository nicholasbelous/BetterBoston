"use client";
// The action plan inside the report (Recommendations tab): one plan for everyone
// (no rent/own question) from POST /api/action-plan. Every action is a checked
// program from data/programs.
import { useEffect, useState } from "react";
import ActionPlanList from "@/components/ActionPlanList";
import { card } from "@/components/ui/classes";
import { loadActionPlan, type ActionPlanOutcome } from "@/services/climateClient";

export default function ReportPlan({ cellId }: { cellId: string }) {
  const [fetched, setFetched] = useState<{ cellId: string; outcome: ActionPlanOutcome } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadActionPlan(cellId, "everyone").then((outcome) => {
      if (!cancelled) setFetched({ cellId, outcome });
    });
    return () => {
      cancelled = true;
    };
  }, [cellId]);

  const outcome = fetched?.cellId === cellId ? fetched.outcome : null;

  return (
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
  );
}
