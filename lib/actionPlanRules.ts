// Rule-based action plan. Used when there is no ANTHROPIC_API_KEY, when the
// Claude call fails, or when its output fails validation, so the demo never breaks.
// Uses only the block's scores, live facts from public APIs, and the program
// records. No invented facts.
import type { LiveFacts } from "@/lib/live/context";
import type { PlanAudience, Program, ScoreCell, ScoreMetadata } from "@/lib/types";

export const HEAT_HIGH_SCORE = 60;
export const TREE_LOW_SCORE = 40;

const MAX_ACTIONS = 5;

/** Program ids in priority order for each situation. Ids missing from the allowed list are skipped. */
function priorityOrder(cell: ScoreCell, tenure: PlanAudience, live: LiveFacts | null): string[] {
  // An active NWS heat alert makes heat actions urgent, whatever the block's score.
  const hot = (cell.heat_score ?? 0) >= HEAT_HIGH_SCORE || live?.weather?.heat_alert === true;
  const lowGreen =
    (cell.tree_score !== null && cell.tree_score <= TREE_LOW_SCORE) ||
    (live?.street_trees?.empty_planting_sites ?? 0) > 0;

  const heat = ["boston-cooling-centers", "boston-alertboston"];
  const trees = ["boston-street-tree-request"];
  const energy =
    tenure !== "renter"
      ? ["mass-save-heat-pumps", "mass-save-home-energy-assessment", "mass-save-income-eligible"]
      : ["mass-save-home-energy-assessment", "mass-save-income-eligible"];
  const solar =
    tenure !== "renter" ? ["ma-smart-rooftop-solar", "ma-community-solar"] : ["ma-community-solar"];

  const order: string[] = [];
  if (hot) order.push(...heat);
  if (lowGreen) order.push(...trees);
  order.push(...energy, ...solar);
  if (!hot) order.push(...heat);
  if (!lowGreen) order.push(...trees);
  return [...new Set(order)];
}

