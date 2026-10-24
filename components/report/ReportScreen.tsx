"use client";
// Screen 3: home analysis for one address.
// Header (back, share, save), the real aerial photo of the block (any Massachusetts
// address, even outside the scored area), tabs (Overview / Climate Risks /
// Recommendations = the real action plan with a rent/own choice), and the risk summary.
import Link from "next/link";
import { useState } from "react";
import CoverageNotice from "@/components/CoverageNotice";
import DataSourceNote from "@/components/DataSourceNote";
import AerialPhoto, { inMassachusettsBox } from "@/components/report/AerialPhoto";
import LiveConditions from "@/components/report/LiveConditions";
import ReportPlan from "@/components/report/ReportPlan";
import { coverTone, levelFromScore, riskTone, TONE_TEXT } from "@/components/report/levels";
import RiskTile from "@/components/report/RiskTile";
import SampleDataBanner from "@/components/SampleDataBanner";
import ScoreCard from "@/components/ScoreCard";
import { btnPrimary, card, eyebrowPill, iconBtn } from "@/components/ui/classes";
import Icon from "@/components/ui/Icon";
import Tabs, { type TabItem } from "@/components/ui/Tabs";
import { useReport } from "@/hooks/useReport";
import { useStoredString } from "@/hooks/useStoredString";
import type { ScoreCell, ScoreMetadata } from "@/lib/types";
import type { ReportData } from "@/services/climateClient";
import { splitAddress, withLocation, type LocationContext } from "@/services/locationContext";

type TabId = "overview" | "risks" | "recs";

const TABS: TabItem<TabId>[] = [
  { id: "overview", label: "Overview" },
  { id: "risks", label: "Climate Risks" },
  { id: "recs", label: "Recommendations" },
];

const SAVED_KEY = "climatecheck:saved";

function readSaved(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function heatHeadline(level: ReturnType<typeof levelFromScore>): string {
  if (level === "High") return "Your block's ground got hotter than most blocks we compared.";
  if (level === "Moderate") return "Your block's ground was in the middle of the blocks we compared.";
  if (level === "Low") return "Your block's ground stayed cooler than most blocks we compared.";
  return "Not enough clear heat data for this block.";
}

function heatDetail(cell: ScoreCell, metadata: ScoreMetadata): string {
  const parts: string[] = [];
  if (cell.temp_diff_f !== null) {
    const when = metadata.is_sample ? "" : ` on ${metadata.heat.scene_date}`;
    parts.push(
      `The ground here ran ${Math.abs(cell.temp_diff_f).toFixed(1)}\u00B0F ${cell.temp_diff_f >= 0 ? "hotter" : "cooler"} than ${metadata.heat.reference_area}${when}.`,
    );
  }
  if (cell.pct_vegetated !== null) {
    parts.push(`About ${Math.round(cell.pct_vegetated)}% of the block looked green in the aerial photo.`);
  }
  parts.push("Heat is ground surface temperature on one summer day, not air temperature.");
  return parts.join(" ");
}

// The aerial photo has its own loading state, so this only covers the scores column.
function Skeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading your report">
      <div className="h-10 animate-pulse rounded-xl bg-navy-800" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-navy-800" />
        ))}
      </div>
      <div className="h-28 animate-pulse rounded-2xl bg-navy-800" />
    </div>
  );
}

function RiskSummary({ data }: { data: ReportData }) {
  const heat = levelFromScore(data.cell?.heat_score);
  const tree = levelFromScore(data.cell?.tree_score);
  return (
    // Flood and air quality are live values in "Right now near you" below, not made-up levels.
    <div className="grid grid-cols-2 gap-3">
      <RiskTile icon="thermometer" label="Ground heat" level={heat} tone={riskTone(heat)} emptyText="No data" />
      <RiskTile icon="tree" label="Green cover" level={tree} tone={coverTone(tree)} emptyText="No data" />
    </div>
  );
}

