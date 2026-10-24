// Small footnote under each score: source, date, and "relative, not official".
import type { ScoreMetadata } from "@/lib/types";

interface DataSourceNoteProps {
  kind: "heat" | "tree" | "solar";
  metadata: ScoreMetadata | null;
}

export default function DataSourceNote({ kind, metadata }: DataSourceNoteProps) {
  // TODO (task 1.5): text from metadata, e.g.
  // heat: "Source: USGS Landsat Collection 2, scene from <heat.scene_date>.
  //        Compared with <heat.reference_area>. Not an official assessment."
  // tree: "Source: MassGIS 2025 aerial imagery (<tree.imagery_dates>, leaf-off).
  //        Compared with other blocks we mapped. Not an official assessment."
  // If metadata.is_sample: prefix with "SAMPLE DATA - ".
  void kind;
  void metadata;
  return <p className="mt-2 text-xs text-gray-600">Source: TODO. Not an official assessment.</p>;
}
