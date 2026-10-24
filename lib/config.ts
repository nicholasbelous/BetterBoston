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
  awsRegion: optional("AWS_REGION") ?? "us-east-1",
  bedrockModelId: optional("BEDROCK_MODEL_ID"),
  geocoderProvider: (optional("GEOCODER_PROVIDER") ?? "census") as GeocoderProvider,
  geocoderUserAgent: optional("GEOCODER_USER_AGENT") ?? "ClimateCheckMA/0.1",
  nominatimBaseUrl: optional("NOMINATIM_BASE_URL") ?? "https://nominatim.openstreetmap.org",
  allowUnverifiedPrograms: optional("ALLOW_UNVERIFIED_PROGRAMS") === "true",
  googleSolarApiKey: optional("GOOGLE_SOLAR_API_KEY"),
} as const;

// TODO: validate GEOCODER_PROVIDER is one of the allowed values and fail
// loudly at startup if BEDROCK_MODEL_ID is missing when /api/action-plan is called.
