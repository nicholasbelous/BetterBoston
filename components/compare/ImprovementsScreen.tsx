"use client";
// Screen 4: before and after. The slider is the main feature; the chips switch
// improvements on and off in the "after" picture and in the estimated benefits.
import Link from "next/link";
import { useMemo, useState } from "react";
import HouseScene from "@/components/art/HouseScene";
import BeforeAfterSlider from "@/components/compare/BeforeAfterSlider";
import SampleDataBanner from "@/components/SampleDataBanner";
import { btnGhost, btnPrimary, card, iconBtn } from "@/components/ui/classes";
import Icon from "@/components/ui/Icon";
import { useReport } from "@/hooks/useReport";
import { HOUSE_PHOTOS } from "@/mocks/houseImages.mock";
import {
  ALL_IMPROVEMENT_IDS,
  estimateBenefits,
  IMPROVEMENTS,
  type ImprovementId,
} from "@/mocks/improvements.mock";
import { splitAddress, withLocation, type LocationContext } from "@/services/locationContext";

const NONE: ReadonlySet<ImprovementId> = new Set();

function Pane({ src, alt, fallback }: { src: string | null; alt: string; fallback: React.ReactNode }) {
  if (!src) return <>{fallback}</>;
  // Plain <img>: optional local photos in public/images, no remote optimizer needed.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="size-full object-cover" draggable={false} />;
}

export default function ImprovementsScreen({ initial }: { initial: LocationContext }) {
  const { data } = useReport(initial.lat, initial.lng);
  const [selected, setSelected] = useState<ReadonlySet<ImprovementId>>(() => new Set(ALL_IMPROVEMENT_IDS));
  const benefits = useMemo(() => estimateBenefits(selected), [selected]);
  const { title } = splitAddress(initial.q);
  const here = initial.isDefault ? null : initial;
  const allOn = selected.size === IMPROVEMENTS.length;

  function toggle(id: ImprovementId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-6 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <Link href={withLocation("/report", here)} aria-label="Back to the home analysis" className={iconBtn}>
          <Icon name="arrowLeft" size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold leading-tight tracking-tight md:text-3xl">
            Your Home with Improvements
          </h1>
          <p className="truncate text-sm text-ink-dim">{title}</p>
        </div>
      </div>

      <div className="mb-4">
        <SampleDataBanner
          show={data?.isSample ?? false}
          note="The pictures are illustrations and the benefits below are illustrative numbers, not predictions."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-10">
        <div>
          <BeforeAfterSlider
            className="aspect-[4/3] w-full lg:aspect-[5/4]"
            before={
              <Pane
                src={HOUSE_PHOTOS?.before ?? null}
                alt="The house today"
                fallback={<HouseScene improvements={NONE} label="Illustration of the house today" className="size-full" />}
              />
            }
            after={
              <Pane
                src={HOUSE_PHOTOS?.after ?? null}
                alt="The house with improvements"
                fallback={
                  <HouseScene
                    improvements={selected}
                    label="Illustration of the house with the selected improvements"
                    className="size-full"
                  />
                }
              />
            }
          />
          <p className="mt-2.5 text-center text-xs text-ink-mute">
            {HOUSE_PHOTOS ? "Drag the handle to compare." : "Illustration, same house and angle in both. Drag the handle to compare."}
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="chips-heading">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h2 id="chips-heading" className="font-display text-lg font-semibold">
                Improvements
              </h2>
              <button
                type="button"
                onClick={() => setSelected(allOn ? new Set() : new Set(ALL_IMPROVEMENT_IDS))}
                className="min-h-11 px-1 text-sm font-medium text-mint hover:underline"
              >
                {allOn ? "Clear all" : "Select all"}
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {IMPROVEMENTS.map((imp) => {
                const on = selected.has(imp.id);
                return (
                  <li key={imp.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(imp.id)}
                      className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-medium transition ${
                        on
                          ? "border-mint/50 bg-mint-tint text-mint"
                          : "border-line bg-navy-800/80 text-ink-dim hover:bg-navy-700 hover:text-ink"
                      }`}
                    >
                      <Icon name={imp.icon} size={18} />
                      <span className="flex-1">{imp.label}</span>
                      {on ? <Icon name="check" size={16} /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="benefits-heading">
            <div className="mb-2.5 flex items-center gap-2">
              <h2 id="benefits-heading" className="font-display text-lg font-semibold">
                Estimated Benefits
              </h2>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-ink-dim">
                Illustrative
              </span>
            </div>
            <ul className={`${card} divide-y divide-line`}>
              {benefits.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3.5">
                  <Icon name={b.icon} size={20} className={b.tone === "good" ? "text-heat" : "text-ink-mute"} />
                  <span className="flex-1 text-sm text-ink-dim">{b.label}</span>
                  <span className={`text-right text-sm font-semibold ${b.tone === "good" ? "text-mint" : "text-ink-mute"}`}>
                    {b.value}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-ink-mute">
              Illustrative estimates from the design, not predictions for your home. Real results depend on your
              building, your block and the weather.
            </p>
          </section>

          <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
            <Link href={withLocation("/actions", here)} className={`${btnPrimary} flex-1`}>
              See Recommended Actions
              <Icon name="arrowRight" size={18} />
            </Link>
            <Link href={withLocation("/report", here)} className={btnGhost}>
              Back to analysis
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
