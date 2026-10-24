// About / data sources page. Plain language, 8th-grade reading level.
import Link from "next/link";
import { card } from "@/components/ui/classes";

export default function AboutPage() {
  // TODO (task 6.2): read data/scores/demo_grid.meta.json and show the real
  // scene date, thresholds, and covered neighborhoods instead of hard-coded text.
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">About the data</h1>

      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold">Heat</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          We use the NASA/USGS Landsat satellite. It measures how hot the ground and rooftops were
          on one clear summer day. This is the surface temperature, not the air temperature you
          feel. We compare your block with the Boston average.
        </p>
        {/* TODO: link https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products */}
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold">Trees and green space</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          We use the MassGIS 2025 aerial photos, which include an infrared band. Plants reflect a
          lot of infrared light, so we can tell green areas from pavement and roofs. These photos
          were taken in spring 2025, before most trees had leaves.
        </p>
        {/* TODO: link https://www.mass.gov/info-details/massgis-data-2025-aerial-imagery */}
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold">What the scores are not</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-dim marker:text-mint">
          <li>Scores compare blocks with each other. They are not official assessments.</li>
          <li>Heat is from one summer day, not an average.</li>
          <li>We only cover a few Boston neighborhoods today.</li>
        </ul>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold">Programs</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          Action plans only use programs from our checked list. Each program shows the date we
          last checked it.
        </p>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold">Sample data in this demo</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          Until the real data is connected, the scores, map colors, flood and air-quality tiles, improvement
          estimates and action ideas you see are made-up samples. Screens that show them carry a red
          &ldquo;Sample data&rdquo; notice. The house pictures are illustrations.
        </p>
      </section>

      <Link href="/" className="text-sm font-medium text-mint hover:underline">
        Back to search
      </Link>
    </article>
  );
}
