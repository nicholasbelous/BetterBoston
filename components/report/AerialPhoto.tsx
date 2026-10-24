"use client";
// The real aerial photo of the address and its block: MassGIS 2025 statewide imagery,
// the same tiles as the map screen. It works for any Massachusetts address, including
// ones outside the scored neighborhoods.
//
// It is a fixed picture, not a pannable map, so one-finger scrolling still moves the
// page on a phone. "Block" fits the score cell; "Close-up" zooms in on the home.
// If the photo service has no picture for this spot (outside Massachusetts, or
// offline), nothing is shown instead of an empty frame.

import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { loadMaplibre } from "@/components/map/loadMaplibre";
import type { ScoreCellFeature } from "@/lib/types";

type CellGeometry = ScoreCellFeature["geometry"];
type View = "block" | "home";
type Bounds = [[number, number], [number, number]];

// Same tile service as components/MapView.tsx.
const DEFAULT_TILE_URL =
  "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Aerial_Imagery_2025/MapServer/tile/{z}/{y}/{x}";
const TILE_URL = process.env.NEXT_PUBLIC_BASEMAP_TILE_URL || DEFAULT_TILE_URL;
const SOURCE_PAGE = "https://www.mass.gov/info-details/massgis-data-2025-aerial-imagery";

/** Rough Massachusetts box, same as lib/live/http.ts. The tile check below handles the edges. */
const MA_BOUNDS = { minLat: 41.2, maxLat: 42.9, minLng: -73.6, maxLng: -69.85 };

export function inMassachusettsBox(lat: number, lng: number): boolean {
  return lat >= MA_BOUNDS.minLat && lat <= MA_BOUNDS.maxLat && lng >= MA_BOUNDS.minLng && lng <= MA_BOUNDS.maxLng;
}

const BLOCK_ZOOM = 17.6; // about 100 m across a phone-width photo; used when there is no score cell
const HOME_ZOOM = 18.8; // the home and its neighbors, close to the photos' 15 cm detail (more just blurs)
const FIT = { padding: 24, maxZoom: 18.6 };

const VIEWS: { id: View; label: string }[] = [
  { id: "block", label: "Block" },
  { id: "home", label: "Close-up" },
];

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";

// Same pin as the map screen.
const PIN_SVG =
  '<svg width="38" height="46" viewBox="0 0 38 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<ellipse cx="19" cy="42" rx="8" ry="3" fill="rgba(0,0,0,0.35)"/>' +
  '<path d="M19 2C10.7 2 4 8.6 4 16.8 4 27.5 19 41 19 41s15-13.5 15-24.2C34 8.6 27.3 2 19 2Z" fill="#1fc79a" stroke="#fff" stroke-width="2.4"/>' +
  '<circle cx="19" cy="16.5" r="5.5" fill="#fff"/></svg>';

/** URL of the photo tile that contains a point (Web Mercator XYZ). */
function tileUrlAt(lat: number, lng: number, z: number): string {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return TILE_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

function cellBounds(geometry: CellGeometry | null): Bounds | null {
  const ring = geometry?.coordinates[0];
  if (!ring) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [x, y] of ring) {
    if (x === undefined || y === undefined) continue;
    w = Math.min(w, x);
    e = Math.max(e, x);
    s = Math.min(s, y);
    n = Math.max(n, y);
  }
  return Number.isFinite(w) && Number.isFinite(s) ? [[w, s], [e, n]] : null;
}

function cellData(geometry: CellGeometry | null) {
  return geometry
    ? { type: "Feature" as const, geometry, properties: {} }
    : { type: "FeatureCollection" as const, features: [] };
}

function applyView(
  map: MapLibreMap,
  view: View,
  lat: number,
  lng: number,
  geometry: CellGeometry | null,
  animate: boolean,
) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = animate && !reduce ? 800 : 0;
  const bounds = view === "block" ? cellBounds(geometry) : null;
  if (bounds) map.fitBounds(bounds, { ...FIT, duration });
  else map.easeTo({ center: [lng, lat], zoom: view === "home" ? HOME_ZOOM : BLOCK_ZOOM, duration });
}

interface PhotoMapProps {
  lat: number;
  lng: number;
  geometry: CellGeometry | null;
  view: View;
  label: string;
}

