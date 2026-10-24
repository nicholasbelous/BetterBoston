"use client";
// Live local conditions for the report, from GET /api/live (NWS, Open-Meteo, FEMA,
// Climate Ready Boston, City of Boston). Shown for any Massachusetts address.
//
// Rules (see .kiro/steering/data.md):
// - A source with ok: false is hidden. Never show a substitute value.
// - Weather is AIR temperature. It is labeled so and never mixed with the ground-heat score.
// - Air quality is a modeled estimate. Street trees are City trees only.
// - Phone numbers are shown exactly as the City lists them.
// - Every card shows its source and when it was fetched.
import { useEffect, useState } from "react";
import { card } from "@/components/ui/classes";
import Icon, { type IconName } from "@/components/ui/Icon";
import type { LiveBundle, LiveCitation, LiveResult, NearbyPlace } from "@/lib/types";
import { loadLive } from "@/services/climateClient";

const HEAT_PAGE = "https://www.boston.gov/heat";

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Sources({ result }: { result: { sources: LiveCitation[]; fetched_at: string } }) {
  return (
    <p className="mt-2 text-[11px] leading-snug text-ink-mute">
      Source:{" "}
      {result.sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 ? ", " : ""}
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
            {s.name}
          </a>
        </span>
      ))}
      . Updated {timeLabel(result.fetched_at)}.
    </p>
  );
}

function LiveCard({
  icon,
  title,
  label,
  children,
  result,
}: {
  icon: IconName;
  title: string;
  label?: string;
  children: React.ReactNode;
  result: { sources: LiveCitation[]; fetched_at: string };
}) {
  return (
    <section className={`${card} p-4`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint-tint text-mint">
          <Icon name={icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold">{title}</h3>
          {label ? <p className="text-xs font-medium text-amber">{label}</p> : null}
          <div className="mt-1 text-sm leading-relaxed text-ink-dim">{children}</div>
          <Sources result={result} />
        </div>
      </div>
    </section>
  );
}

function ok<T>(r: LiveResult<T> | undefined): r is Extract<LiveResult<T>, { ok: true }> {
  return r?.ok === true;
}

function placeLine(p: NearbyPlace) {
  return (
    <li key={`${p.kind}-${p.name}`}>
      <span className="font-medium text-ink">{p.name}</span>
      {p.address ? `, ${p.address}` : ""} · {p.distance_mi} mi
      {p.phone ? ` · ${p.phone}` : ""}
    </li>
  );
}

export default function LiveConditions({ lat, lng }: { lat: number; lng: number }) {
  const key = `${lat},${lng}`;
  const [state, setState] = useState<{ key: string; live: LiveBundle | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLive(lat, lng).then((live) => {
      if (!cancelled) setState({ key, live });
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, key]);

  const loading = !state || state.key !== key;
  if (loading) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading local conditions">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-navy-800" />
        ))}
      </div>
    );
  }

  const live = state.live;
  if (!live) return null;
  const { weather, air, flood, trees, places } = live;

  const today = ok(weather) ? weather.data.forecast[0] : undefined;
  const day0 = ok(weather) ? weather.data.daily[0] : undefined;
  const anyCard = [weather, air, flood, trees, places].some((r) => r.ok);
  if (!anyCard) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold">Right now near you</h2>

      {ok(weather) && weather.data.heat_alert ? (
        <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-heat/50 bg-heat/10 p-3.5 text-sm text-ink">
          <Icon name="alert" size={18} className="mt-px shrink-0 text-heat" />
          <span>
            <strong className="font-semibold">
              {weather.data.alerts[0]?.event ?? "Heat alert"} in effect (National Weather Service).
            </strong>{" "}
            <a href={HEAT_PAGE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Find cooling centers at boston.gov/heat
            </a>
            .
          </span>
        </p>
      ) : null}

      {ok(weather) && today ? (
        <LiveCard icon="sun" title="Weather today" label="Air temperature, not the ground heat score" result={weather}>
          <p>
            {today.name}: {today.temperature_f}°F, {today.short_forecast}
            {day0?.feels_like_high_f != null ? ` · Feels like up to ${Math.round(day0.feels_like_high_f)}°F` : ""}
            {weather.data.current_uv_index != null ? ` · UV ${Math.round(weather.data.current_uv_index)}` : ""}
          </p>
          {weather.data.hot_days_next_7 > 0 ? (
            <p>
              {weather.data.hot_days_next_7} day{weather.data.hot_days_next_7 === 1 ? "" : "s"} of 90°F or more in the
              next week.
            </p>
          ) : null}
        </LiveCard>
      ) : null}

      {ok(air) ? (
        <LiveCard icon="wind" title={`Air quality: ${air.data.category}`} label="Modeled estimate, not a monitor reading" result={air}>
          <p>
            US AQI {air.data.us_aqi}
            {air.data.main_pollutant ? ` · Main pollutant: ${air.data.main_pollutant}` : ""}
            {air.data.max_aqi_next_24h != null && air.data.max_category_next_24h
              ? ` · Worst in the next 24 hours: ${air.data.max_aqi_next_24h} (${air.data.max_category_next_24h})`
              : ""}
          </p>
        </LiveCard>
      ) : null}

      {ok(flood) ? (
        <LiveCard icon="waves" title="Flooding" result={flood}>
          {flood.data.fema_zone ? (
            <p>
              FEMA Zone {flood.data.fema_zone}
              {flood.data.fema_zone_description ? `: ${flood.data.fema_zone_description.toLowerCase()}` : ""} today.
              {flood.data.fema_high_risk ? " This is a high-risk flood zone." : ""}
            </p>
          ) : null}
          {flood.data.future.length > 0 ? (
            <p>
              {flood.data.first_flooded_at_in !== null
                ? `Could flood in a 1-in-100-year storm with ${flood.data.first_flooded_at_in} inches of sea level rise.`
                : "Not flooded in the future scenarios checked (up to 36 inches of sea level rise)."}
            </p>
          ) : null}
        </LiveCard>
      ) : null}

      {ok(trees) ? (
        <LiveCard icon="tree" title="Street trees nearby" label="City street trees only, not yard trees" result={trees}>
          <p>
            {trees.data.tree_count} City tree{trees.data.tree_count === 1 ? "" : "s"} within {trees.data.radius_m} m
            {` · ${trees.data.empty_planting_sites} empty planting spot${trees.data.empty_planting_sites === 1 ? "" : "s"}`}
            {trees.data.top_species[0] ? ` · Most common: ${trees.data.top_species[0].name}` : ""}
          </p>
        </LiveCard>
      ) : null}

      {ok(places) && (places.data.community_centers[0] || places.data.libraries[0] || places.data.pools[0]) ? (
        <LiveCard icon="home" title="Places to cool off" result={places}>
          <ul className="flex flex-col gap-1">
            {[
              ...places.data.community_centers.slice(0, 2),
              ...places.data.libraries.slice(0, 1),
              ...places.data.pools.slice(0, 1),
            ]
              // A BCYF pool often sits in a community center listed above. Show each address once.
              .filter((p, i, all) => !p.address || all.findIndex((q) => q.address === p.address) === i)
              .map(placeLine)}
          </ul>
          <p className="mt-1.5 text-xs">
            BCYF centers open as cooling centers during declared heat emergencies. Check{" "}
            <a href={HEAT_PAGE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              boston.gov/heat
            </a>
            .
          </p>
        </LiveCard>
      ) : null}
    </div>
  );
}
