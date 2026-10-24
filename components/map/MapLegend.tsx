import type { MapMetric } from "@/components/MapView";

const COPY: Record<MapMetric, { bar: string; low: string; high: string; note: string }> = {
  heat: {
    bar: "heat-gradient",
    low: "Lower risk",
    high: "Higher risk",
    note: "Ground surface heat compared with other blocks",
  },
  tree: {
    bar: "tree-gradient",
    low: "Less green",
    high: "More green",
    note: "Green cover compared with other blocks",
  },
};

export default function MapLegend({ metric }: { metric: MapMetric }) {
  const c = COPY[metric];
  return (
    <div>
      <div className={`h-2.5 w-full rounded-full ${c.bar}`} role="img" aria-label={`${c.low} to ${c.high}`} />
      <div className="mt-1.5 flex justify-between text-xs text-ink-dim">
        <span>{c.low}</span>
        <span>{c.high}</span>
      </div>
      <p className="mt-1 text-[11px] text-ink-mute">{c.note}</p>
    </div>
  );
}
