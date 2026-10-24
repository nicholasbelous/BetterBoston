// Landing page: address search + "use my location" + demo addresses.
// On success, AddressSearch navigates to /map?lat=..&lng=..&q=<label>.
//
// Layout follows the first phone of the design mock-up: header, "Boston" pill,
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
        {/* Full-bleed Boston skyline behind everything, slowly drifting. */}
        <div aria-hidden="true" className="absolute inset-0 -z-20 overflow-hidden">
          <Image
            src="/images/boston-skyline.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            quality={90}
            className="hero-drift object-cover object-[50%_58%] lg:object-[50%_52%]"
          />
        </div>
        {/*
          Shading: navy at the top (phones) or left (desktop) so the white headline reads over a
          bright sky, the city stays visible in the middle, and the bottom melts into the page.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(6_15_22/0.94)_0%,rgb(6_15_22/0.82)_34%,rgb(6_15_22/0.35)_58%,rgb(6_15_22/0.25)_70%,var(--color-navy-950)_100%)] lg:bg-[linear-gradient(90deg,rgb(6_15_22/0.95)_0%,rgb(6_15_22/0.86)_34%,rgb(6_15_22/0.35)_62%,rgb(6_15_22/0.15)_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 hidden h-48 bg-gradient-to-t from-navy-950 to-transparent lg:block"
        />
        {/* mint glow, echoing the app's accent color */}
        <div
          aria-hidden="true"
          className="hero-glow pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_26rem_at_10%_0%,rgb(62_230_180/0.16),transparent_70%)]"
        />

        {/* copy + search */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-5 sm:pt-8 lg:pb-16 lg:pt-0">
          <div className="flex max-w-xl flex-col gap-5 lg:max-w-[34rem] lg:gap-6">
            <span className={`${eyebrowPill} rise-in self-start`} style={delay(0)}>
              Boston
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

        {/* The skyline shows through here on phones; on desktop the indicators sit bottom right. */}
        <div
          className="rise-in relative z-0 min-h-[17rem] flex-1 sm:min-h-[24rem] lg:absolute lg:inset-y-0 lg:right-0 lg:w-[58%] lg:flex-none"
          style={delay(240)}
        >
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
