// ============================================================================
// MOCK DATA - NOT REAL. Flood and air-quality levels shown in the design.
// There is no flood or air-quality dataset in the project yet, so these are
// placeholders. The UI tags them "Sample" wherever they appear.
// ============================================================================

export type RiskLevel = "Low" | "Moderate" | "High";

export interface HomeExtras {
  flood: RiskLevel;
  air: RiskLevel;
}

const BY_NEIGHBORHOOD: Record<string, HomeExtras> = {
  "Beacon Hill": { flood: "Low", air: "Moderate" },
  Chinatown: { flood: "Moderate", air: "Moderate" },
  "West Roxbury": { flood: "Low", air: "Low" },
  "East Boston": { flood: "High", air: "Moderate" },
};

export function mockExtrasFor(neighborhood: string | null | undefined): HomeExtras {
  return (neighborhood && BY_NEIGHBORHOOD[neighborhood]) || { flood: "Low", air: "Low" };
}
