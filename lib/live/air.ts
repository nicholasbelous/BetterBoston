// Live air quality: Open-Meteo Air Quality API (CAMS model). This is a modeled
// estimate, not a monitor reading, and must be labeled that way.
import "server-only";
import type { AqiCategory, LiveAir, LiveResult } from "@/lib/types";
import { cached, coordKey, fetchJson, MINUTE, round } from "@/lib/live/http";

interface OpenMeteoAir {
  current?: {
    time: string;
    us_aqi: number | null;
    pm2_5: number | null;
    ozone: number | null;
    us_aqi_pm2_5: number | null;
    us_aqi_ozone: number | null;
  };
  hourly?: { time: string[]; us_aqi: (number | null)[] };
}

/** EPA AQI categories. */
export function aqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

export async function getAir(lat: number, lng: number): Promise<LiveResult<LiveAir>> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", lat.toFixed(3));
  url.searchParams.set("longitude", lng.toFixed(3));
  url.searchParams.set("current", "us_aqi,pm2_5,ozone,us_aqi_pm2_5,us_aqi_ozone");
  url.searchParams.set("hourly", "us_aqi");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "America/New_York");

  const body = await cached(`om-air:${coordKey(lat, lng, 2)}`, 60 * MINUTE, () => fetchJson<OpenMeteoAir>(url));
  const c = body.current;
  if (!c || c.us_aqi === null || c.us_aqi === undefined) {
    return { ok: false, error: "unavailable", message: "Air quality data isn't available right now." };
  }

  // Next 24 hours, starting at the current hour.
  let maxNext: number | null = null;
  if (body.hourly) {
    const start = Math.max(0, body.hourly.time.findIndex((t) => t >= c.time));
    const next = body.hourly.us_aqi.slice(start, start + 24).filter((v): v is number => v !== null);
    if (next.length) maxNext = Math.max(...next);
  }

  const pmAqi = c.us_aqi_pm2_5 ?? -1;
  const o3Aqi = c.us_aqi_ozone ?? -1;
  const aqi = round(c.us_aqi);

  return {
    ok: true,
    data: {
      us_aqi: aqi,
      category: aqiCategory(aqi),
      pm2_5_ugm3: c.pm2_5 === null ? null : round(c.pm2_5, 1),
      ozone_ugm3: c.ozone === null ? null : round(c.ozone),
      main_pollutant: pmAqi < 0 && o3Aqi < 0 ? null : pmAqi >= o3Aqi ? "PM2.5" : "Ozone",
      max_aqi_next_24h: maxNext === null ? null : round(maxNext),
      max_category_next_24h: maxNext === null ? null : aqiCategory(maxNext),
      modeled: true,
    },
    sources: [{ name: "Open-Meteo Air Quality (CAMS model)", url: "https://open-meteo.com/en/docs/air-quality-api" }],
    fetched_at: new Date().toISOString(),
    note: "Modeled estimate for the area, not a reading from a nearby monitor.",
  };
}
