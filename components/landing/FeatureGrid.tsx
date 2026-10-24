// "What you get" cards on the landing page. Each card opens its screen.
import Link from "next/link";
import Icon, { type IconName } from "@/components/ui/Icon";
import { card } from "@/components/ui/classes";

interface Feature {
  icon: IconName;
  title: string;
  body: string;
  href?: string;
}

const FEATURES: Feature[] = [
  {
    icon: "map",
    title: "Interactive Map",
    body: "See heat and green cover around any covered block, with filters.",
    href: "/map",
  },
  {
    icon: "home",
    title: "Home Analysis",
    body: "A plain-English climate report for one address.",
    href: "/report",
  },
  {
    icon: "compare",
    title: "Before & After",
    body: "Drag to see how shade, roofs and plants could change your home.",
    href: "/improvements",
  },
  {
    icon: "bulb",
    title: "Personalized Actions",
    body: "Clear next steps for homeowners and renters.",
    href: "/actions",
  },
  {
    icon: "chart",
    title: "Real Data Insights",
    body: "Built on satellite heat and aerial imagery. Sources shown on every score.",
    href: "/about",
  },
  {
    icon: "phone",
    title: "Mobile Friendly",
    body: "Designed to read well on a phone first, then tablet and desktop.",
  },
];

export default function FeatureGrid() {
  return (
    <section aria-labelledby="features-heading" className="mx-auto w-full max-w-6xl px-5 pt-14">
      <h2 id="features-heading" className="font-display text-xl font-semibold tracking-tight md:text-2xl">
        What you&apos;ll get
      </h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const inner = (
            <>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mint-tint text-mint">
                <Icon name={f.icon} size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{f.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-ink-dim">{f.body}</span>
              </span>
              {f.href ? <Icon name="chevronRight" size={18} className="shrink-0 text-ink-mute" /> : null}
            </>
          );
          return (
            <li key={f.title}>
              {f.href ? (
                <Link
                  href={f.href}
                  className={`${card} flex items-center gap-4 p-4 transition hover:border-mint/40 hover:bg-navy-700/70`}
                >
                  {inner}
                </Link>
              ) : (
                <div className={`${card} flex items-center gap-4 p-4`}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
