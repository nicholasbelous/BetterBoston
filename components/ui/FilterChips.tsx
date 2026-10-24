"use client";
// Segmented chip group (radio semantics). Used for map layers, tenure and topic filters.
import Icon, { type IconName } from "@/components/ui/Icon";

export interface ChipOption<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  /** Short reason shown to assistive tech when disabled, e.g. "no data yet". */
  hint?: string;
}

interface FilterChipsProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  /** "fill" stretches chips to share the row; "scroll" lets them overflow horizontally. */
  layout?: "fill" | "scroll";
  className?: string;
}

export default function FilterChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  layout = "fill",
  className = "",
}: FilterChipsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex gap-2 ${layout === "scroll" ? "overflow-x-auto pb-1 [scrollbar-width:none]" : ""} ${className}`}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={o.disabled || undefined}
            disabled={o.disabled}
            title={o.disabled ? o.hint : undefined}
            onClick={() => onChange(o.id)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm font-medium transition ${
              layout === "fill" ? "flex-1" : "shrink-0"
            } ${
              active
                ? "border-mint/50 bg-mint-tint text-mint"
                : "border-line bg-navy-800/80 text-ink-dim hover:bg-navy-700 hover:text-ink"
            } ${o.disabled ? "cursor-not-allowed opacity-45 hover:bg-navy-800/80 hover:text-ink-dim" : ""}`}
          >
            {o.icon ? <Icon name={o.icon} size={16} /> : null}
            {o.label}
            {o.disabled && o.hint ? <span className="sr-only"> ({o.hint})</span> : null}
          </button>
        );
      })}
    </div>
  );
}
