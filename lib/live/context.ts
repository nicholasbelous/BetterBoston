// Turns live data into a small set of plain facts for the action plan.
// Only values that came back ok are included. Nothing is estimated.
import "server-only";
import type { LiveBundle, LiveSourceId } from "@/lib/types";
import { getLiveBundle } from "@/lib/live";

export interface LiveFacts {
  sources_used: LiveSourceId[];
  weather?: {
    source: string;
    active_alerts: string[];
    heat_alert: boolean;
    air_quality_alert: boolean;
    forecast_today?: string;
    hot_days_next_7: number;
  };
  air?: { source: string; us_aqi: number; category: string; modeled: true };
  flood?: {
    source: string;
    fema_zone: string | null;
    fema_high_risk: boolean | null;
    floods_in_1pct_storm_with_sea_level_rise_in: number | null;
  };
  street_trees?: { source: string; within_m: number; city_trees: number; empty_planting_sites: number };
  cooling_places?: {
    source: string;
    nearest_community_center?: { name: string; distance_mi: number };
    nearest_library?: { name: string; distance_mi: number };
    nearest_pool?: { name: string; distance_mi: number };
    note: string;
  };
  climate?: {
    source: string;
    boston_days_90f_last_summer: number;
    last_summer_year: number;
    boston_avg_days_90f_1991_2020: number;
    boston_median_days_90f_2031_2050?: number;
  };
}

export function factsFromBundle(b: LiveBundle): LiveFacts {
  const facts: LiveFacts = { sources_used: [] };

  if (b.weather.ok) {
    const w = b.weather.data;
    const today = w.forecast.find((p) => p.is_daytime) ?? w.forecast[0];
    facts.weather = {
      source: "National Weather Service",
      active_alerts: w.alerts.map((a) => a.event),
      heat_alert: w.heat_alert,
      air_quality_alert: w.air_quality_alert,
      forecast_today: today ? `${today.name}: ${today.short_forecast}, air temperature ${today.temperature_f}°F` : undefined,
      hot_days_next_7: w.hot_days_next_7,
    };
    facts.sources_used.push("weather");
  }
  if (b.air.ok) {
    facts.air = { source: "Open-Meteo (modeled)", us_aqi: b.air.data.us_aqi, category: b.air.data.category, modeled: true };
    facts.sources_used.push("air");
  }
  if (b.flood.ok) {
    facts.flood = {
      source: "FEMA flood map + Climate Ready Boston",
      fema_zone: b.flood.data.fema_zone,
      fema_high_risk: b.flood.data.fema_high_risk,
      floods_in_1pct_storm_with_sea_level_rise_in: b.flood.data.first_flooded_at_in,
    };
    facts.sources_used.push("flood");
  }
  if (b.trees.ok) {
    facts.street_trees = {
      source: "City of Boston street tree inventory (city trees only, not yard trees)",
      within_m: b.trees.data.radius_m,
      city_trees: b.trees.data.tree_count,
      empty_planting_sites: b.trees.data.empty_planting_sites,
    };
    facts.sources_used.push("trees");
  }
  if (b.places.ok) {
    const p = b.places.data;
    const pick = (x?: { name: string; distance_mi: number }) => (x ? { name: x.name, distance_mi: x.distance_mi } : undefined);
    facts.cooling_places = {
      source: "City of Boston open data",
      nearest_community_center: pick(p.community_centers[0]),
      nearest_library: pick(p.libraries[0]),
      nearest_pool: pick(p.pools[0]),
      note: "BCYF community centers open as cooling centers during declared heat emergencies. Distances are straight-line miles.",
    };
    facts.sources_used.push("places");
  }
  if (b.climate.ok) {
    const c = b.climate.data;
    facts.climate = {
      source: "Open-Meteo weather and climate models (Boston area, air temperature)",
      boston_days_90f_last_summer: c.last_summer.days_90f_or_more,
      last_summer_year: c.last_summer.year,
      boston_avg_days_90f_1991_2020: c.baseline_days_90f_per_year,
      boston_median_days_90f_2031_2050: c.projection?.median_days_future,
    };
    facts.sources_used.push("climate");
  }
  return facts;
}

/**
 * Live facts for a point, or null if live data is off. Uses a short timeout so
 * the action plan never waits long on a slow source: whatever isn't back is skipped.
 */
export async function getLiveFacts(lat: number, lng: number, timeoutMs = 5000): Promise<LiveFacts | null> {
  try {
    const bundle = await getLiveBundle(lat, lng, timeoutMs);
    const facts = factsFromBundle(bundle);
    return facts.sources_used.length ? facts : null;
  } catch {
    return null;
  }
}

/** Short stable signature of the facts that change the plan, for cache keys. */
export function factsSignature(f: LiveFacts | null): string {
  if (!f) return "none";
  return [
    f.weather?.heat_alert ? "heat" : "",
    f.weather?.air_quality_alert ? "aq" : "",
    f.air?.category ?? "",
    f.street_trees?.empty_planting_sites ?? "",
    f.cooling_places?.nearest_community_center?.name ?? "",
  ].join("|");
}
