// Renders the AI action plan: summary + 3-5 actions, each with a link to
// the program page and the program's last_verified date.
import type { ActionPlan } from "@/lib/types";

interface ActionPlanListProps {
  plan: ActionPlan | null;
  loading?: boolean;
  error?: string | null;
}

export default function ActionPlanList({ plan, loading, error }: ActionPlanListProps) {
  // TODO (task 4.4): loading skeleton, error fallback ("Here are programs that may
  // help" + plain program list), "Written by AI from our checked program list" label,
  // and a SAMPLE DATA note if plan.based_on_sample_data.
  if (loading) return <p>Building your action plan...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!plan) return <p className="text-gray-600">Your action plan will appear here.</p>;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">What you can do</h2>
      <p>{plan.summary}</p>
      <ol className="list-decimal pl-5 flex flex-col gap-2">
        {plan.actions.map((a) => (
          <li key={a.program_id}>
            <a href={a.link} target="_blank" rel="noopener noreferrer" className="font-medium underline">
              {a.title}
            </a>
            <p className="text-sm">{a.why}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
