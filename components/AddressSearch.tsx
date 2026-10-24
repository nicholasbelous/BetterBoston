"use client";
// Address input + "Use my location" + demo address chips.
// Address -> geocodeAddress() (GET /api/geocode, demo fallback) -> router.push(/map?lat&lng&q)
// Location -> navigator.geolocation.getCurrentPosition -> same push, q="My location"
//
// Visual layout follows the landing mock-up: one large input with a pin icon and a mint
// arrow button, then a single quiet row of quick-start chips.

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import Icon from "@/components/ui/Icon";
import { DEMO_ADDRESSES } from "@/mocks/demoAddresses.mock";
import { AddressError, demoToLocation, geocodeAddress, type ResolvedLocation } from "@/services/climateClient";
import { getDevicePosition, LocationError } from "@/services/geolocate";
import { withLocation } from "@/services/locationContext";

type Busy = null | "search" | "locate";

const chip =
  "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-navy-900/70 px-3.5 text-[13px] font-medium text-ink-dim backdrop-blur transition duration-200 hover:border-mint/40 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint disabled:cursor-not-allowed disabled:opacity-60";

export default function AddressSearch() {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  function go(loc: ResolvedLocation) {
    router.push(withLocation("/map", { lat: loc.lat, lng: loc.lng, q: loc.label }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy("search");
    try {
      go(await geocodeAddress(query));
    } catch (err) {
      setError(err instanceof AddressError ? err.message : "Something went wrong. Please try again.");
      setBusy(null);
    }
  }

  async function onUseMyLocation() {
    if (busy) return;
    setError(null);
    setBusy("locate");
    try {
      const pos = await getDevicePosition();
      go({ ...pos, label: "My location", origin: "device" });
    } catch (err) {
      setError(err instanceof LocationError ? err.message : "We couldn't get your location.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          Massachusetts address
        </label>
        <div className="group flex items-center gap-2 rounded-2xl border border-line-strong bg-navy-900/80 p-1.5 pl-4 shadow-[0_14px_40px_-22px_rgb(0_0_0/0.9)] backdrop-blur transition duration-200 hover:border-white/25 focus-within:border-mint/60 focus-within:shadow-[0_0_0_4px_rgb(62_230_180/0.12),0_14px_40px_-22px_rgb(0_0_0/0.9)]">
          <Icon name="pin" size={20} className="shrink-0 text-ink-mute transition-colors duration-200 group-focus-within:text-mint" />
          <input
            id={inputId}
            type="text"
            inputMode="search"
            autoComplete="street-address"
            enterKeyHint="search"
            placeholder="Enter an address…"
            maxLength={200}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-mute focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy !== null}
            aria-label="Search this address"
            className="group/btn grid size-12 shrink-0 place-items-center rounded-xl bg-mint text-navy-950 shadow-[0_8px_24px_-10px_rgb(62_230_180/0.8)] transition duration-200 hover:bg-mint-600 active:scale-95 disabled:opacity-60"
          >
            {busy === "search" ? (
              <span className="size-4 animate-spin rounded-full border-2 border-navy-950/30 border-t-navy-950" />
            ) : (
              <Icon
                name="arrowRight"
                size={20}
                className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
              />
            )}
          </button>
        </div>
        {error ? (
          <p id={errorId} role="alert" className="px-1 text-sm text-[#ffb4aa]">
            {error}
          </p>
        ) : null}
      </form>

      {/* Quick start: one quiet row. Scrolls sideways on phones, wraps on large screens. */}
      <div className="-mx-5 lg:mx-0">
        <ul
          aria-label="Quick start"
          className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <li className="shrink-0">
            <button type="button" onClick={onUseMyLocation} disabled={busy !== null} className={chip}>
              <Icon name="locate" size={16} className="text-mint" />
              {busy === "locate" ? "Finding you…" : "Use my location"}
            </button>
          </li>
          {DEMO_ADDRESSES.map((a) => (
            <li key={a.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go(demoToLocation(a))}
                aria-label={`Try demo address ${a.label}, ${a.neighborhood}`}
                className={chip}
              >
                {a.label}
                <span className="hidden text-ink-mute xl:inline">{a.neighborhood}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 px-5 text-[11px] leading-snug text-ink-mute lg:px-0">
          Scores cover Chinatown, West Roxbury, and East Boston for now. Aerial photos work statewide.
        </p>
      </div>
    </div>
  );
}
