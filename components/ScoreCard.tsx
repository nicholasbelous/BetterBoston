// One score card (heat or tree). Server-safe (no hooks).
// Always render DataSourceNote under the score.
import DataSourceNote from "@/components/DataSourceNote";
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

export default function ScoreCard({ kind, cell, metadata }: ScoreCardProps) {
  // TODO (task 1.5):
  // heat: big number = heat_score/100, line: "The ground here was X°F hotter/cooler
  //   than the Boston average on <scene_date>." Caption: "Ground surface temperature
  //   on one summer day, not air temperature."
  // tree: big number = tree_score/100, line: "About N% of this block looked green
  //   in the spring 2025 aerial photo." Caption mentions leaf-off spring photo.
  // null score -> "Not enough clear data for this block."
  // solar (task 7.1): only render when the solar API is wired up.
  void cell;
  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-semibold">{TITLES[kind]}</h2>
      <p className="text-3xl font-bold">--</p>
      <DataSourceNote kind={kind} metadata={metadata} />
    </section>
  );
}
