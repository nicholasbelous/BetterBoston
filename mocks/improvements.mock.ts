// ============================================================================
// MOCK DATA - NOT REAL. Illustrative home improvements and their "benefits".
//
// These numbers come from the design mock-up, not from a model or a study.
// They scale with how many improvements are switched on so the demo feels
// alive. The UI labels them "Illustrative" and never presents them as a
// prediction for a real home.
// ============================================================================
import type { IconName } from "@/components/ui/Icon";

export type ImprovementId = "shade-trees" | "exterior-shade" | "cool-roof" | "landscaping";

export interface Improvement {
  id: ImprovementId;
  label: string;
  icon: IconName;
  /** Share of the full "indoor temperature / cooling cost" effect (sums to 1). */
  weight: number;
  /** Share of the full "shade coverage" effect (sums to 1). */
  shadeWeight: number;
}

export const IMPROVEMENTS: Improvement[] = [
  { id: "shade-trees", label: "Shade trees", icon: "tree", weight: 0.3, shadeWeight: 0.55 },
  { id: "exterior-shade", label: "Exterior shade", icon: "umbrella", weight: 0.25, shadeWeight: 0.35 },
  { id: "cool-roof", label: "Cool roof", icon: "roof", weight: 0.3, shadeWeight: 0 },
  { id: "landscaping", label: "Landscaping", icon: "leaf", weight: 0.15, shadeWeight: 0.1 },
];

export const ALL_IMPROVEMENT_IDS: ImprovementId[] = IMPROVEMENTS.map((i) => i.id);

// Full-package ranges from the design mock-up.
const FULL = { tempMin: 6, tempMax: 10, costMin: 20, costMax: 35, shade: 60 };

export interface Benefit {
  id: "indoor" | "cost" | "shade" | "risk";
  label: string;
  value: string;
  icon: IconName;
  tone: "good" | "neutral";
}

export function estimateBenefits(selected: ReadonlySet<ImprovementId>): Benefit[] {
  const share = IMPROVEMENTS.reduce((sum, i) => sum + (selected.has(i.id) ? i.weight : 0), 0);
  const shade = IMPROVEMENTS.reduce((sum, i) => sum + (selected.has(i.id) ? i.shadeWeight : 0), 0);
  const none = selected.size === 0;

  const risk = none ? "No change" : share >= 0.6 ? "Lower" : "Slightly lower";
  return [
    {
      id: "indoor",
      label: "Indoor Temperature",
      icon: "thermometer",
      value: none
        ? "No change"
        : `-${Math.max(1, Math.round(FULL.tempMin * share))} to -${Math.max(1, Math.round(FULL.tempMax * share))}\u00B0F`,
      tone: none ? "neutral" : "good",
    },
    {
      id: "cost",
      label: "Cooling Energy Costs",
      icon: "bolt",
      value: none
        ? "No change"
        : `-${Math.max(1, Math.round(FULL.costMin * share))} to -${Math.max(1, Math.round(FULL.costMax * share))}%`,
      tone: none ? "neutral" : "good",
    },
    {
      id: "shade",
      label: "Shade Coverage",
      icon: "umbrella",
      value: shade > 0 ? `+${Math.round(FULL.shade * shade)}%` : "No change",
      tone: shade > 0 ? "good" : "neutral",
    },
    {
      id: "risk",
      label: "Overall Climate Risk",
      icon: "shield",
      value: risk,
      tone: none ? "neutral" : "good",
    },
  ];
}