function round(n: number): number {
  return Math.round(Math.abs(n));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2024-06-25" -> "June 25, 2024" (falls back to the raw string) */
export function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function heatPhrase(cell: ScoreCell, metadata: ScoreMetadata): string | null {
  if (cell.temp_diff_f === null) return null;
  const d = cell.temp_diff_f;
  // SAMPLE metadata has no real scene date; leave the date out rather than print "on SAMPLE".
  const when = /^\d{4}-\d{2}-\d{2}$/.test(metadata.heat.scene_date)
    ? `on ${formatDate(metadata.heat.scene_date)}`
    : "on one summer day";
  if (d >= 1) return `the ground on your block was about ${round(d)}°F hotter than the ${metadata.heat.reference_area} average ${when}`;
  if (d <= -1) return `the ground on your block was about ${round(d)}°F cooler than the ${metadata.heat.reference_area} average ${when}`;
  return `the ground on your block was about as hot as the ${metadata.heat.reference_area} average ${when}`;
}

function greenPhrase(cell: ScoreCell): string | null {
  if (cell.pct_vegetated === null) return null;
  return `about ${Math.round(cell.pct_vegetated)}% of your block looked green from the satellite on the same summer day`;
}

function heatAlertPhrase(live: LiveFacts | null): string | null {
  if (!live?.weather?.heat_alert) return null;
  const event = live.weather.active_alerts.find((a) => /heat/i.test(a)) ?? "heat alert";
  return `The National Weather Service has a ${event} for your area right now.`;
}

function nearestCenterPhrase(live: LiveFacts | null): string | null {
  const c = live?.cooling_places?.nearest_community_center;
  if (!c) return null;
  return `The closest BCYF community center is ${c.name}, about ${c.distance_mi} miles away in a straight line.`;
}

/**
 * One "why" line per program. Every claim here is a block number from the
 * pipeline, a live fact from a public API, or a fact from that program's
 * description in data/programs.
 */
function whyFor(program: Program, cell: ScoreCell, metadata: ScoreMetadata, live: LiveFacts | null): string {
  const heat = heatPhrase(cell, metadata);
  const green = greenPhrase(cell);
  const hot = (cell.heat_score ?? 0) >= HEAT_HIGH_SCORE;
  const alert = heatAlertPhrase(live);

  switch (program.id) {
    case "boston-cooling-centers": {
      const lead = alert ?? (hot && heat ? `${capitalize(heat)}.` : "Even cooler blocks get heat waves.");
      const nearest = nearestCenterPhrase(live);
      return [lead, "During extreme heat, BCYF community centers open as cooling centers, and anyone can go.", nearest]
        .filter(Boolean)
        .join(" ");
    }
    case "boston-alertboston":
      return alert
        ? `${alert} AlertBoston sends a text, call, or email when the City declares a heat emergency.`
        : "You'll get a text, call, or email when the City declares a heat emergency, so you can plan ahead.";
    case "boston-street-tree-request": {
      const t = live?.street_trees;
      const spots =
        t && t.empty_planting_sites > 0
          ? `The City's tree inventory lists ${t.empty_planting_sites} empty planting ${t.empty_planting_sites === 1 ? "spot" : "spots"} within ${t.within_m} m of your block.`
          : null;
      return [green ? `${capitalize(green)}.` : null, spots, "Street trees shade sidewalks and help cool the ground."]
        .filter(Boolean)
        .join(" ");
    }
    case "mass-save-home-energy-assessment":
      return "An Energy Specialist can suggest upgrades, like insulation and air sealing, that help keep your home cooler in summer.";
    case "mass-save-income-eligible":
      return "If your household income qualifies, upgrades like heat pumps or efficient window air conditioners may come at no cost.";
    case "mass-save-heat-pumps":
      return hot
        ? "Your block runs hotter than most. A heat pump cools your home in summer and heats it in winter."
        : "A heat pump cools your home in summer and heats it in winter.";
    case "ma-community-solar":
      return "You can use solar power without panels on your roof and get credits on your electric bill.";
    case "ma-smart-rooftop-solar":
      return "The state's SMART program pays you for the solar power your own panels make.";
    default:
      return program.description;
  }
}

function titleFor(program: Program): string {
  switch (program.id) {
    case "boston-cooling-centers":
      return "Know where to cool off";
    case "boston-alertboston":
      return "Sign up for heat alerts";
    case "boston-street-tree-request":
      return "Request a street tree";
    case "mass-save-home-energy-assessment":
      return "Get a no-cost home energy assessment";
    case "mass-save-income-eligible":
      return "Check if you qualify for no-cost upgrades";
    case "mass-save-heat-pumps":
      return "Look into a heat pump";
    case "ma-community-solar":
      return "Join community solar";
    case "ma-smart-rooftop-solar":
      return "Explore rooftop solar";
    default:
      return program.name;
  }
}

export function buildRulesPlan(args: {
  cell: ScoreCell;
  metadata: ScoreMetadata;
  tenure: PlanAudience;
  programs: Program[];
  live?: LiveFacts | null;
}): { summary: string; actions: { title: string; why: string; program_id: string }[] } {
  const { cell, metadata, tenure, programs } = args;
  const live = args.live ?? null;
  const byId = new Map(programs.map((p) => [p.id, p]));

  const chosen: Program[] = [];
  for (const id of priorityOrder(cell, tenure, live)) {
    const p = byId.get(id);
    if (p) chosen.push(p);
    if (chosen.length === MAX_ACTIONS) break;
  }
  // Any allowed program not in the priority list (e.g. a new one) can fill remaining slots.
  for (const p of programs) {
    if (chosen.length >= MAX_ACTIONS) break;
    if (!chosen.includes(p)) chosen.push(p);
  }

  const parts = [heatPhrase(cell, metadata), greenPhrase(cell)].filter(Boolean) as string[];
  const facts = parts.length
    ? `${parts.map(capitalize).join(". ")}.`
    : "There wasn't enough clear data to score this block.";
  const advice =
    tenure === "renter"
      ? "As a renter, these programs can help you stay cool and save energy."
      : tenure === "owner"
        ? "As an owner, these programs can help you cool your home and save energy."
        : "These programs can help you stay cool and save energy. Some are only for homeowners.";

  const alert = heatAlertPhrase(live);

  return {
    summary: [
      alert,
      facts,
      "These numbers compare your block with nearby blocks. They are not an official assessment.",
      advice,
    ]
      .filter(Boolean)
      .join(" "),
    actions: chosen.map((p) => ({ title: titleFor(p), why: whyFor(p, cell, metadata, live), program_id: p.id })),
  };
}
