"use client";
// MapLibre map with the MassGIS 2025 aerial basemap (NEXT_PUBLIC_BASEMAP_TILE_URL),
// a marker at the address, and the score cell outline.

interface MapViewProps {
  lat: number;
  lng: number;
  /** Optional GeoJSON polygon of the score cell to outline */
  cellGeometry?: { type: "Polygon"; coordinates: number[][][] };
}

export default function MapView({ lat, lng, cellGeometry }: MapViewProps) {
  // TODO (task 1.1):
  // - useRef for the container div; in useEffect, `const maplibregl = (await import("maplibre-gl")).default`
  //   (dynamic import keeps it out of the server bundle).
  // - style: { version: 8, sources: { aerial: { type: "raster",
  //     tiles: [process.env.NEXT_PUBLIC_BASEMAP_TILE_URL], tileSize: 256,
  //     attribution: process.env.NEXT_PUBLIC_BASEMAP_ATTRIBUTION } },
  //   layers: [{ id: "aerial", type: "raster", source: "aerial" }] }
  // - center [lng, lat], zoom 17. Add a Marker. If cellGeometry, add a line layer.
  // - Remove the map on unmount.
  void cellGeometry;
  return (
    <div
      className="w-full h-72 rounded-lg bg-gray-200 flex items-center justify-center text-sm text-gray-600"
      aria-label="Aerial map of your block"
    >
      Map placeholder ({lat.toFixed(4)}, {lng.toFixed(4)})
    </div>
  );
}
