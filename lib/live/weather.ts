// Live weather: National Weather Service (observations, forecast, alerts) plus
// Open-Meteo for the 7-day outlook, "feels like" highs, and UV.
// All temperatures here are AIR temperatures. Never mix them with the
// ground-temperature heat score.
import "server-only";
import type { LiveCitation, LiveResult, LiveWeather, WeatherAlert, WeatherDay, WeatherPeriod } from "@/lib/types";
import { cached, coordKey, cToF, fetchJson, HOUR, MINUTE, round } from "@/lib/live/http";

const NWS = "https://api.weather.gov";

/** NWS heat products (including the 2025 rename from "Excessive" to "Extreme"). */
const HEAT_EVENTS = new Set([
  "Heat Advisory",
  "Excessive Heat Warning",
  "Excessive Heat Watch",
  "Extreme Heat Warning",
  "Extreme Heat Watch",
]);

interface NwsPoints {
  properties: { forecast: string; observationStations: string; relativeLocation?: unknown };
}
interface NwsForecast {
  properties: {
    periods: {
      name: string;
      temperature: number;
      temperatureUnit: string;
      isDaytime: boolean;
      shortForecast: string;
      probabilityOfPrecipitation?: { value: number | null };
    }[];
  };
}
interface NwsStations {
  features: { properties: { stationIdentifier: string; name: string } }[];
}
interface NwsQuantity {
  value: number | null;
}
interface NwsObservation {
  properties: {
    timestamp: string;
    textDescription: string | null;
    temperature: NwsQuantity;
    heatIndex: NwsQuantity;
    relativeHumidity: NwsQuantity;
  };
}
interface NwsAlerts {
  features: {
    properties: { event: string; headline: string | null; severity: string | null; ends: string | null; expires: string | null };
  }[];
}
interface OpenMeteoForecast {
  current?: { uv_index?: number | null };
  daily?: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    apparent_temperature_max: (number | null)[];
    uv_index_max: (number | null)[];
    precipitation_probability_max: (number | null)[];
  };
}

const geoHeaders = { Accept: "application/geo+json" };

function getPoints(lat: number, lng: number) {
  return cached(`nws-points:${coordKey(lat, lng, 3)}`, 24 * HOUR, () =>
    fetchJson<NwsPoints>(`${NWS}/points/${lat.toFixed(4)},${lng.toFixed(4)}`, { headers: geoHeaders }),
  );
}

async function getForecast(points: NwsPoints): Promise<WeatherPeriod[]> {
  const url = points.properties.forecast;
  const body = await cached(`nws-forecast:${url}`, 30 * MINUTE, () =>
    fetchJson<NwsForecast>(url, { headers: geoHeaders }),
  );
  return body.properties.periods.slice(0, 4).map((p) => ({
    name: p.name,
    temperature_f: p.temperatureUnit === "C" ? round(cToF(p.temperature)) : p.temperature,
    is_daytime: p.isDaytime,
    short_forecast: p.shortForecast,
    precip_chance_pct: p.probabilityOfPrecipitation?.value ?? null,
  }));
}

async function getObservation(points: NwsPoints): Promise<LiveWeather["observed"]> {
  const stationsUrl = points.properties.observationStations;
  const stations = await cached(`nws-stations:${stationsUrl}`, 24 * HOUR, () =>
    fetchJson<NwsStations>(`${stationsUrl}?limit=1`, { headers: geoHeaders }),
  );
  const station = stations.features[0]?.properties;
  if (!station) return null;
  const obs = await cached(`nws-obs:${station.stationIdentifier}`, 10 * MINUTE, () =>
    fetchJson<NwsObservation>(`${NWS}/stations/${station.stationIdentifier}/observations/latest`, {
      headers: geoHeaders,
    }),
  );
  const p = obs.properties;
  const toF = (q: NwsQuantity) => (q.value === null ? null : round(cToF(q.value)));
  return {
    station: station.stationIdentifier,
    station_name: station.name,
    time: p.timestamp,
    temperature_f: toF(p.temperature),
    heat_index_f: toF(p.heatIndex),
    humidity_pct: p.relativeHumidity.value === null ? null : round(p.relativeHumidity.value),
    description: p.textDescription,
  };
}

