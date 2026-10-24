// Renders the AI action plan: summary + 3-5 actions, each with a link to
// the program page. Every action comes from a checked program (see /api/action-plan).
import ActionCard, { type ActionCardModel } from "@/components/actions/ActionCard";
import Icon from "@/components/ui/Icon";
import { card } from "@/components/ui/classes";
import type { ActionPlan } from "@/lib/types";

interface ActionPlanListProps {
  plan: ActionPlan | null;
  loading?: boolean;
  error?: string | null;
}

export function planToCards(plan: ActionPlan): ActionCardModel[] {
  return plan.actions.map((a) => ({
    id: a.program_id,
    title: a.title,
    summary: a.why,
    icon: "bulb",
    href: a.link,
    // The server only returns programs a person has verified.
    verified: true,
    source: "api",
  }));
}

export default function ActionPlanList({ plan, loading, error }: ActionPlanListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5" role="status" aria-label="Building your action plan">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-navy-800" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <p role="alert" className={`${card} p-4 text-sm text-[#ffb4aa]`}>
        {error}
      </p>
    );
  }
  if (!plan) return <p className="text-sm text-ink-dim">Your action plan will appear here.</p>;

  return (
    <section className="flex flex-col gap-3">
      <div className={`${card} p-4`}>
        <p className="flex items-center gap-1.5 text-xs font-medium text-mint">
          <Icon name="sparkle" size={14} />
          Written by AI from our checked program list
        </p>
        <p className="mt-2 text-sm leading-relaxed">{plan.summary}</p>
        {plan.based_on_sample_data ? (
          <p className="mt-2 text-xs text-ink-mute">Based on sample data.</p>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2.5">
        {planToCards(plan).map((a) => (
          <ActionCard key={a.id} action={a} />
        ))}
      </ul>
    </section>
  );
}
