"use client";
// Address input.
// Address -> geocodeAddress() (GET /api/geocode, demo fallback) -> router.push(/map?lat&lng&q)
//
// Visual layout follows the landing mock-up: one large input with a pin icon and a mint
// arrow button.

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import Icon from "@/components/ui/Icon";
import { AddressError, geocodeAddress, type ResolvedLocation } from "@/services/climateClient";
import { withLocation } from "@/services/locationContext";

type Busy = null | "search";

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

  return (
    <div className="flex flex-col gap-3.5">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          Boston address
        </label>
        <div className="group flex items-center gap-2 rounded-2xl border border-line-strong bg-navy-900/80 p-1.5 pl-4 shadow-[0_14px_40px_-22px_rgb(0_0_0/0.9)] backdrop-blur transition duration-200 hover:border-white/25 focus-within:border-mint/60 focus-within:shadow-[0_0_0_4px_rgb(62_230_180/0.12),0_14px_40px_-22px_rgb(0_0_0/0.9)]">
          <Icon name="pin" size={20} className="shrink-0 text-ink-mute transition-colors duration-200 group-focus-within:text-mint" />
          <input
            id={inputId}
            type="text"
            inputMode="search"
            autoComplete="street-address"
            enterKeyHint="search"
            placeholder="Enter a Boston address…"
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

      <p className="px-1 text-[11px] leading-snug text-ink-dim [text-shadow:0_1px_6px_rgb(6_15_22/0.95)] lg:px-0">
        Heat and green cover scores for neighborhoods across the City of Boston.
      </p>
    </div>
  );
}
