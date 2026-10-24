// ============================================================================
// MOCK DATA - NOT REAL. Demo addresses used while the real geocoder is not built.
// Lives outside components/ on purpose. Replace by deleting the fallback in
// services/climateClient.ts once /api/geocode is implemented.
// ============================================================================

export interface DemoAddress {
  id: string;
  /** Street line shown as the title. */
  label: string;
  /** "City, MA ZIP" line shown under the title. */
  cityLine: string;
  neighborhood: string;
  lat: number;
  lng: number;
  /** Lowercase strings that should match this address when someone types it. */
  aliases: string[];
}

// The first three points sit inside scored cells (checked with GET /api/score).
// Beacon Hill is last on purpose: it is outside the scored area, so it demos
// "Coverage coming soon" with the real aerial photo above it.
export const DEMO_ADDRESSES: DemoAddress[] = [
  {
    id: "chinatown",
    label: "Hudson St",
    cityLine: "Chinatown, Boston, MA 02111",
    neighborhood: "Chinatown",
    lat: 42.3513,
    lng: -71.0613,
    aliases: ["hudson", "chinatown"],
  },
  {
    id: "west-roxbury",
    label: "Centre St",
    cityLine: "West Roxbury, Boston, MA 02132",
    neighborhood: "West Roxbury",
    lat: 42.2857,
    lng: -71.159,
    aliases: ["centre st", "center st", "west roxbury"],
  },
  {
    id: "east-boston",
    label: "Meridian St",
    cityLine: "East Boston, Boston, MA 02128",
    neighborhood: "East Boston",
    lat: 42.3702,
    lng: -71.039,
    aliases: ["meridian", "east boston", "eastie"],
  },
  {
    id: "beacon-hill",
    label: "72 Beacon St",
    cityLine: "Boston, MA 02108",
    neighborhood: "Beacon Hill",
    lat: 42.3563,
    lng: -71.0689,
    aliases: ["72 beacon", "beacon st", "beacon street", "beacon hill"],
  },
];

/** The address every screen shows when no location has been chosen yet (Chinatown, inside the scored area). */
export const DEFAULT_DEMO_ADDRESS = DEMO_ADDRESSES[0] as DemoAddress;
