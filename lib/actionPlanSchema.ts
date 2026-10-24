// Validates the model's JSON output and enforces the honesty rule:
// every action must reference a real program id from data/programs.
import { z } from "zod";

/** What the model returns via the submit_action_plan tool. */
export const modelActionPlanSchema = z.object({
  summary: z.string().min(1).max(600),
  actions: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        why: z.string().min(1).max(400),
        program_id: z.string().min(1),
      }),
    )
    .min(3)
    .max(5),
});

export type ModelActionPlan = z.infer<typeof modelActionPlanSchema>;

/** JSON Schema passed to Claude as the submit_action_plan tool's input_schema (lib/claude.ts). */
export const modelActionPlanJsonSchema = z.toJSONSchema(modelActionPlanSchema);

/**
 * TODO (task 4.3):
 * - Parse with modelActionPlanSchema.safeParse.
 * - Drop any action whose program_id is not in allowedProgramIds.
 * - If fewer than 1 action survives, treat as a failure (caller shows a
 *   fallback list of the filtered programs instead of AI text).
 * - The `link` for each action is copied from the program record by the
 *   route, never taken from model output.
 */
export function validateModelPlan(
  raw: unknown,
  allowedProgramIds: Set<string>,
): ModelActionPlan | null {
  void raw;
  void allowedProgramIds;
  return null;
}
