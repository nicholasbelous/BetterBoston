# [PROJECT_NAME] — Climate report card for Massachusetts homes

A resident types their address and gets a climate report for their block: how hot it gets in summer,
how much tree cover it has, and a short action plan using real Massachusetts programs.

This is a hackathon starter. **It runs end to end today** with sample data. The real satellite and
aerial-imagery processing is stubbed out, with step-by-step notes on how to build it.

```
climate-report-card/
├── frontend/          React + TypeScript website (Vite). The screens from the design.
│   └── src/
│       ├── pages/         Home, Loading, Report (+ action plan), HeatDetail, OutOfCoverage, About
│       ├── components/    Header/Footer, score cards, gauge, scale bar, action card, icons
│       ├── api.ts         All calls to the backend
│       ├── types.ts       Data shapes (match backend/app/models.py)
│       └── styles.css     Colors, type and layout (design tokens at the top)
├── backend/           Python FastAPI server
│   ├── app/
│   │   ├── main.py        API routes
│   │   ├── models.py      Data shapes + score → "Low / Moderate / High / Very high"
│   │   ├── services/      geocode (address → block), report, plan (Claude + fallback)
│   │   ├── pipeline/      heat.py, trees.py  ← where the real Landsat / MassGIS work goes
│   │   └── data/          sample_blocks.json, programs.json (the ONLY programs the plan can use)
│   └── tests/
└── .vscode/           Tasks to install and run everything, debugger setup, recommended extensions
```

---

## 1. Install these once

