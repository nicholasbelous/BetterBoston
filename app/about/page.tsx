// About / data sources page. Plain language, 8th-grade reading level.
import Link from "next/link";
import { card } from "@/components/ui/classes";

export default function AboutPage() {
  // Dates and sources match data/scores/demo_grid.meta.json (LC09 scene, 2024-06-25).
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">About the data</h1>

      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold">Heat</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          We use the NASA/USGS Landsat 9 satellite. It measured how hot the ground and rooftops got
          on one clear summer day, June 25, 2024, around 11:30 a.m. This is the surface temperature,
          not the air temperature you feel. We compare each block with all of Boston.
        </p>
        <a
          href="https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-mint underline underline-offset-2"
        >
          USGS Landsat Collection 2 Level-2
        </a>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold">Green cover</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          We use the same Landsat image. Plants reflect a lot of infrared light, so we can tell green
          areas from pavement and roofs. Trees were in leaf that day. Each satellite pixel is about
          30 m (100 ft) wide, so grass, yards, and trees are counted together. We call it
          &ldquo;green cover,&rdquo; not tree canopy.
        </p>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold">The photo of your block</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          The photo at the top of your report is a MassGIS aerial photo, taken from a plane between
          March 18 and April 23, 2025. It covers all of Massachusetts. It is for seeing your block.
          The scores do not come from it.
        </p>
        <a
          href="https://www.mass.gov/info-details/massgis-data-2025-aerial-imagery"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-mint underline underline-offset-2"
        >
          MassGIS 2025 aerial imagery
        </a>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold">Live local conditions</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          Weather and heat alerts come from the National Weather Service. Air quality is a modeled
          estimate from Open-Meteo. Flood zones come from FEMA and Climate Ready Boston. Street trees,
          community centers, and libraries come from the City of Boston and Analyze Boston. Each card
          shows its source and when it was updated.
        </p>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold">What the scores are not</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-dim marker:text-mint">
          <li>Scores compare blocks with each other. They are not official assessments.</li>
          <li>Heat is from one summer day, not an average.</li>
          <li>Scores cover the City of Boston, except West Roxbury and the Harbor Islands.</li>
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
        <h2 className="font-display text-lg font-semibold">Image credits</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          Boston skyline photo on the home page: marketing photo of the view from 180 Beacon Street,
          Unit 15A, by Related Beal Sales, LLC (listing agent Michael Tammaro). Used with permission.{" "}
          <a
            href="https://www.commonwealthstandard.com/investor/property/180-beacon-street-unit-15a-boston-73587883"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mint underline underline-offset-2"
          >
            View the listing
          </a>
          .
        </p>
      </section>

      <Link href="/" className="text-sm font-medium text-mint hover:underline">
        Back to search
      </Link>
    </article>
  );
}
