// Small footnote under each score: source, date, and "relative, not official".
import type { ScoreMetadata } from "@/lib/types";

interface DataSourceNoteProps {
  kind: "heat" | "tree" | "solar";
  metadata: ScoreMetadata | null;
}

export default function DataSourceNote({ kind, metadata }: DataSourceNoteProps) {
  let text = "Source not available. Not an official assessment.";

  if (metadata && kind === "heat") {
    text = metadata.is_sample
      ? `SAMPLE DATA - Made-up numbers for testing. The real version uses USGS Landsat. Compared with ${metadata.heat.reference_area}. Not an official assessment.`
      : `Source: ${metadata.heat.source}, scene from ${metadata.heat.scene_date}. Compared with ${metadata.heat.reference_area}. Not an official assessment.`;
  } else if (metadata && kind === "tree") {
    text = metadata.is_sample
      ? `SAMPLE DATA - Made-up numbers for testing. The real version uses MassGIS 2025 aerial imagery. Compared with ${metadata.tree.reference_area}. Not an official assessment.`
      : `Source: ${metadata.tree.source} (${metadata.tree.imagery_dates}${metadata.tree.leaf_off ? ", leaf-off" : ""}). Compared with ${metadata.tree.reference_area}. Not an official assessment.`;
  } else if (kind === "solar") {
    text = "Solar potential is not available yet.";
  }

  return <p className="mt-3 text-xs leading-relaxed text-ink-mute">{text}</p>;
}
