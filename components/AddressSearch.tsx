"use client";
// Address input + "Use my location" + demo address chips.
// Address -> geocodeAddress() (GET /api/geocode, demo fallback) -> router.push(/map?lat&lng&q)
// Location -> navigator.geolocation.getCurrentPosition -> same push, q="My location"

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import Icon from "@/components/ui/Icon";
import { btnGhost } from "@/components/ui/classes";
import { DEMO_ADDRESSES } from "@/mocks/demoAddresses.mock";
import { AddressError, demoToLocation, geocodeAddress, type ResolvedLocation } from "@/services/climateClient";
import { getDevicePosition, LocationError } from "@/services/geolocate";
import { withLocation } from "@/services/locationContext";

type Busy = null | "search" | "locate";

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
      setError(
        err instanceof AddressError ? err.message : "Something went wrong. Please try again.",
      );
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
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          Massachusetts address
        </label>
        <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-navy-800/80 p-1.5 pl-4 shadow-[0_10px_40px_-18px_rgb(0_0_0/0.8)] backdrop-blur focus-within:border-mint/60">
          <Icon name="pin" size={20} className="shrink-0 text-ink-mute" />
          <input
            id={inputId}
            type="text"
            inputMode="search"
            autoComplete="street-address"
            enterKeyHint="search"
            placeholder="Enter an address..."
            maxLength={200}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-mute focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy !== null}
            aria-label="Search this address"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-mint text-navy-950 transition hover:bg-mint-600 disabled:opacity-60"
          >
            {busy === "search" ? (
              <span className="size-4 animate-spin rounded-full border-2 border-navy-950/30 border-t-navy-950" />
            ) : (
              <Icon name="arrowRight" size={20} />
            )}
          </button>
        </div>
        {error ? (
          <p id={errorId} role="alert" className="px-1 text-sm text-[#ffb4aa]">
            {error}
          </p>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onUseMyLocation} disabled={busy !== null} className={btnGhost}>
          <Icon name="locate" size={18} />
          {busy === "locate" ? "Finding you..." : "Use my location"}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-mute">
          Try a demo address
        </p>
        <ul className="flex flex-wrap gap-2">
          {DEMO_ADDRESSES.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => go(demoToLocation(a))}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-navy-800/60 px-3.5 text-sm text-ink-dim transition hover:border-mint/40 hover:text-ink"
              >
                <Icon name="pin" size={14} className="text-mint" />
                {a.label} <span className="text-ink-mute">{a.neighborhood}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-mute">
          Demo addresses use sample data until live data is connected. Coverage is Boston demo areas only.
        </p>
      </div>
    </div>
  );
}