function PhotoMap({ lat, lng, geometry, view, label }: PhotoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Latest values for the one-time setup and the resize handler.
  const latest = useRef({ lat, lng, geometry, view });
  useEffect(() => {
    latest.current = { lat, lng, geometry, view };
  });

  // ---- create the map once ----
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    (async () => {
      const maplibregl = await loadMaplibre();
      const el = containerRef.current;
      if (cancelled || !el) return;

      const init = latest.current;
      const bounds = init.view === "block" ? cellBounds(init.geometry) : null;
      let map: MapLibreMap;
      try {
        map = new maplibregl.Map({
          container: el,
          style: {
            version: 8,
            sources: {
              aerial: {
                type: "raster",
                tiles: [TILE_URL],
                // Smaller tiles load the next zoom level's photos, so the picture stays sharp on phone screens.
                tileSize: window.devicePixelRatio > 1.5 ? 128 : 256,
                maxzoom: 20,
              },
              cell: { type: "geojson", data: cellData(init.geometry) },
            },
            // No background layer: the loading shimmer behind the canvas shows until tiles arrive.
            layers: [
              { id: "aerial", type: "raster", source: "aerial" },
              {
                id: "cell-halo",
                type: "line",
                source: "cell",
                paint: { "line-color": "rgba(4,12,18,0.55)", "line-width": 6 },
              },
              {
                id: "cell-outline",
                type: "line",
                source: "cell",
                paint: { "line-color": "#3ee6b4", "line-width": 2.5 },
              },
            ],
          },
          center: [init.lng, init.lat],
          zoom: init.view === "home" ? HOME_ZOOM : BLOCK_ZOOM,
          ...(bounds ? { bounds, fitBoundsOptions: FIT } : {}),
          interactive: false,
          // The caption under the photo credits MassGIS.
          attributionControl: false,
        });
      } catch {
        // No WebGL, or the browser blocked it.
        if (!cancelled) setFailed(true);
        return;
      }
      mapRef.current = map;

      const pin = document.createElement("div");
      pin.innerHTML = PIN_SVG;
      pin.style.pointerEvents = "none";
      markerRef.current = new maplibregl.Marker({ element: pin, anchor: "bottom" })
        .setLngLat([init.lng, init.lat])
        .addTo(map);

      // A failed tile must not break the page. Ignore it.
      map.on("error", () => {});

      if (map.isStyleLoaded()) setReady(true);
      else map.once("style.load", () => setReady(true));

      // Keep the block framed when the column changes size.
      observer = new ResizeObserver(() => {
        map.resize();
        const now = latest.current;
        applyView(map, now.view, now.lat, now.lng, now.geometry, false);
      });
      observer.observe(el);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      setReady(false);
    };
  }, []);

  // ---- follow the address, the score cell, and the zoom choice ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markerRef.current?.setLngLat([lng, lat]);
    (map.getSource("cell") as GeoJSONSource | undefined)?.setData(cellData(geometry));
    applyView(map, view, lat, lng, geometry, true);
  }, [lat, lng, geometry, view, ready]);

  if (failed) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-navy-900 p-6 text-center text-sm text-ink-dim">
        This browser can&apos;t show the aerial photo because WebGL is turned off.
      </div>
    );
  }

  // MapLibre forces position: relative on its container, so it gets an inner div
  // (see the note in components/MapView.tsx).
  return (
    <div className="absolute inset-0" role="img" aria-label={label}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

interface AerialPhotoProps {
  lat: number;
  lng: number;
  /** Score cell to outline. Null while loading or outside the scored area. */
  geometry: CellGeometry | null;
  /** Cell width in meters, for the caption. */
  cellSizeM: number | null;
  /** Short address for the screen reader label, e.g. "50 Hudson St". */
  place: string;
}

export default function AerialPhoto({ lat, lng, geometry, cellSizeM, place }: AerialPhotoProps) {
  const [view, setView] = useState<View>("block");
  const key = `${lat},${lng}`;
  const [probe, setProbe] = useState<{ key: string; ok: boolean } | null>(null);

  // Ask for the one photo tile under the address. The service only covers
  // Massachusetts, so a missing tile means there is no photo to show here.
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setProbe({ key, ok: true });
    };
    img.onerror = () => {
      if (!cancelled) setProbe({ key, ok: false });
    };
    img.src = tileUrlAt(lat, lng, 18);
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [lat, lng, key]);

  if (probe && probe.key === key && !probe.ok) return null;

  const feet = cellSizeM ? Math.round((cellSizeM * 3.28084) / 10) * 10 : null;
  const outline = geometry
    ? ` The outlined square is the area your scores describe${cellSizeM ? `, about ${cellSizeM} m (${feet} ft) across` : ""}.`
    : "";

  return (
    <figure className="overflow-hidden rounded-3xl border border-line bg-navy-900 shadow-[0_30px_80px_-35px_rgb(0_0_0/0.9)]">
      <div className="relative aspect-[4/3] w-full">
        <div className="absolute inset-0 animate-pulse bg-navy-800" aria-hidden="true" />
        <PhotoMap
          lat={lat}
          lng={lng}
          geometry={geometry}
          view={view}
          label={`Aerial photo of ${place} and the blocks around it, taken in spring 2025`}
        />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-navy-950/75 px-2.5 py-1 text-[11px] font-medium text-ink backdrop-blur">
          Aerial photo · Spring 2025
        </span>
      </div>

      <figcaption className="flex flex-col gap-1.5 border-t border-line px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-base font-semibold">Your block from above</p>
          <div role="group" aria-label="Photo zoom" className="flex shrink-0 rounded-xl border border-line-strong p-0.5">
            {VIEWS.map((v) => {
              const on = view === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setView(v.id)}
                  className={`min-h-11 rounded-[10px] px-3.5 text-sm font-medium transition ${
                    on ? "bg-mint text-navy-950" : "text-ink-dim hover:text-ink"
                  } ${FOCUS}`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-sm leading-relaxed text-ink-dim">
          Taken from a plane in spring 2025, before most trees had leaves.{outline}
        </p>
        <p className="text-xs text-ink-mute">
          Source:{" "}
          <a
            href={SOURCE_PAGE}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline decoration-line-strong underline-offset-2 hover:text-ink ${FOCUS}`}
          >
            MassGIS 2025 aerial imagery
          </a>
          , flown March 18 to April 23, 2025.
        </p>
      </figcaption>
    </figure>
  );
}
