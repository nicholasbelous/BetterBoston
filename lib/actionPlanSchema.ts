// Validates the model's JSON output and enforces the honesty rules:
// - every action must reference a real program id from the allowed list
// - the text may not contain phone numbers, dollar amounts, emails, or web
//   addresses that don't appear in the program data
import { z } from "zod";
import type { Program } from "@/lib/types";

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

export const MIN_ACTIONS = 3;

// Specific facts the model must never make up.
const FACT_PATTERNS: RegExp[] = [
  /\$\s?\d[\d,]*(\.\d+)?/g, // dollar amounts
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, // phone numbers like 617-635-8733
  /\b\d{3}[-.\s][A-Z]{4}\b/g, // phone numbers like 866-527-SAVE
  /[\w.+-]+@[\w-]+\.[\w.]+/g, // emails
  /\bhttps?:\/\/\S+|\bwww\.\S+/gi, // web addresses
];

/** Facts in `text` that do not appear anywhere in the allowed programs' JSON. */
export function findUnsupportedFacts(text: string, programs: Program[]): string[] {
  const corpus = JSON.stringify(programs).toLowerCase();
  const found: string[] = [];
  for (const pattern of FACT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const fact = match[0].replace(/[.,;:)]+$/, "");
      if (!corpus.includes(fact.toLowerCase())) found.push(fact);
    }
  }
  return found;
}

export type ValidationResult =
  | { ok: true; plan: ModelActionPlan }
  | { ok: false; reason: string };

/**
 * Checks the raw model output. Drops actions with unknown or repeated program ids.
 * Fails if fewer than MIN_ACTIONS valid actions remain, or if the text contains
 * a phone number, dollar amount, email, or URL that isn't in the program data.
 */
export function validateModelPlan(raw: unknown, allowed: Program[]): ValidationResult {
  const parsed = modelActionPlanSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: `schema: ${z.prettifyError(parsed.error)}` };

  const allowedIds = new Set(allowed.map((p) => p.id));
  const seen = new Set<string>();
  const actions = parsed.data.actions.filter((a) => {
    if (!allowedIds.has(a.program_id) || seen.has(a.program_id)) return false;
    seen.add(a.program_id);
    return true;
  });
  if (actions.length < MIN_ACTIONS) {
    return { ok: false, reason: `only ${actions.length} actions cite allowed programs` };
  }

  const text = [parsed.data.summary, ...actions.flatMap((a) => [a.title, a.why])].join("\n");
  const unsupported = findUnsupportedFacts(text, allowed);
  if (unsupported.length > 0) {
    return { ok: false, reason: `unsupported facts: ${unsupported.join(", ")}` };
  }

  return { ok: true, plan: { summary: parsed.data.summary, actions } };
}
