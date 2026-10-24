// POST /api/action-plan  body: ActionPlanRequest { cell_id, tenure }
// 200 ActionPlan | 400 bad body | 404 unknown cell | 502 model error/invalid output
// The client sends only cell_id + tenure. Scores are looked up server-side so
// the prompt always uses pipeline output, never client-supplied numbers.
// Contract: .kiro/specs/climatecheck-mvp/design.md ("API routes", "Action plan prompt")
import type { ApiError } from "@/lib/types";

export async function POST(request: Request) {
  void request;
  // TODO (task 4.3):
  // 1. Parse body with zod: cell_id string, tenure "renter" | "owner".
  // 2. getCellById(cell_id) -> 404 if missing.
  // 3. filterByTenure(await loadPrograms(), tenure).
  // 4. buildSystemPrompt() + buildUserPrompt(...) -> converseForJson(...).
  // 5. validateModelPlan(raw, programIds). On failure return 502 and let the UI
  //    show the plain program list as a fallback.
  // 6. Fill each action's link from the program record. Return ActionPlan.
  return Response.json(
    { error: "not_implemented", message: "Action plan is not built yet" } satisfies ApiError,
    { status: 501 },
  );
}
