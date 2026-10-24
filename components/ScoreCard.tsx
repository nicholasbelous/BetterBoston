// One score card (heat or tree). Server-safe (no hooks).
// Always renders DataSourceNote under the score.
import DataSourceNote from "@/components/DataSourceNote";
import { coverTone, levelFromScore, riskTone, TONE_TEXT } from "@/components/report/levels";
import { card } from "@/components/ui/classes";
import ScoreRing from "@/components/ui/ScoreRing";
import type { ScoreCell, ScoreMetadata } from "@/lib/types";

interface ScoreCardProps {
  kind: "heat" | "tree" | "solar";
  cell: ScoreCell | null;
  metadata: ScoreMetadata | null;
}

const TITLES = {
  heat: "Heat",
  tree: "Trees & green space",
  solar: "Solar potential",
} as const;

function meaning(kind: ScoreCardProps["kind"], cell: ScoreCell | null, metadata: ScoreMetadata | null) {
  if (kind === "solar") return { line: "Solar potential is not available yet.", caption: "" };

  if (kind === "heat") {
    const caption = "Ground surface temperature on one summer day, not air temperature.";
    if (!cell || cell.heat_score === null) return { line: "Heat data coming soon.", caption };
    const diff = cell.temp_diff_f;
    if (diff === null) return { line: "Heat data coming soon.", caption };
    const when = metadata && !metadata.is_sample ? ` on ${metadata.heat.scene_date}` : "";
    const ref = metadata?.heat.reference_area ?? "the reference area";
    return {
      line: `The ground here was ${Math.abs(diff).toFixed(1)}\u00B0F ${diff >= 0 ? "hotter" : "cooler"} than ${ref}${when}.`,
      caption,
    };
  }

  const caption = metadata?.tree.leaf_off
    ? "From a spring photo taken before most trees had leaves, so it can undercount trees."
    : "Measured from a summer satellite image, with trees in leaf. Counts grass and trees together.";
  if (!cell || cell.tree_score === null || cell.pct_vegetated === null) {
    return { line: "Not enough clear data for this block.", caption };
  }
  return {
    line: `About ${Math.round(cell.pct_vegetated)}% of this block looked green from the satellite.`,
    caption,
  };
}

export default function ScoreCard({ kind, cell, metadata }: ScoreCardProps) {
  const score = kind === "heat" ? cell?.heat_score ?? null : kind === "tree" ? cell?.tree_score ?? null : null;
  const level = levelFromScore(score);
  const tone = kind === "tree" ? coverTone(level) : riskTone(level);
  const { line, caption } = meaning(kind, cell, metadata);

  return (
    <section className={`${card} p-4`} aria-label={TITLES[kind]}>
      <div className="flex items-center gap-4">
        <ScoreRing value={score} tone={tone} label={`${TITLES[kind]} score`} />
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink-dim">{TITLES[kind]}</h3>
          <p className={`font-display text-2xl font-bold ${level ? TONE_TEXT[tone] : "text-ink-mute"}`}>
            {level ?? "No data"}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink">{line}</p>
      {caption ? <p className="mt-1 text-xs leading-relaxed text-ink-dim">{caption}</p> : null}
      <DataSourceNote kind={kind} metadata={metadata} />
    </section>
  );
}
