// Report page: /report?lat=..&lng=..&q=<label>
// Shows the aerial map, score cards, renter/owner toggle, and action plan.
import ActionPlanList from "@/components/ActionPlanList";
import CoverageNotice from "@/components/CoverageNotice";
import MapView from "@/components/MapView";
import SampleDataBanner from "@/components/SampleDataBanner";
import ScoreCard from "@/components/ScoreCard";
import TenureToggle from "@/components/TenureToggle";

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const params = await searchParams;
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const label = typeof params.q === "string" ? params.q : "";

  // TODO (task 1.5):
  // - Validate lat/lng; if invalid, show an error and a link back home.
  // - Call lookupScore(lng, lat) from lib/scores directly (server component, no fetch needed).
  // - status "out_of_coverage" -> <CoverageNotice /> only. Never show a made-up score.
  // - status "no_data" -> map + "not enough clear data for this block".
  // - metadata.is_sample -> <SampleDataBanner /> at the top.
  // TODO (task 4/5): tenure state lives in a small client wrapper around
  // TenureToggle + ActionPlanList, which POSTs { cell_id, tenure } to /api/action-plan.
  const valid = Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <div className="flex flex-col gap-4">
      <SampleDataBanner />
      <h1 className="text-xl font-bold">{label || "Your block"}</h1>
      {valid ? <MapView lat={lat} lng={lng} /> : <CoverageNotice />}
      <ScoreCard kind="heat" cell={null} metadata={null} />
      <ScoreCard kind="tree" cell={null} metadata={null} />
      <TenureToggle />
      <ActionPlanList plan={null} />
    </div>
  );
}
