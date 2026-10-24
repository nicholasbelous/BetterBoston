// Builds the system + user prompt for the action plan.
// Full prompt text and rules: .kiro/specs/climatecheck-mvp/design.md
// ("Action plan prompt").
import "server-only";
import type { Program, ScoreCell, ScoreMetadata, Tenure } from "@/lib/types";

/**
 * TODO (task 4.2): system prompt must say, at minimum:
 * - Use ONLY the programs in the provided JSON. Cite each by its exact `id`.
 * - Never invent programs, phone numbers, dollar amounts, dates, or eligibility rules.
 *   If a detail is not in the program JSON, leave it out.
 * - Scores are relative comparisons, not official assessments.
 * - Heat is ground surface temperature on one summer day, not air temperature.
 * - Plain English, 8th-grade reading level, short sentences.
 * - Return 3-5 actions via the submit_action_plan tool.
 */
export function buildSystemPrompt(): string {
  return "TODO: system prompt (task 4.2)";
}

/**
 * TODO (task 4.2): user message with three JSON blocks:
 * <scores>{cell scores + reference area + scene date}</scores>
 * <tenure>renter|owner</tenure>
 * <programs>[...only programs already filtered by tenure...]</programs>
 */
export function buildUserPrompt(args: {
  cell: ScoreCell;
  metadata: ScoreMetadata;
  tenure: Tenure;
  programs: Program[];
}): string {
  void args;
  return "TODO: user prompt (task 4.2)";
}
