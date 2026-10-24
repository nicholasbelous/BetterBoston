// Curated Massachusetts program data from data/programs/*.json.
// This is the ONLY list of programs the AI may cite.
import "server-only";
import { config } from "@/lib/config";
import type { Program, Tenure } from "@/lib/types";

export const PROGRAM_FILES = [
  "data/programs/cooling_centers.json",
  "data/programs/tree_requests.json",
  "data/programs/mass_save_rebates.json",
  "data/programs/community_solar.json",
] as const;

/**
 * TODO (task 4.1):
 * - Read every file in PROGRAM_FILES, flatten `programs`, cache.
 * - Drop programs with last_verified === null unless
 *   config.allowUnverifiedPrograms is true (dev only).
 * - Throw if two programs share an id.
 */
export async function loadPrograms(): Promise<Program[]> {
  void config.allowUnverifiedPrograms;
  throw new Error("loadPrograms not implemented yet (task 4.1)");
}

/**
 * TODO (task 5.1): renters get programs whose audience includes "renter"
 * (cooling centers, tree requests, community solar). Owners get everything
 * with "owner" in audience (adds heat pumps, cool roofs, rooftop solar).
 */
export function filterByTenure(programs: Program[], tenure: Tenure): Program[] {
  return programs.filter((p) => p.audience.includes(tenure));
}
