"use client";
// MapLibre map with the MassGIS 2025 aerial basemap (NEXT_PUBLIC_BASEMAP_TILE_URL),
// a marker at the address, the score cell outline, and an optional colored score grid.
//
// Original props (lat, lng, cellGeometry) are unchanged. The rest are optional
// extras used by the map screen.
//
// Works offline: if aerial tiles can't load you still get the navy background and the grid.

import type { ExpressionSpecification, Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { loadMaplibre } from "@/components/map/loadMaplibre";
import type { GridCellSummary } from "@/lib/types";

/** Cells to color: GET /api/grid output (a full ScoreGrid also fits). */
export interface MapGrid {
  type: "FeatureCollection";
  features: GridCellSummary[];
}
export type MapCell = GridCellSummary["properties"];

function ringCenter(geometry: GridCellSummary["geometry"]): { lat: number; lng: number } | null {
  const ring = geometry.coordinates[0] ?? [];
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) {
    if (x === undefined || y === undefined) continue;
    w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
  }
  return Number.isFinite(w) && Number.isFinite(s) ? { lat: (s + n) / 2, lng: (w + e) / 2 } : null;
}

export type MapMetric = "heat" | "tree";

interface MapViewProps {
  lat: number;
  lng: number;
  /** Optional GeoJSON polygon of the score cell to outline */
  cellGeometry?: { type: "Polygon"; coordinates: number[][][] };
  /** Score cells to color on the map. */
  grid?: MapGrid;
  /** Which score colors the grid. */
  metric?: MapMetric;
  /** Show the aerial photo basemap under the grid. */
  aerial?: boolean;
  /** Highlighted cell. */
  selectedCellId?: string | null;
  /** Called when someone taps a grid cell. */
  onSelectCell?: (cell: MapCell, center: { lat: number; lng: number }) => void;
  className?: string;
  ariaLabel?: string;
}

// Same default as .env.example so the map works before anyone creates .env.local.
const DEFAULT_TILE_URL =
  "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Aerial_Imagery_2025/MapServer/tile/{z}/{y}/{x}";
const TILE_URL = process.env.NEXT_PUBLIC_BASEMAP_TILE_URL || DEFAULT_TILE_URL;
const ATTRIBUTION = process.env.NEXT_PUBLIC_BASEMAP_ATTRIBUTION || "Imagery: MassGIS 2025 Aerial Imagery";

const PROPERTY: Record<MapMetric, string> = { heat: "heat_score", tree: "tree_score" };

const STOPS: Record<MapMetric, (number | string)[]> = {
  heat: [0, "#2fbf71", 28, "#a8d24a", 50, "#f3b941", 75, "#f2763d", 100, "#e0402f"],
  tree: [0, "#14291f", 45, "#2b7a4b", 75, "#45d48b", 100, "#b7f5cf"],
};

function colorExpression(metric: MapMetric): ExpressionSpecification {
  const prop = PROPERTY[metric];
  return [
    "case",
    ["==", ["typeof", ["get", prop]], "number"],
    ["interpolate", ["linear"], ["get", prop], ...STOPS[metric]],
    "rgba(0,0,0,0)",
  ] as unknown as ExpressionSpecification;
}

const PIN_SVG =
  '<svg width="38" height="46" viewBox="0 0 38 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<ellipse cx="19" cy="42" rx="8" ry="3" fill="rgba(0,0,0,0.35)"/>' +
  '<path d="M19 2C10.7 2 4 8.6 4 16.8 4 27.5 19 41 19 41s15-13.5 15-24.2C34 8.6 27.3 2 19 2Z" fill="#1fc79a" stroke="#fff" stroke-width="2.4"/>' +
  '<circle cx="19" cy="16.5" r="5.5" fill="#fff"/></svg>';