async function getAlerts(lat: number, lng: number): Promise<WeatherAlert[]> {
  const body = await cached(`nws-alerts:${coordKey(lat, lng, 3)}`, 5 * MINUTE, () =>
    fetchJson<NwsAlerts>(`${NWS}/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`, { headers: geoHeaders }),
  );
  return body.features.map((f) => ({
    event: f.properties.event,
    headline: f.properties.headline,
    severity: f.properties.severity,
    ends: f.properties.ends ?? f.properties.expires,
  }));
}

async function getOutlook(lat: number, lng: number): Promise<{ daily: WeatherDay[]; uv: number | null }> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(3));
  url.searchParams.set("longitude", lng.toFixed(3));
  url.searchParams.set("current", "uv_index");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,apparent_temperature_max,uv_index_max,precipitation_probability_max",
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "America/New_York");
  url.searchParams.set("forecast_days", "7");

  const body = await cached(`om-forecast:${coordKey(lat, lng, 2)}`, 30 * MINUTE, () =>
    fetchJson<OpenMeteoForecast>(url),
  );
  const d = body.daily;
  const r = (v: number | null | undefined) => (v === null || v === undefined ? null : round(v));
  const daily: WeatherDay[] = d
    ? d.time.map((date, i) => ({
        date,
        high_f: r(d.temperature_2m_max[i]),
        low_f: r(d.temperature_2m_min[i]),
        feels_like_high_f: r(d.apparent_temperature_max[i]),
        uv_index_max: d.uv_index_max[i] === null || d.uv_index_max[i] === undefined ? null : round(d.uv_index_max[i]!, 1),
        precip_chance_pct: r(d.precipitation_probability_max[i]),
      }))
    : [];
  const uv = body.current?.uv_index;
  return { daily, uv: uv === null || uv === undefined ? null : round(uv, 1) };
}

export async function getWeather(lat: number, lng: number): Promise<LiveResult<LiveWeather>> {
  const sources: LiveCitation[] = [];

  const [pointsResult, alertsResult, outlookResult] = await Promise.allSettled([
    getPoints(lat, lng),
    getAlerts(lat, lng),
    getOutlook(lat, lng),
  ]);

  let forecast: WeatherPeriod[] = [];
  let observed: LiveWeather["observed"] = null;
  if (pointsResult.status === "fulfilled") {
    const [f, o] = await Promise.allSettled([getForecast(pointsResult.value), getObservation(pointsResult.value)]);
    if (f.status === "fulfilled") forecast = f.value;
    if (o.status === "fulfilled") observed = o.value;
  }
  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const outlook = outlookResult.status === "fulfilled" ? outlookResult.value : { daily: [], uv: null };

  const gotNws = forecast.length > 0 || observed !== null || alertsResult.status === "fulfilled";
  if (gotNws) sources.push({ name: "National Weather Service (api.weather.gov)", url: "https://www.weather.gov/box/" });
  if (outlook.daily.length > 0) sources.push({ name: "Open-Meteo forecast", url: "https://open-meteo.com/" });

  if (!gotNws && outlook.daily.length === 0) {
    return { ok: false, error: "unavailable", message: "Weather services aren't responding right now." };
  }

  return {
    ok: true,
    data: {
      observed,
      forecast,
      daily: outlook.daily,
      current_uv_index: outlook.uv,
      hot_days_next_7: outlook.daily.filter((d) => (d.high_f ?? 0) >= 90).length,
      alerts,
      heat_alert: alerts.some((a) => HEAT_EVENTS.has(a.event)),
      air_quality_alert: alerts.some((a) => a.event === "Air Quality Alert"),
    },
    sources,
    fetched_at: new Date().toISOString(),
    note:
      alertsResult.status === "rejected"
        ? "Weather alerts couldn't be checked right now. See weather.gov for current alerts."
        : "These are air temperatures. The heat score on this page measures the ground, not the air.",
  };
}
