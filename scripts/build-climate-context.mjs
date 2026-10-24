// Builds data/live/climate_boston.json: Boston-area hot-day history and climate
// model projections from Open-Meteo. Run once before the demo:
//   npm run build:climate
// Long date ranges count as many requests on Open-Meteo's free tier, so this
// runs offline with pauses instead of on every page load.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const POINT = { lat: 42.36, lng: -71.06, label: "Boston (downtown grid cell)" };
const HOT_F = 90;
const MODELS = ["CMCC_CM2_VHR4", "FGOALS_f3_H", "HiRAM_SIT_HR", "MRI_AGCM3_2_S", "EC_Earth3P_HR", "MPI_ESM1_2_XR", "NICAM16_8S"];
const OUT = path.join(process.cwd(), "data", "live", "climate_boston.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, label) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "ClimateCheckMA/0.1 (hackathon)" } });
    if (res.ok) return res.json();
    const body = await res.text();
    if (res.status === 429 && attempt < 4) {
      console.log(`  ${label}: rate limited, waiting 65 s (attempt ${attempt})`);
      await sleep(65_000);
      continue;
    }
    throw new Error(`${label}: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
}

function archive(start, end) {
  const u = new URL("https://archive-api.open-meteo.com/v1/archive");
  u.search = new URLSearchParams({
    latitude: String(POINT.lat), longitude: String(POINT.lng), start_date: start, end_date: end,
    daily: "temperature_2m_max", temperature_unit: "fahrenheit", timezone: "America/New_York",
  });
  return u;
}

function hotPerYear(time, values, from, to) {
  let n = 0;
  time.forEach((t, i) => {
    const y = Number(t.slice(0, 4));
    if (y >= from && y <= to && values[i] != null && values[i] >= HOT_F) n++;
  });
  return n / (to - from + 1);
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (n) => Math.round(n * 10) / 10;

const now = new Date();
const summerYear = now.getUTCMonth() + 1 >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;

console.log(`Last summer (${summerYear})...`);
const summer = await get(archive(`${summerYear}-06-01`, `${summerYear}-08-31`), "last summer");
let hottest = -Infinity, hottestDate = "", hot = 0;
summer.daily.temperature_2m_max.forEach((v, i) => {
  if (v == null) return;
  if (v >= HOT_F) hot++;
  if (v > hottest) { hottest = v; hottestDate = summer.daily.time[i]; }
});

console.log("1991-2020 baseline...");
await sleep(5_000);
const base = await get(archive("1991-01-01", "2020-12-31"), "baseline");
const baseline = r1(hotPerYear(base.daily.time, base.daily.temperature_2m_max, 1991, 2020));

console.log("Climate model projections (7 models)...");
await sleep(65_000);
const cu = new URL("https://climate-api.open-meteo.com/v1/climate");
cu.search = new URLSearchParams({
  latitude: String(POINT.lat), longitude: String(POINT.lng), start_date: "1995-01-01", end_date: "2050-12-31",
  models: MODELS.join(","), daily: "temperature_2m_max", temperature_unit: "fahrenheit",
});
const proj = await get(cu, "projection");
const past = [], future = [];
for (const m of MODELS) {
  const s = proj.daily[`temperature_2m_max_${m}`];
  if (!s) continue;
  past.push(hotPerYear(proj.daily.time, s, 1995, 2014));
  future.push(hotPerYear(proj.daily.time, s, 2031, 2050));
}

const out = {
  generated_at: now.toISOString(),
  generated_by: "scripts/build-climate-context.mjs",
  location: POINT,
  hot_threshold_f: HOT_F,
  last_summer: { year: summerYear, days_90f_or_more: hot, hottest_f: Math.round(hottest), hottest_date: hottestDate },
  baseline_days_90f_per_year: baseline,
  projection: future.length
    ? {
        model_count: future.length,
        period_past: "1995-2014",
        period_future: "2031-2050",
        median_days_past: r1(median(past)),
        median_days_future: r1(median(future)),
        range_days_future: [r1(Math.min(...future)), r1(Math.max(...future))],
      }
    : null,
  sources: [
    { name: "Open-Meteo Historical Weather (reanalysis)", url: "https://open-meteo.com/en/docs/historical-weather-api" },
    { name: "Open-Meteo Climate API (CMIP6 high-resolution models)", url: "https://open-meteo.com/en/docs/climate-api" },
  ],
};

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${path.relative(process.cwd(), OUT)}`);
console.log(JSON.stringify({ last_summer: out.last_summer, baseline: out.baseline_days_90f_per_year, projection: out.projection }, null, 2));
