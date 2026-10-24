// Landing page: address search + "use my location" + demo addresses.
// On success, AddressSearch navigates to /map?lat=..&lng=..&q=<label>.
//
// Layout follows the first phone of the design mock-up: header, "Massachusetts" pill,
// big headline, copy, address search, then the coastal photograph filling the lower
// part of the screen with three value indicators over it. On large screens the photo
// moves to the right and runs to the edge of the window.
import Image from "next/image";
import AddressSearch from "@/components/AddressSearch";
import FeatureGrid from "@/components/landing/FeatureGrid";
import Icon, { type IconName } from "@/components/ui/Icon";
import { eyebrowPill } from "@/components/ui/classes";

const VALUES: { icon: IconName; label: string }[] = [
  // Only claims that are true today (scores are still SAMPLE data).
  { icon: "map", label: "Aerial photos" },
  { icon: "database", label: "Live local data" },
  { icon: "shield", label: "Checked programs" },
];

// Stagger for the entrance animation (the .rise-in class is disabled for reduced motion).
const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export default function HomePage() {
  return (
    <>
      <section
        aria-labelledby="hero-heading"
        className="relative isolate flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden lg:min-h-[min(calc(100dvh-4rem),54rem)] lg:justify-center"
      >
        {/* soft ocean-blue glow behind the headline */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(46rem_30rem_at_12%_6%,rgb(32_104_168/0.30),transparent_68%)]"
        />

        {/* copy + search */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-5 sm:pt-8 lg:pb-16 lg:pt-0">
          <div className="flex max-w-xl flex-col gap-5 lg:max-w-[34rem] lg:gap-6">
            <span className={`${eyebrowPill} rise-in self-start`} style={delay(0)}>
              Massachusetts
            </span>
            <h1
              id="hero-heading"
              className="rise-in font-display text-[2.5rem] font-bold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-[3.5rem] xl:text-[3.75rem]"
              style={delay(60)}
            >
              <span className="block">See your home.</span>
              <span className="block">Plan a cooler,</span>
              <span className="block">healthier future.</span>
            </h1>
            <p className="rise-in max-w-md text-[15px] leading-relaxed text-ink-dim lg:text-base" style={delay(120)}>
              Understand climate risks, explore visual data, and get personalized recommendations for your home.
            </p>
            <div className="rise-in" style={delay(180)}>
              <AddressSearch />
            </div>
          </div>
        </div>

        {/* coastal photograph: fills the rest of the first screen on phones, right side on desktop */}
        <div
          className="rise-in relative z-0 -mt-12 min-h-[19rem] flex-1 sm:min-h-[28rem] lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:w-[58%] lg:flex-none"
          style={delay(240)}
        >
          {/*
            The mask fades the photo's top edge (phones) or left edge (desktop) into the page.
            The shading overlays live INSIDE the masked wrapper, so they fade out with it and
            never leave a hard edge against the page's blue glow.
          */}
          <div className="hero-photo-mask absolute inset-0">
            <Image
              src="/images/climatecheck-coast.jpg"
              alt="Sunset over the water at a Massachusetts coastal neighborhood, with shingled homes among the trees"
              fill
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover object-[50%_50%] lg:object-[45%_58%]"
            />
            {/* soft top edge under the header (desktop) */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 hidden h-24 bg-gradient-to-b from-navy-950/60 to-transparent lg:block"
            />
            {/* darken the bottom so the value indicators read cleanly */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy-950 via-navy-950/55 to-transparent lg:h-2/5"
            />
          </div>

          <ul className="absolute inset-x-0 bottom-0 mx-auto grid max-w-md grid-cols-3 gap-2 px-5 pb-6 pt-14 lg:inset-x-auto lg:bottom-0 lg:right-8 lg:mx-0 lg:w-[28rem] lg:px-0 lg:pb-10">
            {VALUES.map((v) => (
              <li key={v.label} className="flex flex-col items-center gap-2.5 text-center">
                <span className="grid size-[3.25rem] place-items-center rounded-full border border-mint/45 bg-navy-950/60 text-mint backdrop-blur-sm">
                  <Icon name={v.icon} size={22} />
                </span>
                <span className="text-xs font-medium text-white/90">{v.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FeatureGrid />
    </>
  );
}
