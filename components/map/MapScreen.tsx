"use client";
// Screen 2: interactive climate map.
// Search bar, layer button, locate button, colored score grid, and a sheet for the selected place.
import { useEffect, useId, useState } from "react";
import MapView, { type MapMetric } from "@/components/MapView";
import MapSheet from "@/components/map/MapSheet";
import SampleDataBanner from "@/components/SampleDataBanner";
import Icon from "@/components/ui/Icon";
import { iconBtn } from "@/components/ui/classes";
import { useReport } from "@/hooks/useReport";
import { AddressError, geocodeAddress, loadGrid, type GridData } from "@/services/climateClient";
import { getDevicePosition, LocationError } from "@/services/geolocate";
import { splitAddress, withLocation, type LocationContext } from "@/services/locationContext";

interface Place {
  lat: number;
  lng: number;
  label: string;
}

export default function MapScreen({ initial }: { initial: LocationContext }) {
  const searchId = useId();
  const errorId = useId();
  const [place, setPlace] = useState<Place>({ lat: initial.lat, lng: initial.lng, label: initial.q });
  const [query, setQuery] = useState(initial.q);
  const [metric, setMetric] = useState<MapMetric>("heat");
  const [aerial, setAerial] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: report } = useReport(place.lat, place.lng);
  const { title, sub } = splitAddress(place.label);

  // Color the map with the same cells /api/score uses, so the colors match the score cards.
  const [gridData, setGridData] = useState<GridData | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadGrid().then((g) => {
      if (!cancelled) setGridData(g);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const gridIsSample = gridData?.isSample ?? true;

  function choose(next: Place) {
    setPlace(next);
    setQuery(next.label);
    setError(null);
    // Keep the URL in step so the tab bar carries this place to the other screens.
    window.history.replaceState(null, "", withLocation("/map", { lat: next.lat, lng: next.lng, q: next.label }));
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const loc = await geocodeAddress(query);
      choose({ lat: loc.lat, lng: loc.lng, label: loc.label });
    } catch (err) {
      setError(err instanceof AddressError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onLocate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const pos = await getDevicePosition();
      choose({ ...pos, label: "My location" });
    } catch (err) {
      setError(err instanceof LocationError ? err.message : "We couldn't get your location.");
    } finally {
      setBusy(false);
    }
  }

  const reportHref = withLocation("/report", { lat: place.lat, lng: place.lng, q: place.label });

  return (
    // Fills the space between the header and the tab bar. Negative margin cancels <main>'s bottom padding.
    <div className="-mb-24 flex h-[calc(100dvh-7.5rem)] min-h-[34rem] flex-col md:-mb-12 md:h-[calc(100dvh-4rem)]">
      <div className="shrink-0 px-3 py-2">
        <SampleDataBanner
          show={(report?.isSample ?? true) || gridIsSample}
          note="The colored squares are sample scores. The aerial photo is real."
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden border-t border-line">
        <MapView
          lat={place.lat}
          lng={place.lng}
          grid={gridData?.grid}
          metric={metric}
          aerial={aerial}
          selectedCellId={report?.cell?.cell_id ?? null}
          cellGeometry={report?.geometry ?? undefined}
          onSelectCell={(cell, center) =>
            choose({
              lat: center.lat,
              lng: center.lng,
              label: `${cell.neighborhood} block, Boston, MA`,
            })
          }
          className="absolute inset-0"
          ariaLabel="Climate map. Tap a colored square to pick a block."
        />

        <form
          onSubmit={onSearch}
          role="search"
          className="absolute inset-x-3 top-3 z-10 md:right-auto md:left-4 md:top-4 md:w-[26rem]"
        >
          <label htmlFor={searchId} className="sr-only">
            Search for an address
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-navy-900/90 py-1.5 pl-3.5 pr-1.5 backdrop-blur-xl focus-within:border-mint/60">
            <Icon name="search" size={19} className="shrink-0 text-ink-mute" />
            <input
              id={searchId}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="street-address"
              maxLength={200}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an address"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-mute focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setError(null);
                }}
                aria-label="Clear search"
                className="grid size-10 place-items-center rounded-xl text-ink-dim hover:bg-white/5"
              >
                <Icon name="close" size={18} />
              </button>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              aria-label="Search"
              className="grid size-10 place-items-center rounded-xl bg-mint text-navy-950 hover:bg-mint-600 disabled:opacity-60"
            >
              {busy ? (
                <span className="size-4 animate-spin rounded-full border-2 border-navy-950/30 border-t-navy-950" />
              ) : (
                <Icon name="arrowRight" size={18} />
              )}
            </button>
          </div>
          {error ? (
            <p
              id={errorId}
              role="alert"
              className="mt-2 rounded-xl border border-alert/40 bg-navy-900/95 px-3 py-2 text-sm text-[#ffb4aa]"
            >
              {error}
            </p>
          ) : null}
        </form>

        <div className="absolute right-3 top-[4.6rem] z-10 flex flex-col gap-2 md:left-4 md:right-auto md:top-[4.8rem]">
          <button
            type="button"
            onClick={() => setAerial((v) => !v)}
            aria-pressed={aerial}
            aria-label={aerial ? "Hide aerial photo" : "Show aerial photo"}
            className={`${iconBtn} ${aerial ? "text-mint" : ""}`}
          >
            <Icon name="layers" size={20} />
          </button>
          <button type="button" onClick={onLocate} disabled={busy} aria-label="Use my location" className={iconBtn}>
            <Icon name="locate" size={20} />
          </button>
        </div>

        <MapSheet
          title={title}
          sub={sub}
          report={report}
          metric={metric}
          onMetric={setMetric}
          reportHref={reportHref}
        />
      </div>
    </div>
  );
}
