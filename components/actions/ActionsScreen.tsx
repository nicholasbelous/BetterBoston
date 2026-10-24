"use client";
// Screen 5: recommended actions.
// Tabs: All / Homeowners / Renters. Topic chips filter the list. For Homeowners and
// Renters we ask POST /api/action-plan for a personalized plan; if it isn't available
// yet, the labeled placeholder list is shown instead.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ActionCard, { type ActionCardModel } from "@/components/actions/ActionCard";
import ActionPlanList from "@/components/ActionPlanList";
import SampleDataBanner from "@/components/SampleDataBanner";
import { btnGhost, btnPrimary, card, iconBtn } from "@/components/ui/classes";
import FilterChips, { type ChipOption } from "@/components/ui/FilterChips";
import Icon from "@/components/ui/Icon";
import { useActionsDone } from "@/hooks/useActionsDone";
import { useReport } from "@/hooks/useReport";
import type { ProgramTopic, Tenure } from "@/lib/types";
import { MOCK_ACTIONS } from "@/mocks/actions.mock";
import { loadActionPlan, type ActionPlanOutcome } from "@/services/climateClient";
import { splitAddress, withLocation, type LocationContext } from "@/services/locationContext";

type Audience = "all" | "owner" | "renter";
type Topic = "all" | ProgramTopic;

const AUDIENCES: ChipOption<Audience>[] = [
  { id: "all", label: "All" },
  { id: "owner", label: "Homeowners" },
  { id: "renter", label: "Renters" },
];

const TOPICS: ChipOption<Topic>[] = [
  { id: "all", label: "Any topic" },
  { id: "heat", label: "Heat", icon: "thermometer" },
  { id: "trees", label: "Trees", icon: "tree" },
  { id: "energy", label: "Energy", icon: "bolt" },
];

export default function ActionsScreen({ initial }: { initial: LocationContext }) {
  const { data } = useReport(initial.lat, initial.lng);
  const { done } = useActionsDone();
  const [audience, setAudience] = useState<Audience>("all");
  const [topic, setTopic] = useState<Topic>("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{ key: string; outcome: ActionPlanOutcome } | null>(null);

  const here = initial.isDefault ? null : initial;
  const { title } = splitAddress(initial.q);
  const cellId = data?.cell?.cell_id ?? null;

  // Ask for a personalized plan when a specific audience is chosen.
  const planKey = audience !== "all" && cellId ? `${cellId}:${audience}` : null;
  useEffect(() => {
    if (!planKey || !cellId || audience === "all") return;
    let cancelled = false;
    const tenure: Tenure = audience;
    loadActionPlan(cellId, tenure).then((outcome) => {
      if (!cancelled) setFetched({ key: planKey, outcome });
    });
    return () => {
      cancelled = true;
    };
  }, [planKey, cellId, audience]);

  const outcome = planKey && fetched?.key === planKey ? fetched.outcome : null;
  const loadingPlan = planKey !== null && outcome === null;
  const apiPlan = outcome?.origin === "api" ? outcome.plan : null;

  const placeholders: ActionCardModel[] = useMemo(
    () =>
      MOCK_ACTIONS.filter(
        (a) => (audience === "all" || a.audience.includes(audience)) && (topic === "all" || a.topics.includes(topic)),
      ).map((a) => ({
        id: a.id,
        title: a.title,
        summary: a.summary,
        detail: a.detail,
        steps: a.steps,
        icon: a.icon,
        href: null,
        verified: false,
        source: "mock" as const,
      })),
    [audience, topic],
  );

  const doneCount = placeholders.filter((a) => done.has(a.id)).length;

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  }

  async function copyPlan() {
    const lines = [
      `ClimateCheck MA action ideas for ${title}`,
      "(placeholder ideas, not verified programs)",
      "",
      ...placeholders.map((a, i) => `${i + 1}. ${a.title} - ${a.summary}${done.has(a.id) ? " [done]" : ""}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      flash("Plan copied");
    } catch {
      flash("Couldn't copy the plan");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-6 pt-4">
      <div className="mb-4 flex items-start gap-3">
        <Link href={withLocation("/improvements", here)} aria-label="Back to improvements" className={iconBtn}>
          <Icon name="arrowLeft" size={20} />
        </Link>
        <div className="min-w-0 pt-0.5">
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            Recommended Actions
          </h1>
          <p className="text-sm text-ink-dim">
            {apiPlan ? `Picked for ${title} from checked Massachusetts programs.` : "Ideas to keep your home cooler."}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <SampleDataBanner
          show={data?.isSample ?? true}
          note={
            apiPlan
              ? "The programs below are real and checked. The block numbers in the summary are sample data."
              : "The actions below are general placeholder ideas, not verified programs."
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <FilterChips<Audience> ariaLabel="Who is this for?" options={AUDIENCES} value={audience} onChange={setAudience} />
        {!apiPlan ? (
          <FilterChips<Topic>
            ariaLabel="Topic"
            options={TOPICS}
            value={topic}
            onChange={setTopic}
            layout="scroll"
          />
        ) : null}
      </div>

      <div className="mt-5" aria-live="polite">
        {loadingPlan ? (
          <ActionPlanList plan={null} loading />
        ) : apiPlan ? (
          <ActionPlanList plan={apiPlan} />
        ) : (
          <>
            {audience !== "all" && outcome?.origin === "mock" ? (
              <p className={`${card} mb-3 flex items-start gap-2.5 p-3.5 text-sm text-ink-dim`}>
                <Icon name="info" size={18} className="mt-px shrink-0 text-amber" />
                A personalized plan isn&apos;t available yet, so here are general ideas.
              </p>
            ) : null}

            {placeholders.length === 0 ? (
              <p className={`${card} p-4 text-sm text-ink-dim`}>
                No ideas match these filters. Try &ldquo;Any topic&rdquo;.
              </p>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-dim">
                    <span className="font-semibold text-ink">{doneCount}</span> of {placeholders.length} done
                  </p>
                  <button type="button" onClick={copyPlan} className={btnGhost}>
                    <Icon name="copy" size={16} />
                    Copy plan
                  </button>
                </div>
                <div
                  className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-label="Actions done"
                  aria-valuemin={0}
                  aria-valuemax={placeholders.length}
                  aria-valuenow={doneCount}
                >
                  <div
                    className="h-full rounded-full bg-mint transition-all"
                    style={{ width: `${(doneCount / placeholders.length) * 100}%` }}
                  />
                </div>
                <ul className="flex flex-col gap-2.5">
                  {placeholders.map((a) => (
                    <ActionCard key={a.id} action={a} />
                  ))}
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-ink-mute">
                  Placeholder ideas: no links, phone numbers or dollar amounts until real Massachusetts
                  programs are checked and added.
                </p>
              </>
            )}
          </>
        )}
      </div>

      {notice ? (
        <div
          className="rise-in fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full border border-line-strong bg-navy-700 px-4 py-2 text-sm shadow-xl md:bottom-8"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <div className="mt-8">
        <Link href={withLocation("/", null)} className={`${btnPrimary} w-full sm:w-auto`}>
          Check another address
          <Icon name="arrowRight" size={18} />
        </Link>
      </div>
    </div>
  );
}