| Tool | Version | Check it with |
|---|---|---|
| [VS Code](https://code.visualstudio.com/) | any recent | — |
| [Node.js](https://nodejs.org/) (LTS) | 18 or newer | `node -v` |
| [Python](https://www.python.org/downloads/) | 3.10 or newer | `python3 --version` (Windows: `py --version`) |
| [Git](https://git-scm.com/) | any | `git --version` |

## 2. Open the project in VS Code

1. Unzip the folder somewhere easy, like `Documents/climate-report-card`.
2. In VS Code: **File → Open Folder…** and pick the `climate-report-card` folder (the one with this README).
3. VS Code will ask to install the **recommended extensions** (Python, Pylance, Prettier…). Click **Install**.

## 3. Install the project's packages

Open the built-in terminal: **Terminal → New Terminal**.

**Backend (Python):**

```bash
cd backend
python3 -m venv .venv              # Windows: py -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # Windows: copy .env.example .env
cd ..
```

**Frontend (Node):**

```bash
cd frontend
npm install
cd ..
```

> Shortcut: **Terminal → Run Task… → "Setup: backend"**, then **"Setup: frontend"**.

If VS Code asks which Python interpreter to use, pick the one inside `backend/.venv`.

## 4. Run it

**Easiest:** **Terminal → Run Task… → "Start app (backend + frontend)"**. That opens two terminals.

**Or by hand, in two terminals:**

```bash
# Terminal 1 – backend
cd backend
source .venv/bin/activate          # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 – frontend
cd frontend
npm run dev
```

Then open **http://localhost:5173**. Try the **Hudson St, Chinatown** example.

- API docs (try every endpoint in the browser): **http://localhost:8000/docs**
- Both servers reload automatically when you save a file.

## 5. Turn on the AI action plan (optional)

Without a key the plan still works. It uses a simple rule-based version so the demo never breaks.
To have Claude write the summary and the "why this matters for your block" lines:

1. Get an API key at <https://console.anthropic.com>.
2. Put it in `backend/.env`: `ANTHROPIC_API_KEY=sk-ant-...`
3. Restart the backend. `http://localhost:8000/api/health` should show `"ai_plan_enabled": true`.

Claude can **only pick from `backend/app/data/programs.json`**. Titles, buttons and links always come
from that file, so the AI can't invent a program or a link. If Claude's reply is malformed, the app
falls back to the rule-based plan automatically.

⚠️ Never commit `.env`. It's already in `.gitignore`.

---

## How it fits together

```
Browser (React, :5173)                          Backend (FastAPI, :8000)
───────────────────────                         ─────────────────────────────
Home ─ address ─────────► GET  /api/lookup?address=…   → which block? (or out of coverage)
Loading step 1 ─────────┘
Loading step 2 ─────────► GET  /api/report/{block_id}  → heat + tree scores, reasons
Loading step 3 ─────────► POST /api/plan {block_id, role} → summary + 4 actions
Report page  ◄── uses the cached results; Renter/Owner toggle calls /api/plan again
```

In development, Vite forwards every `/api/...` call to port 8000 (see `frontend/vite.config.ts`),
so the frontend never needs the backend's address.

## Where to change things

| I want to… | Edit |
|---|---|
| Change copy on a page | `frontend/src/pages/*.tsx` |
| Change colors / fonts / spacing | the variables at the top of `frontend/src/styles.css` |
| Change the sample numbers (82, 18, 9°F…) | `backend/app/data/sample_blocks.json` |
| Add, remove or fix a program in the plan | `backend/app/data/programs.json` |
| Change how the AI writes the plan | `SYSTEM_PROMPT` in `backend/app/services/plan.py` |
| Change what counts as Low / Moderate / High | `score_to_label` in `backend/app/models.py` |
| Replace the gray "Aerial photo" box with a real map | `frontend/src/components/Aerial.tsx` |
| Plug in real heat / tree data | `backend/app/pipeline/heat.py` and `trees.py` (instructions inside) |

## Before the demo: checklist

- [ ] Replace every `[PROJECT_NAME]` (search the whole project: **Ctrl/Cmd + Shift + F**).
- [ ] Check each program in `programs.json`: put the exact program page in `url` and set `"verified": true`.
      Right now most links go to the agency's home page, and two have no link yet.
- [ ] Fill in the cool-roof savings tag (`"Est. savings: [$ per year]"`) or change it to "Rebate available".
- [ ] The scores for any address other than the two samples are **fake but stable** demo numbers
      (`demo_data: true` in the API). Say so in the video, or build the pipeline.
- [ ] `USE_CENSUS_GEOCODER=true` uses the free US Census geocoder for real addresses. If the venue Wi-Fi
      is bad, set it to `false`; the sample addresses always work offline.

## Building the real data (the "pipeline")

Do this ahead of time, not when a user searches. The idea:
1. **Heat:** Landsat 8/9 surface temperature (July 2025 afternoon) → average per block → rank blocks 0–100.
2. **Trees:** MassGIS 2025 aerial imagery → share of green pixels per block → rank 0–100.
3. Save one table keyed by block ID. Have `services/report.py` read from it instead of `pipeline.estimate_for_block`.

Each file in `backend/app/pipeline/` has the detailed steps and the Python libraries to add.

## Splitting the work (for a hackathon team)

- **Frontend person:** polish pages, add a real map in `Aerial.tsx`, record the demo.
- **Backend / AI person:** tune the plan prompt, verify programs, add reverse geocoding for "Use my location".
- **Data person:** build `pipeline/heat.py` and `pipeline/trees.py` with Jupyter, export the block table.

## Run the tests

```bash
cd backend && source .venv/bin/activate && python -m pytest -q
```

Or use the **Testing** panel (beaker icon) in VS Code.

## Troubleshooting

- **"Something went wrong" on the loading screen:** the backend isn't running. Start it (step 4).
- **`uvicorn: command not found`:** you didn't activate the virtual environment. Run `source .venv/bin/activate` (Windows: `.venv\Scripts\activate`).
- **Windows says scripts are disabled when activating:** run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once in PowerShell.
- **Port already in use:** another copy is running. Close the old terminal, or change the port.
- **VS Code shows red squiggles on Python imports:** **Ctrl/Cmd + Shift + P → "Python: Select Interpreter"** → choose `backend/.venv`.
- **Windows:** in `.vscode/settings.json`, change the interpreter path to `${workspaceFolder}/backend/.venv/Scripts/python.exe`.

## Putting it online (after the hackathon)

- Frontend: `npm run build` makes `frontend/dist/`. Host it on Netlify, Vercel or GitHub Pages.
- Backend: deploy `backend/` to a Python host (Render, Railway, Fly.io). Start command:
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `ANTHROPIC_API_KEY` and `CORS_ORIGINS` there.
- Point the frontend at the backend's URL (for example, a rewrite rule for `/api/*` on your host).
