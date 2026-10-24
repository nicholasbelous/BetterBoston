// Landing page: address search + "use my location" + demo addresses.
// On success, AddressSearch navigates to /map?lat=..&lng=..&q=<label>.
import HeroCoast from "@/components/art/HeroCoast";
import AddressSearch from "@/components/AddressSearch";
import FeatureGrid from "@/components/landing/FeatureGrid";
import Icon, { type IconName } from "@/components/ui/Icon";
import { eyebrowPill } from "@/components/ui/classes";

const VALUES: { icon: IconName; label: string }[] = [
  { icon: "database", label: "Real data" },
  { icon: "sparkle", label: "AI insights" },
  { icon: "bulb", label: "Actionable tips" },
];

export default function HomePage() {
  return (
    <>
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 pt-6 md:grid-cols-2 md:items-center md:gap-12 md:pt-14 lg:gap-20">
        <section className="rise-in flex flex-col gap-5">
          <span className={`${eyebrowPill} self-start`}>Massachusetts</span>
          <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
            See your home.
            <br />
            Plan a cooler, healthier future.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-ink-dim">
            Understand climate risks, explore visual data, and get personalized recommendations for your
            home.
          </p>
          <AddressSearch />
        </section>

        <div
          className="relative isolate h-72 overflow-hidden rounded-3xl border border-line shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] sm:h-96 md:h-[30rem]"
          role="img"
          aria-label="Illustration of a Massachusetts coastal neighborhood at dusk"
        >
          <HeroCoast className="absolute inset-0 size-full" />
          <ul className="absolute inset-x-0 bottom-0 grid grid-cols-3 gap-2 bg-gradient-to-t from-navy-950 via-navy-950/70 to-transparent px-4 pb-4 pt-12">
            {VALUES.map((v) => (
              <li key={v.label} className="flex flex-col items-center gap-2 text-center">
                <span className="grid size-12 place-items-center rounded-full border border-mint/40 bg-navy-900/70 text-mint backdrop-blur">
                  <Icon name={v.icon} size={22} />
                </span>
                <span className="text-xs font-medium text-ink">{v.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <FeatureGrid />
    </>
  );
}
