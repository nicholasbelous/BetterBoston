// Shown when an address is outside the scored area (data/scores).
// Never show a score in this case.
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { btnGhost, card } from "@/components/ui/classes";

export default function CoverageNotice() {
  return (
    <section className={`${card} flex flex-col gap-3 p-5`}>
      <span className="grid size-10 place-items-center rounded-xl bg-amber/15 text-amber">
        <Icon name="map" size={22} />
      </span>
      <h2 className="font-display text-lg font-semibold">Coverage coming soon</h2>
      <p className="text-sm leading-relaxed text-ink-dim">
        We haven&apos;t scored this spot yet. Right now our scores cover most of the City of Boston.
      </p>
      <Link href="/" className={`${btnGhost} self-start`}>
        Try another address
      </Link>
    </section>
  );
}
