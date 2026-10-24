# Project structure

```
app/                     Next.js App Router (Person 1 owns pages; Person 3 owns app/api/)
  page.tsx               Home: address search
  report/page.tsx        Report: map, score cards, action plan (one plan for everyone)
  about/page.tsx         Data sources, methods, limitations
  api/geocode/route.ts   GET  ?q=        -> LocationResult
  api/score/route.ts     GET  ?lat&lng   -> ScoreLookupResponse
  api/grid/route.ts      GET             -> GridResponse (all cells, for map colors)
  api/live/route.ts      GET  ?lat&lng   -> LiveBundle (every live source)
  api/live/[source]/route.ts GET ?lat&lng -> LiveResult for one source
  api/action-plan/route.ts POST {cell_id, tenure: renter|owner|everyone} -> ActionPlan
components/              UI components (Person 1)
lib/                     Server logic + shared types (Person 3; score types owned by Person 2)
  types.ts               Shared types. The contract between everyone
  config.ts              The only place that reads env vars
  geocoder.ts            Census + Nominatim
  scores.ts              Loads the grid, point-in-polygon lookup
  programs.ts            Loads + validates data/programs, tenure filter
  claude.ts              Anthropic API client (forced tool call -> JSON)
  actionPlanPrompt.ts    System + user prompt
  actionPlanSchema.ts    Validates model output, rejects invented facts
  actionPlanRules.ts     Rule-based fallback plan
  live/                  Live data sources (one file each) + http/cache helpers + registry (index.ts)
    context.ts           Live facts for the action plan prompt
data/
  scores/                Pipeline output (Person 2 only): demo_grid.geojson + demo_grid.meta.json
  programs/              Curated program JSON (Person 3). The ONLY programs the AI may cite
  live/                  Prebuilt live context (climate_boston.json from npm run build:climate)
scripts/                 Node helper scripts (check-programs, build-climate-context)
pipeline/                Python data pipeline (Person 2)
  raw/                   Downloaded imagery (gitignored)
  work/                  Intermediate rasters (gitignored)
public/                  Static assets
Initial-Kiro-Design/     Old FastAPI + Vite prototype. Reference only; excluded from lint and tsc
.kiro/                   Steering, specs, hooks
```

## Where new things go

- New page: `app/<name>/page.tsx`. New API route: `app/api/<name>/route.ts`.
- Reusable UI: `components/`. Server-only logic: `lib/`, starting with `import "server-only"`.
- New shared type: `lib/types.ts`. Announce it to the team first.
- New program: add it to the matching file in `data/programs/` with a unique lowercase-dash `id`. Keep `last_verified: null` until a person has checked the official page.
- Never commit raw imagery, rasters, `.env.local`, or anything in `pipeline/raw/` or `pipeline/work/`.

## Ownership (avoids merge conflicts)

| Person | Owns |
|---|---|
| 1 Frontend | `app/` pages, `components/`, `app/globals.css`, `public/` |
| 2 Pipeline | `pipeline/`, `data/scores/`, score types in `lib/types.ts` |
| 3 Backend + AI | `app/api/`, `lib/`, `data/programs/`, `data/live/`, `scripts/`, `.env.example`, `.kiro/` |
