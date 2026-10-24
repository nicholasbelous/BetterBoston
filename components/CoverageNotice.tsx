// Shown when an address is outside the processed demo area.
// Never show a score in this case.
import Link from "next/link";

export default function CoverageNotice({ neighborhoods = [] }: { neighborhoods?: string[] }) {
  // TODO (task 1.5): list metadata.area.neighborhoods so people know what IS covered.
  return (
    <section className="rounded-lg border p-4 bg-yellow-50">
      <h2 className="font-semibold">Coverage coming soon</h2>
      <p>
        We haven&apos;t mapped this area yet. Right now we cover a few Boston neighborhoods
        {neighborhoods.length > 0 ? `: ${neighborhoods.join(", ")}` : ""}.
      </p>
      <Link href="/" className="underline">
        Try another address
      </Link>
    </section>
  );
}
