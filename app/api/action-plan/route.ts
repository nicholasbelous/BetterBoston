// POST /api/action-plan  body: ActionPlanRequest { cell_id, tenure }
// 200 ActionPlan | 400 bad body | 404 unknown cell | 503 data not loaded
// The client sends only cell_id + tenure. Scores are looked up server-side so
// the prompt always uses pipeline output, never client-supplied numbers.
// If Claude is unavailable or its answer fails validation, a rule-based plan
// is returned instead (ActionPlan.source = "rules"), so the demo never breaks.
// Contract: .kiro/specs/climatecheck-mvp/design.md ("API routes", "Action plan prompt")
import { z } from "zod";
import {
  ACTION_PLAN_TOOL_DESCRIPTION,
  ACTION_PLAN_TOOL_NAME,
  buildSystemPrompt,
  buildUserPrompt,
  liveFactsForPrompt,
} from "@/lib/actionPlanPrompt";
import { factsSignature, getLiveFacts } from "@/lib/live/context";
import { buildRulesPlan } from "@/lib/actionPlanRules";
import { modelActionPlanJsonSchema, validateModelPlan } from "@/lib/actionPlanSchema";
import { generateJson } from "@/lib/claude";
import { config } from "@/lib/config";
import { filterByTenure, loadPrograms } from "@/lib/programs";
import { cellCenter, getCellById } from "@/lib/scores";
import type { ActionPlan, ApiError, Program } from "@/lib/types";

const requestSchema = z.object({
  cell_id: z.string().min(1).max(100),
  tenure: z.enum(["renter", "owner", "everyone"]),
});

// Same cell + tenure + data -> same plan. Saves API credits and makes the toggle instant.
const planCache = new Map<string, ActionPlan>();

function error(status: number, code: string, message: string) {
  return Response.json({ error: code, message } satisfies ApiError, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "bad_request", "Body must be JSON");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return error(400, "bad_request", "Body must be { cell_id: string, tenure: 'renter' | 'owner' | 'everyone' }");
  }
  const { cell_id, tenure } = parsed.data;

  let found: Awaited<ReturnType<typeof getCellById>>;
  let programs: Program[];
  try {
    found = await getCellById(cell_id);
    const all = await loadPrograms();
    programs = tenure === "everyone" ? all : filterByTenure(all, tenure);
  } catch (err) {
    console.error("action-plan data load failed", err);
    return error(503, "data_unavailable", "Score or program data isn't loaded yet.");
  }
  if (!found) return error(404, "not_found", "Unknown cell_id");
  if (programs.length === 0) {
    return error(503, "no_programs", "No verified programs are available yet.");
  }

  const cell = found.feature.properties;
  const { metadata } = found;

  // Live conditions for the cell (heat alerts, street trees, nearest centers, ...).
  // Short timeout: anything slow is simply left out of the plan.
  const center = cellCenter(found.feature);
  const live = await getLiveFacts(center.lat, center.lng);

  const cacheKey = [
    cell_id,
    tenure,
    metadata.generated_at,
    programs.map((p) => p.id).join(","),
    factsSignature(live),
  ].join("|");
  const cached = planCache.get(cacheKey);
  if (cached) return Response.json(cached);

  const byId = new Map(programs.map((p) => [p.id, p]));
  let source: ActionPlan["source"] = "rules";
  let content = buildRulesPlan({ cell, metadata, tenure, programs, live });

  if (config.anthropicApiKey) {
    try {
      const raw = await generateJson({
        system: buildSystemPrompt(),
        user: buildUserPrompt({ cell, metadata, tenure, programs, live }),
        toolName: ACTION_PLAN_TOOL_NAME,
        toolDescription: ACTION_PLAN_TOOL_DESCRIPTION,
        inputSchema: modelActionPlanJsonSchema as Record<string, unknown>,
      });
      const result = validateModelPlan(raw, programs, liveFactsForPrompt(live));
      if (result.ok) {
        content = result.plan;
        source = "ai";
      } else {
        console.warn(`AI plan rejected (${result.reason}); using rules plan`);
      }
    } catch (err) {
      console.warn("Claude call failed; using rules plan", err);
    }
  }

  const plan: ActionPlan = {
    summary: content.summary,
    actions: content.actions.map((a) => ({
      title: a.title,
      why: a.why,
      program_id: a.program_id,
      // Links always come from our program record, never from the model.
      link: byId.get(a.program_id)!.link,
    })),
    tenure,
    cell_id,
    source,
    model_id: source === "ai" ? config.claudeModel : "rules",
    generated_at: new Date().toISOString(),
    based_on_sample_data: metadata.is_sample || cell.is_sample,
    live_sources_used: live?.sources_used ?? [],
  };
  planCache.set(cacheKey, plan);
  return Response.json(plan);
}
