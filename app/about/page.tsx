// About / data sources page. Plain language, 8th-grade reading level.
export default function AboutPage() {
  // TODO (task 6.2): read data/scores/demo_grid.meta.json and show the real
  // scene date, thresholds, and covered neighborhoods instead of hard-coded text.
  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">About the data</h1>

      <section>
        <h2 className="font-semibold">Heat</h2>
        <p>
          We use the NASA/USGS Landsat satellite. It measures how hot the ground and rooftops were
          on one clear summer day. This is the surface temperature, not the air temperature you
          feel. We compare your block with the Boston average.
        </p>
        {/* TODO: link https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products */}
      </section>

      <section>
        <h2 className="font-semibold">Trees and green space</h2>
        <p>
          We use the MassGIS 2025 aerial photos, which include an infrared band. Plants reflect a
          lot of infrared light, so we can tell green areas from pavement and roofs. These photos
          were taken in spring 2025, before most trees had leaves.
        </p>
        {/* TODO: link https://www.mass.gov/info-details/massgis-data-2025-aerial-imagery */}
      </section>

      <section>
        <h2 className="font-semibold">What the scores are not</h2>
        <ul className="list-disc pl-5">
          <li>Scores compare blocks with each other. They are not official assessments.</li>
          <li>Heat is from one summer day, not an average.</li>
          <li>We only cover a few Boston neighborhoods today.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">Programs</h2>
        <p>
          Action plans only use programs from our checked list. Each program shows the date we
          last checked it.
        </p>
      </section>
    </article>
  );
}
