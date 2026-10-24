// Curated Massachusetts program data from data/programs/*.json.
// This is the ONLY list of programs the AI may cite.
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "@/lib/config";
import type { Program, Tenure } from "@/lib/types";

/** Files in data/programs/ */
export const PROGRAM_FILES = [
  "cooling_centers.json",
  "tree_requests.json",
  "mass_save_rebates.json",
  "community_solar.json",
  "rooftop_solar.json",
] as const;

const programSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "ids are lowercase-with-dashes"),
  category: z.enum(["cooling_center", "tree_request", "rebate", "community_solar", "rooftop_solar"]),
  name: z.string().min(1),
  description: z.string().min(1),
  link: z.url(),
  audience: z.array(z.enum(["renter", "owner"])).min(1),
  topics: z.array(z.enum(["heat", "trees", "energy", "solar"])).min(1),
  last_verified: z.iso.date().nullable(),
  details: z.record(z.string(), z.string()).optional(),
});

const programFileSchema = z.object({
  category: programSchema.shape.category,
  programs: z.array(programSchema),
});

let cache: Program[] | null = null;

/** Every program in data/programs, verified or not. Throws on invalid files or duplicate ids. */
export async function loadAllPrograms(): Promise<Program[]> {
  if (cache) return cache;
  const all: Program[] = [];
  for (const file of PROGRAM_FILES) {
    const text = await readFile(path.join(process.cwd(), "data", "programs", file), "utf8");
    const parsed = programFileSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(`data/programs/${file} is invalid: ${z.prettifyError(parsed.error)}`);
    }
    all.push(...parsed.data.programs);
  }
  const seen = new Set<string>();
  for (const p of all) {
    if (seen.has(p.id)) throw new Error(`Duplicate program id "${p.id}" in data/programs`);
    seen.add(p.id);
  }
  cache = all;
  return all;
}

/**
 * Programs users and the AI may see. Unverified programs (last_verified === null)
 * are hidden unless ALLOW_UNVERIFIED_PROGRAMS=true (local development only).
 */
export async function loadPrograms(): Promise<Program[]> {
  const all = await loadAllPrograms();
  return config.allowUnverifiedPrograms ? all : all.filter((p) => p.last_verified !== null);
}

/**
 * Renters get programs with "renter" in audience (cooling centers, alerts, tree requests,
 * energy assessments, community solar). Owners also get owner-only programs
 * (heat pumps, rooftop solar).
 */
export function filterByTenure(programs: Program[], tenure: Tenure): Program[] {
  return programs.filter((p) => p.audience.includes(tenure));
}