export default function ReportScreen({ initial }: { initial: LocationContext }) {
  const { data } = useReport(initial.lat, initial.lng);
  const [tab, setTab] = useState<TabId>("overview");
  const [saved, setSaved] = useStoredString(SAVED_KEY);
  const [notice, setNotice] = useState<string | null>(null);

  const { title, sub } = splitAddress(initial.q);
  const savedList = readSaved(saved);
  const isSaved = savedList.includes(initial.q);
  const here = initial.isDefault ? null : initial;

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  }

  function toggleSaved() {
    const next = isSaved ? savedList.filter((q) => q !== initial.q) : [...savedList, initial.q];
    setSaved(JSON.stringify(next));
    flash(isSaved ? "Removed from saved homes" : "Saved to this device");
  }

  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${title} | ClimateCheck MA`, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied");
    } catch {
      flash("Couldn't copy the link");
    }
  }

  const covered = data?.status === "ok" && data.cell !== null;
  const heatLevel = levelFromScore(data?.cell?.heat_score);
  // The photo shows right away and gets the score cell outline once the scores load.
  const showPhoto = inMassachusettsBox(initial.lat, initial.lng);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-6 pt-4">
      <div className="mb-4 flex items-start gap-3">
        <Link href={withLocation("/map", here)} aria-label="Back to the map" className={iconBtn}>
          <Icon name="arrowLeft" size={20} />
        </Link>
        <div className="min-w-0 flex-1 pt-0.5">
          {/* Wrap instead of truncating: on a phone the buttons left only ~5 letters of the address. */}
          <h1 className="line-clamp-2 break-words font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl md:text-3xl">
            {title}
          </h1>
          {sub ? <p className="line-clamp-2 text-sm text-ink-dim">{sub}</p> : null}
        </div>
        {/* Wrapper: eyebrowPill's inline-flex overrode "hidden", so the pill squeezed the address on phones. */}
        {covered ? (
          <span className="mt-1 hidden sm:block">
            <span className={eyebrowPill}>Analyzed</span>
          </span>
        ) : null}
        <button type="button" onClick={share} aria-label="Share this report" className={iconBtn}>
          <Icon name="share" size={19} />
        </button>
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={isSaved}
          aria-label={isSaved ? "Remove from saved homes" : "Save this home"}
          className={`${iconBtn} ${isSaved ? "text-heat" : ""}`}
        >
          <Icon name="heart" size={19} filled={isSaved} />
        </button>
      </div>

      <div className="mb-4">
        <SampleDataBanner
          show={data?.isSample ?? true}
          note="The aerial photo and the local conditions are real."
        />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {notice ?? ""}
      </p>
      {notice ? (
        <div className="rise-in fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full border border-line-strong bg-navy-700 px-4 py-2 text-sm shadow-xl md:bottom-8" aria-hidden="true">
          {notice}
        </div>
      ) : null}

      <div className={showPhoto ? "grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-10" : ""}>
        {showPhoto ? (
          <div className="lg:sticky lg:top-24">
            <AerialPhoto
              lat={initial.lat}
              lng={initial.lng}
              geometry={data?.geometry ?? null}
              cellSizeM={data?.metadata.grid.cell_size_m ?? null}
              place={title}
            />
          </div>
        ) : null}

        {data === null ? (
          <Skeleton />
        ) : data.status === "out_of_coverage" ? (
          <div className="flex max-w-xl flex-col gap-5">
            <CoverageNotice neighborhoods={data.metadata.area.neighborhoods} />
            {showPhoto ? <LiveConditions lat={initial.lat} lng={initial.lng} /> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <Tabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Report sections" idPrefix="report" />
            </div>

            {tab === "overview" ? (
              <div
                role="tabpanel"
                id="report-panel-overview"
                aria-labelledby="report-tab-overview"
                className="rise-in flex flex-col gap-5"
              >
                <div>
                  <h2 className="mb-3 font-display text-lg font-semibold">Climate Risk Summary</h2>
                  {data.status === "no_data" || !data.cell ? (
                    <p className={`${card} p-4 text-sm text-ink-dim`}>Not enough clear data for this block.</p>
                  ) : (
                    <RiskSummary data={data} />
                  )}
                </div>
                {data.cell ? (
                  <section className={`${card} flex gap-3.5 p-4`}>
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber/15 text-amber">
                      <Icon name="sun" size={24} />
                    </span>
                    <div>
                      <h3 className={`font-display text-base font-semibold ${heatLevel ? TONE_TEXT[riskTone(heatLevel)] : ""}`}>
                        {heatHeadline(heatLevel)}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-dim">
                        {heatDetail(data.cell, data.metadata)}
                      </p>
                      <DataSourceNote kind="heat" metadata={data.metadata} />
                    </div>
                  </section>
                ) : null}
                <LiveConditions lat={initial.lat} lng={initial.lng} />
              </div>
            ) : null}

            {tab === "risks" ? (
              <div
                role="tabpanel"
                id="report-panel-risks"
                aria-labelledby="report-tab-risks"
                className="rise-in flex flex-col gap-4"
              >
                <ScoreCard kind="heat" cell={data.cell} metadata={data.metadata} />
                <ScoreCard kind="tree" cell={data.cell} metadata={data.metadata} />
                <p className={`${card} p-4 text-sm leading-relaxed text-ink-dim`}>
                  <strong className="font-medium text-ink">Flooding, air quality, and today&apos;s weather</strong> are
                  live readings from public agencies. See &ldquo;Right now near you&rdquo; on the Overview tab.
                </p>
              </div>
            ) : null}

            {tab === "recs" ? (
              <div
                role="tabpanel"
                id="report-panel-recs"
                aria-labelledby="report-tab-recs"
                className="rise-in flex flex-col gap-3"
              >
                <h2 className="font-display text-lg font-semibold">Your action plan</h2>
                {data.cell ? (
                  <ReportPlan cellId={data.cell.cell_id} />
                ) : (
                  <p className={`${card} p-4 text-sm text-ink-dim`}>Not enough clear data for this block yet.</p>
                )}
              </div>
            ) : null}

            {tab !== "recs" ? (
              <button
                type="button"
                onClick={() => {
                  setTab("recs");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`${btnPrimary} w-full lg:w-auto lg:self-start`}
              >
                See your action plan
                <Icon name="arrowRight" size={18} />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
