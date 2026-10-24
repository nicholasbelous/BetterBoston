// Server-only configuration. Reads env vars in one place so routes don't
// touch process.env directly. Never import this from a client component.
import "server-only";

/** Display name. Change here when the team picks the final [PROJECT_NAME]. */
export const APP_NAME = "ClimateCheck MA";

export type GeocoderProvider = "census" | "nominatim";

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
}

export const config = {
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
  claudeModel: optional("CLAUDE_MODEL") ?? "claude-haiku-5-5",
  geocoderProvider: (optional("GEOCODER_PROVIDER") ?? "census") as GeocoderProvider,
  geocoderUserAgent: optional("GEOCODER_USER_AGENT") ?? "ClimateCheckMA/0.1",
  nominatimBaseUrl: optional("NOMINATIM_BASE_URL") ?? "https://nominatim.openstreetmap.org",
  allowUnverifiedPrograms: optional("ALLOW_UNVERIFIED_PROGRAMS") === "true",
  /** Folder with demo_grid.geojson + demo_grid.meta.json, relative to the project root */
  scoresDir: optional("SCORES_DIR") ?? "data/scores",
  /** Set LIVE_DATA_ENABLED=false to turn off every live API call (e.g. offline demo) */
  liveDataEnabled: optional("LIVE_DATA_ENABLED") !== "false",
  googleSolarApiKey: optional("GOOGLE_SOLAR_API_KEY"),
} as const;

// TODO: validate GEOCODER_PROVIDER is one of the allowed values.
// lib/claude.ts already throws a clear error if ANTHROPIC_API_KEY is missing.
