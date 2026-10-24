"use client";
// One recommended action. Tap to expand; check it off when done.
// Links only work for verified programs. Placeholders show why there is no link.
import { useId, useState } from "react";
import Icon, { type IconName } from "@/components/ui/Icon";
import { card } from "@/components/ui/classes";
import { useActionsDone } from "@/hooks/useActionsDone";

export interface ActionCardModel {
  id: string;
  title: string;
  summary: string;
  detail?: string;
  steps?: string[];
  icon: IconName;
  /** Program page. Only used when verified is true. */
  href?: string | null;
  verified: boolean;
  source: "api" | "mock";
}

export default function ActionCard({ action }: { action: ActionCardModel }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { done, toggle } = useActionsDone();
  const isDone = done.has(action.id);
  const hasMore = Boolean(action.detail || action.steps?.length || action.href || action.source === "mock");

  return (
    <li className={`${card} overflow-hidden transition ${isDone ? "border-mint/40" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[4.5rem] w-full items-center gap-3.5 p-3.5 text-left"
      >
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${
            isDone ? "bg-mint text-navy-950" : "bg-mint-tint text-mint"
          }`}
        >
          <Icon name={isDone ? "check" : action.icon} size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-semibold ${isDone ? "text-ink-dim line-through decoration-ink-mute" : ""}`}>
            {action.title}
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-ink-dim">{action.summary}</span>
        </span>
        <Icon
          name="chevronRight"
          size={18}
          className={`shrink-0 text-ink-mute transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      <div id={panelId} hidden={!open} className="border-t border-line px-4 pb-4 pt-3">
        {hasMore ? (
          <div className="flex flex-col gap-3">
            {action.detail ? <p className="text-sm leading-relaxed text-ink-dim">{action.detail}</p> : null}
            {action.steps?.length ? (
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-mint">
                {action.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            ) : null}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => toggle(action.id)}
                aria-pressed={isDone}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition ${
                  isDone
                    ? "border-mint/50 bg-mint-tint text-mint"
                    : "border-line-strong bg-white/[0.03] text-ink hover:bg-white/[0.07]"
                }`}
              >
                <Icon name="check" size={16} />
                {isDone ? "Done" : "Mark as done"}
              </button>

              {action.verified && action.href ? (
                <a
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-mint px-4 text-sm font-semibold text-navy-950 hover:bg-mint-600"
                >
                  Learn more
                  <Icon name="arrowRight" size={16} />
                  <span className="sr-only">(opens the program page in a new tab)</span>
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-line-strong px-3.5 text-xs text-ink-mute"
                >
                  Program link added once verified
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}