export default function MapView({
  lat,
  lng,
  cellGeometry,
  grid,
  metric = "heat",
  aerial = true,
  selectedCellId = null,
  onSelectCell,
  className = "",
  ariaLabel = "Climate map of your block",
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<{ setLngLat: (l: [number, number]) => unknown } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Latest values for the one-time map setup and its event handlers.
  const latest = useRef({ lat, lng, grid, metric, aerial, selectedCellId, cellGeometry, onSelectCell });
  useEffect(() => {
    latest.current = { lat, lng, grid, metric, aerial, selectedCellId, cellGeometry, onSelectCell };
  });

  // ---- create the map once ----
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    (async () => {
      // maplibre-gl 6 has named exports only (no default export).
      // loadMaplibre also points MapLibre at its worker file (see components/map/loadMaplibre.ts).
      const maplibregl = await loadMaplibre();
      const el = containerRef.current;
      if (cancelled || !el) return;

      let map: MapLibreMap;
      try {
        const init = latest.current;
        const empty = { type: "FeatureCollection" as const, features: [] };
        // Everything is declared in the style itself, so the grid draws without waiting
        // for aerial tiles (which need network).
        map = new maplibregl.Map({
          container: el,
          style: {
            version: 8,
            sources: {
              aerial: {
                type: "raster",
                tiles: [TILE_URL],
                tileSize: 256,
                maxzoom: 19,
                attribution: ATTRIBUTION,
              },
              grid: { type: "geojson", data: init.grid ?? empty },
              cell: {
                type: "geojson",
                data: init.cellGeometry
                  ? { type: "Feature", geometry: init.cellGeometry, properties: {} }
                  : empty,
              },
            },
            layers: [
              { id: "bg", type: "background", paint: { "background-color": "#0a1822" } },
              {
                id: "aerial",
                type: "raster",
                source: "aerial",
                layout: { visibility: init.aerial ? "visible" : "none" },
                paint: { "raster-brightness-max": 0.92, "raster-saturation": -0.1 },
              },
              {
                id: "grid-fill",
                type: "fill",
                source: "grid",
                paint: {
                  "fill-color": colorExpression(init.metric),
                  "fill-opacity": init.aerial ? 0.55 : 0.88,
                },
              },
              {
                id: "grid-line",
                type: "line",
                source: "grid",
                paint: {
                  "line-color": "rgba(255,255,255,0.12)",
                  "line-width": 0.6,
                  // Hide cell outlines when zoomed out to the whole city, where they turn into a mesh.
                  "line-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 14.5, 1],
                },
              },
              {
                id: "selected-outline",
                type: "line",
                source: "grid",
                filter: ["==", ["get", "cell_id"], init.selectedCellId ?? ""],
                paint: { "line-color": "#ffffff", "line-width": 2.6 },
              },
              {
                id: "cell-outline",
                type: "line",
                source: "cell",
                paint: { "line-color": "#3ee6b4", "line-width": 2.4 },
              },
            ],
          },
          center: [init.lng, init.lat],
          zoom: 15.6,
          minZoom: 10,
          maxZoom: 19,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
        });
      } catch {
        // No WebGL, or the browser blocked it.
        if (!cancelled) setFailed(true);
        return;
      }
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();

      // Marker at the address.
      const pin = document.createElement("div");
      pin.innerHTML = PIN_SVG;
      pin.style.pointerEvents = "none";
      markerRef.current = new maplibregl.Marker({ element: pin, anchor: "bottom" })
        .setLngLat([latest.current.lng, latest.current.lat])
        .addTo(map);

      map.on("click", "grid-fill", (e) => {
        const id = e.features?.[0]?.properties?.cell_id as string | undefined;
        const feature = latest.current.grid?.features.find((f) => f.properties.cell_id === id);
        if (!feature) return;
        // /api/grid cells carry no bbox, so take the center from the polygon.
        const center = ringCenter(feature.geometry);
        if (center) latest.current.onSelectCell?.(feature.properties, center);
      });
      map.on("mouseenter", "grid-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "grid-fill", () => (map.getCanvas().style.cursor = ""));
      // A failed aerial tile (offline, blocked) must not break the map. Ignore it.
      map.on("error", () => {});

      // style.load fires once the style is parsed. It does not wait for tiles.
      if (map.isStyleLoaded()) setReady(true);
      else map.once("style.load", () => setReady(true));

      observer = new ResizeObserver(() => map.resize());
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

  // ---- keep the map in sync with props ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markerRef.current?.setLngLat([lng, lat]);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15.4), duration: reduce ? 0 : 900 });
  }, [lat, lng, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setPaintProperty("grid-fill", "fill-color", colorExpression(metric));
  }, [metric, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("aerial", "visibility", aerial ? "visible" : "none");
    map.setPaintProperty("grid-fill", "fill-opacity", aerial ? 0.55 : 0.88);
  }, [aerial, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter("selected-outline", ["==", ["get", "cell_id"], selectedCellId ?? ""]);
  }, [selectedCellId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !grid) return;
    (map.getSource("grid") as GeoJSONSource | undefined)?.setData(grid);
  }, [grid, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("cell") as GeoJSONSource | undefined)?.setData(
      cellGeometry
        ? { type: "Feature", geometry: cellGeometry, properties: {} }
        : { type: "FeatureCollection", features: [] },
    );
  }, [cellGeometry, ready]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-navy-900 p-6 text-center text-sm text-ink-dim ${className}`}
        role="img"
        aria-label={ariaLabel}
      >
        The interactive map needs WebGL, which isn&apos;t available in this browser. Position: {lat.toFixed(4)},{" "}
        {lng.toFixed(4)}.
      </div>
    );
  }

  return (
    <div className={`bg-navy-900 ${className}`} role="region" aria-label={ariaLabel}>
      {/* MapLibre's CSS forces position: relative on its container, which beats Tailwind's
          layered "absolute inset-0" and left the map 0 px tall. So MapLibre gets an inner div. */}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
