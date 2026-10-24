# Tech stack and conventions

## Stack

- **Web app:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4. This Next.js version differs from older docs. Check `node_modules/next/dist/docs/` before using an unfamiliar API.
- **Map:** MapLibre GL (`maplibre-gl`), loaded with a dynamic import inside `useEffect` in a client component.
- **Basemap:** MassGIS 2025 aerial imagery tile service (ArcGIS Online), URL from `NEXT_PUBLIC_BASEMAP_TILE_URL`.
- **AI:** Claude through the Anthropic API (`@anthropic-ai/sdk`). Key in `ANTHROPIC_API_KEY`, model in `CLAUDE_MODEL` (default `claude-haiku-5-5`).
- **Validation:** zod 4.
- **Geocoding:** US Census geocoder, with Nominatim (OpenStreetMap) as fallback.
- **Data pipeline:** Python 3 in `pipeline/` (rasterio, numpy, geopandas, shapely, pyproj). Run once, offline, before the demo.
- **No database.** Static JSON and GeoJSON files in `data/`.

## Rules

- **All external calls are server-side**: geocoding, Claude, and any future solar API. Client components call our own `/api/*` routes only. Server modules start with `import "server-only"`.
- **Secrets stay server-side.** Only `NEXT_PUBLIC_*` variables reach the browser, and those must never be secrets. Never log API keys.
- Read env vars only through `lib/config.ts`.
- **TypeScript strict mode** with `noUncheckedIndexedAccess`. No `any`. Shared types live in `lib/types.ts`.
- **Pipeline outputs are the only source of scores.** The app never computes, adjusts, or estimates a score. If a cell is missing, the answer is "out of coverage" or "no data."
- Validate input at every API boundary with zod or explicit checks. Cap string lengths.
- Model output is untrusted. Validate it with zod, drop unknown program ids, reject invented facts (`lib/actionPlanSchema.ts`), and take links from program records, never from the model.
- If the AI call fails, return the rule-based plan (`lib/actionPlanRules.ts`). The demo must work with no API key.
- Keep dependencies minimal. Ask the team before adding a package, because lockfile changes cause merge conflicts.

## Commands

```bash
npm run dev            # http://localhost:3000
npm run build          # production build (must pass before merging)
npm run lint
npm run typecheck
npm run sample:data    # writes SAMPLE score files (pipeline/make_sample_data.py)
npm run validate:data  # checks data/scores (pipeline/validate_scores.py)
```

## Testing an API route by hand

```bash
curl "localhost:3000/api/geocode?q=50+Hudson+St+Boston"
curl "localhost:3000/api/score?lat=42.3498&lng=-71.0603"
curl -X POST localhost:3000/api/action-plan -H "Content-Type: application/json" \
  -d '{"cell_id":"<id>","tenure":"renter"}'
```

`SCORES_DIR` can point the app at a test grid, and `ALLOW_UNVERIFIED_PROGRAMS=true` shows unverified programs. Both are for local development only.
