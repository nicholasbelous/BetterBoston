"use client";
// Renter / owner segmented toggle. Controlled by the parent so the action
// plan can refetch when it changes.
import type { Tenure } from "@/lib/types";

interface TenureToggleProps {
  value?: Tenure;
  onChange?: (tenure: Tenure) => void;
}

export default function TenureToggle({ value = "renter", onChange }: TenureToggleProps) {
  // TODO (task 5.2): style the selected state; use role="radiogroup" for accessibility.
  const options: { id: Tenure; label: string }[] = [
    { id: "renter", label: "I rent" },
    { id: "owner", label: "I own" },
  ];
  return (
    <div role="radiogroup" aria-label="Do you rent or own?" className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`rounded-lg border px-4 py-3 font-medium ${value === o.id ? "bg-black text-white" : ""}`}
          onClick={() => onChange?.(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
