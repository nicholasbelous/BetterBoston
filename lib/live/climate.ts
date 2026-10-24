// Climate context for the Boston area: last summer's hot days, the 1991-2020
// average, and climate model projections for 2031-2050.
// Long-range Open-Meteo requests are too heavy for its free tier to run per
// page load, so the numbers are computed once by `npm run build:climate`
// into data/live/climate_boston.json. They are regional AIR temperatures,
// not block-level and not the ground-temperature heat score.
import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { LiveCitation, LiveClimate, LiveResult } from "@/lib/types";
import { getBostonNeighborhood } from "@/lib/live/area";

const CLIMATE_FILE = path.join(process.cwd(), "data", "live", "climate_boston.json");

interface ClimateFile extends LiveClimate {
  generated_at: string;
  sources: LiveCitation[];
}

let cache: { mtimeMs: number; value: ClimateFile } | null = null;

async function loadClimateFile(): Promise<ClimateFile> {
  const { mtimeMs } = await stat(/*turbopackIgnore: true*/ CLIMATE_FILE);
  if (cache && cache.mtimeMs === mtimeMs) return cache.value;
  const value = JSON.parse(await readFile(/*turbopackIgnore: true*/ CLIMATE_FILE, "utf8")) as ClimateFile;
  cache = { mtimeMs, value };
  return value;
}

export async function getClimate(lat: number, lng: number): Promise<LiveResult<LiveClimate>> {
  const neighborhood = await getBostonNeighborhood(lat, lng);
  if (!neighborhood) {
    return { ok: false, error: "outside_coverage", message: "Climate history is prepared for Boston only." };
  }
  let file: ClimateFile;
  try {
    file = await loadClimateFile();
  } catch {
    return { ok: false, error: "unavailable", message: "Climate history hasn't been built yet (npm run build:climate)." };
  }
  return {
    ok: true,
    data: {
      last_summer: file.last_summer,
      baseline_days_90f_per_year: file.baseline_days_90f_per_year,
      projection: file.projection,
    },
    sources: file.sources,
    fetched_at: file.generated_at,
    note: "Boston-area air temperatures from weather and climate models, not measurements on your block. Projections are a range across models, not a forecast.",
  };
}
