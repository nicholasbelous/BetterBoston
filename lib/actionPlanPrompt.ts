// Builds the system + user prompt for the action plan.
// Design notes: .kiro/specs/climatecheck-mvp/design.md ("Action plan prompt").
import "server-only";
import type { LiveFacts } from "@/lib/live/context";
import type { PlanAudience, Program, ScoreCell, ScoreMetadata } from "@/lib/types";

export const ACTION_PLAN_TOOL_NAME = "submit_action_plan";
export const ACTION_PLAN_TOOL_DESCRIPTION =
  "Submit the personalized action plan: a short summary plus 3 to 5 actions, each citing one program id.";

export function buildSystemPrompt(): string {
  return `You write short, practical climate action plans for people who live in Massachusetts.

Follow every rule:
1. Recommend ONLY programs listed in <programs>. Cite each one by its exact "id". Use each program at most once.
2. Never invent programs, phone numbers, emails, websites, dollar amounts, dates, deadlines, or eligibility rules. Only mention a detail if it appears in that program's JSON or in <live_conditions>. If you are not sure, leave the detail out.
3. The scores compare this block with other blocks in the same area. They are not official assessments. Do not call a block "dangerous" or "safe".
4. The heat score is the ground surface temperature measured by satellite on one summer day (the date is in <scores>). It is not the air temperature. Say "the ground" or "streets and rooftops" for it.
5. <live_conditions> holds facts from public data services, fetched just now. Weather and climate numbers there are AIR temperatures. Never mix them with the ground temperature, and never present one as the other.
6. Use live facts only to make an action more relevant (for example, an active heat advisory makes cooling centers urgent, or empty tree planting spots nearby make a tree request useful). Name the source in plain words, like "the National Weather Service". If <live_conditions> is missing a fact, don't mention it.
7. Green cover comes from the same Landsat satellite image as the heat score (one summer day, 30 m pixels). It counts grass and trees together. Call it "green cover", not "tree canopy". Street tree counts include City trees only, not yard trees.
8. If a score is null, say there was not enough clear data for that part. Do not guess.
9. Write at an 8th-grade reading level. Use short sentences and everyday words. Speak to the reader as "you".
10. "summary": 2 or 3 sentences about what the numbers mean for this block.
11. Return 3 to 5 actions, most useful first. "title" is a short action that starts with a verb. "why" is 1 or 2 sentences that connect the program to this block's numbers or live conditions.
12. Answer only by calling the ${ACTION_PLAN_TOOL_NAME} tool.`;
}

/** Only the fields the model needs. Links are not sent; the server adds them from the program record. */
function programForPrompt(p: Program) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    topics: p.topics,
    ...(p.details ? { details: p.details } : {}),
  };
}

/** Live facts as sent to the model (the `sources_used` bookkeeping is dropped). */
export function liveFactsForPrompt(live: LiveFacts | null): Omit<LiveFacts, "sources_used"> | null {
  if (!live) return null;
  const { sources_used: _unused, ...facts } = live;
  void _unused;
  return facts;
}

export function buildUserPrompt(args: {
  cell: ScoreCell;
  metadata: ScoreMetadata;
  tenure: PlanAudience;
  programs: Program[];
  live?: LiveFacts | null;
}): string {
  const { cell, metadata, tenure, programs, live } = args;
  const scores = {
    neighborhood: cell.neighborhood,
    heat: {
      mean_ground_surface_temp_f: cell.mean_surface_temp_f,
      difference_from_average_f: cell.temp_diff_f,
      heat_score_0_to_100: cell.heat_score,
      higher_score_means: "hotter ground than most other blocks",
      compared_with: metadata.heat.reference_area,
      satellite_date: metadata.heat.scene_date,
    },
    green_cover: {
      percent_of_block_green: cell.pct_vegetated,
      tree_score_0_to_100: cell.tree_score,
      higher_score_means: "greener than most other blocks",
      compared_with: metadata.tree.reference_area,
      photo_dates: metadata.tree.imagery_dates,
    },
  };

  const liveBlock = liveFactsForPrompt(live ?? null);

  return `<scores>
${JSON.stringify(scores, null, 2)}
</scores>

<tenure>${tenure === "everyone" ? "not asked (could be a renter or an owner; say when a program is only for owners)" : tenure}</tenure>

<live_conditions>
${liveBlock ? JSON.stringify(liveBlock, null, 2) : "none available"}
</live_conditions>

<programs>
${JSON.stringify(programs.map(programForPrompt), null, 2)}
</programs>`;
}
