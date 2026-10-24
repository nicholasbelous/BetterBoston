"use client";
// Bottom sheet (phone) / side card (desktop) under the map: the selected place,
// its two scores, a link to the full report, the layer filter and the legend.
import Link from "next/link";
import HouseScene from "@/components/art/HouseScene";
import type { MapMetric } from "@/components/MapView";
import MapLegend from "@/components/map/MapLegend";
import { coverTone, levelFromScore, riskTone, TONE_TILE } from "@/components/report/levels";
import FilterChips, { type ChipOption } from "@/components/ui/FilterChips";
import Icon from "@/components/ui/Icon";
import { btnPrimary } from "@/components/ui/classes";
import type { ImprovementId } from "@/mocks/improvements.mock";
import type { ReportData } from "@/services/climateClient";

type LayerId = MapMetric | "flood";

const LAYERS: ChipOption<LayerId>[] = [
  { id: "heat", label: "Heat", icon: "thermometer" },
  { id: "tree", label: "Trees", icon: "tree" },
  { id: "flood", label: "Flood", icon: "water", disabled: true, hint: "no flood data yet" },
];

const NO_PLANTS: ReadonlySet<ImprovementId> = new Set();

interface MapSheetProps {
  title: string;
  sub: string;
  report: ReportData | null;
  metric: MapMetric;
  onMetric: (m: MapMetric) => void;
  reportHref: string;
}

function Badge({ label, value, tone }: { label: string; value: string; tone: "bad" | "warn" | "good" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_TILE[tone]}`}>
      {label}: {value}
    </span>
  );
}

export default function MapSheet({ title, sub, report, metric, onMetric, reportHref }: MapSheetProps) {
  const covered = report?.status === "ok" && report.cell;
  const heat = levelFromScore(report?.cell?.heat_score);
  const tree = levelFromScore(report?.cell?.tree_score);

  return (
    <section
      aria-label="Selected place"
      className="rise-in absolute inset-x-3 bottom-3 z-10 flex max-h-[70%] flex-col gap-3.5 overflow-y-auto rounded-3xl border border-line-strong bg-navy-900/92 p-4 shadow-[0_-10px_50px_-10px_rgb(0_0_0/0.8)] backdrop-blur-xl md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-[23.5rem]"
    >
      <div className="mx-auto h-1 w-10 rounded-full bg-line-strong md:hidden" aria-hidden="true" />

      <div className="flex items-center gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-line">
          <HouseScene improvements={NO_PLANTS} label="" className="size-full" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-semibold leading-tight">{title}</h2>
          {sub ? <p className="truncate text-sm text-ink-dim">{sub}</p> : null}
          {covered ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {heat ? <Badge label="Heat" value={heat} tone={riskTone(heat)} /> : null}
              {tree ? <Badge label="Trees" value={tree} tone={coverTone(tree)} /> : null}
            </div>
          ) : null}
        </div>
      </div>

      {report === null ? (
        <p className="text-sm text-ink-dim" role="status">
          Checking this block...
        </p>
      ) : covered ? (
        <Link href={reportHref} className={`${btnPrimary} w-full`}>
          View Climate Report
          <Icon name="arrowRight" size={18} />
        </Link>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-amber/10 p-3 text-sm text-amber" role="status">
          <Icon name="info" size={18} className="mt-px shrink-0" />
          We haven&apos;t mapped this spot yet. Try a spot inside the colored area.
        </p>
      )}

      <FilterChips<LayerId>
        ariaLabel="Map layer"
        options={LAYERS}
        value={metric}
        onChange={(id) => {
          if (id !== "flood") onMetric(id);
        }}
      />
      <MapLegend metric={metric} />
    </section>
  );
}
