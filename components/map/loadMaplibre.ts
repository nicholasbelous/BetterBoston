// Loads MapLibre in the browser and tells it where its worker file is.
//
// MapLibre finds its worker with new URL(`./${name}`, import.meta.url). Turbopack
// resolves that template to the wrong file (the main library), so every map failed
// with "Worker failed to load" and drew no photo, grid, or outline. The static
// new URL() below makes Turbopack copy the real worker file and hand us its URL.

type MapLibre = typeof import("maplibre-gl");

let loading: Promise<MapLibre> | null = null;

export function loadMaplibre(): Promise<MapLibre> {
  loading ??= import("maplibre-gl")
    .then((maplibregl) => {
      maplibregl.setWorkerUrl(
        new URL("../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
      );
      return maplibregl;
    })
    .catch((err: unknown) => {
      // Let the next map try again (for example after a network blip).
      loading = null;
      throw err;
    });
  return loading;
}
