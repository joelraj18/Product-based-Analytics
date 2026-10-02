# WorkX — Workforce Planning & Analytics Suite

WorkX is a browser-based workbench for **long-term workforce / capacity planning analysts** at product companies. It covers the full planning loop:

```
volume history ─► demand forecast ─► required FTE ─► headcount & hiring plan ─► variable cost vs OP
                         ▲                                    │
                 events / uplifts                 intraday (Erlang C) · scenarios · risks
                                                              │
                         actuals ─► planning KPIs ─► defects / RCA ─► weekly review
```

Everything runs client-side. Data lives in the browser's local storage, can be imported and exported as CSV, and can be backed up or restored as JSON. A realistic demo dataset loads on first sign-in, so you can explore every screen right away.

## Modules

### Workforce planning
| Module | What it does |
|---|---|
| **Planning Hub** | One-page readiness view across every program and site: required vs effective FTE, permanent and temp hiring, variable cost vs OP2, open risks and forecast accuracy. Includes auto-generated action items and one-click export of the weekly headcount plan. |
| **Demand Forecast** | Weekly volume forecast per plan line, using Holt-Winters, a linear trend × seasonal index, seasonal naive or a moving average. *Auto* chooses the method with the lowest WAPE in a backtest over the planning horizon. Shows WAPE, MAPE and bias by method. Event uplifts (sales, launches, campaigns) can apply to all lines or to one. History imports from CSV. |
| **Capacity & Headcount** | The core FTE model: `required FTE = volume × AHT ÷ 3600 ÷ occupancy ÷ (paid hrs × (1 − shrinkage) × (1 − NPT))`. Supply rolls forward week by week with attrition, training, a nesting/ramp curve, permanent hires, seasonal temps and capped overtime. Hiring is recommended automatically: permanent classes cover the sustained base, temps cover the peaks, and inside the hiring lead time overtime is used first. You can override any week's hires and lock the plan. Plan lines (programs and queues) can be added or deleted. |
| **Intraday Staffing** | Splits a plan week into a 7 × 24 hourly requirement heatmap: Erlang C for real-time queues, workload ÷ occupancy for deferred work. Flags when the long-term occupancy assumption is unrealistic, and compares planned on-queue supply with interval-level need. Includes an Erlang C calculator (agents, SL, ASA, occupancy). |
| **Budget & OP** | Monthly variable cost of the plan, broken into in-house labour, vendor per-unit billing, overtime and hiring. Compared with editable or imported **OP1/OP2** targets, with variance status and cost per contact. |
| **Scenarios & Risks** | Volume, AHT, shrinkage and attrition levers stress-test the *current* hiring plan, showing shortfall weeks, overtime, cost and the hires needed if you re-plan. Also includes a cost-sensitivity tornado, a peak-readiness table and checklist, and a risk register with a likelihood × impact heat map. |
| **Planning KPIs** | Weekly or monthly roll-ups of forecast WAPE and bias, service level vs target, occupancy, AHT and shrinkage drift, HC plan adherence, cost variance and cost per contact. Also includes a defect log with a root-cause Pareto, an actuals import (upsert), and a **one-click weekly review summary** in Markdown, copied to the clipboard. |

### Analytics
| Module | What it does |
|---|---|
| **Sales Dashboard** | KPIs, month-over-month trend, status mix and category breakdown for any order-level dataset. Columns are mapped in the UI, and every tile, bar and month drills down to records you can export. |
| **SQL Lab** | Full SQL (JOINs, sub-queries, aggregates, CASE) over every workspace table plus **your uploaded files**. It has three tabs: **Query** (with history and CSV export), **Schema** (columns, types and how tables join) and **Practice** (12 graded exercises with hints and answer checking). |
| **Data Grid** | Inline cell editing, search, sort, add and delete rows or columns, and CSV import (replace or append) and export. |
| **Data Cleaning** | Column profiler, plus mean/median/zero imputation (zero is treated as a real value), mode fill, IQR outlier capping, date normalisation, de-duplication, case standardisation, rename and drop. Every operation can be undone. |

### Workspace
**Workboard** is a kanban for planning deliverables, with owner, due date, priority and overdue flags. **Settings** holds currency (INR by default; USD, EUR, GBP and others available, with no hidden conversion), plan horizon, forecast method, backup and restore, and reset to demo data.

## Uploading your own data

Open **Upload Data** in the app and drop a **CSV, TSV, TXT, JSON or Excel (.xlsx)** file, up to 20 MB. For Excel files, choose the sheet; title rows above the header are detected automatically. Files never leave your browser.

- **Any file → SQL table.** Save any upload as a named table. You can then query it in SQL Lab, join it with the built-in tables, and see its columns on the Schema tab. Uploaded tables are stored in the browser's IndexedDB, survive reloads, and are included in Settings → Download backup.
- **Planning features need exact column names.** Headers are matched ignoring case and spaces, so `Line ID` = `line_id`. Extra columns are allowed. If a required column is missing, the upload is blocked and the message names it.

| Dataset | Required columns | Optional columns | Feeds |
|---|---|---|---|
| Volume history (daily) | `date, line_id, volume` | `aht` | Demand Forecast → every planning screen |
| Plan lines & assumptions | `id, name` | `site_id, type, aht, npt, shrinkage, occupancy, hours_per_week, attrition_monthly, training_weeks, ramp_weeks, ramp_start, temp_contract_weeks, current_hc, max_ot_pct, buffer_pct, cost_model, cost_per_hour, cost_per_unit, ot_multiplier, hire_cost, sl_target, sl_seconds` | Capacity & Headcount |
| Weekly actuals | `week_start, line_id, actual_volume` | `forecast_volume, planned_aht, actual_aht, planned_hc, actual_hc, planned_shrinkage, actual_shrinkage, sl_target, sl_actual, occupancy, cost_planned, cost_actual` | Planning KPIs |
| OP budget targets | `month (YYYY-MM), op1_cost, op2_cost` | `op1_volume, op2_volume` | Budget & OP |
| Planned events | `name, start, end, uplift_pct` | `line_id` | Demand Forecast |
| Planning defects | `date, line_id, category` | `impact_fte, status` | Planning KPIs |
| Risk register | `title, likelihood, impact` | `line_id, owner, mitigation, status` | Scenarios & Risks |
| Orders / sales | `date, amount` | `id, status, region, category, units` and any others | Sales Dashboard, Data Grid, Data Cleaning |

The **Column reference** on the Upload page explains each column in plain English and has a downloadable template for every dataset. The files in [`demo-data/`](demo-data/) are ready-made examples.

## New to planning or SQL?

Start with the **Start Here** page in the app. It has a 5-step tour, a diagram of how the screens connect, and a searchable glossary (FTE, AHT, shrinkage, occupancy, Erlang C, WAPE, OP1/OP2 and more). Every screen also has a **"What am I looking at?"** box, and key numbers have **ⓘ** tips. **SQL Lab → Practice** has 12 graded exercises, from `SELECT *` to sub-queries and `CASE`.

## Demo data & findings

- [`FINDINGS.md`](FINDINGS.md): audit findings (bugs fixed, with root causes) and planning insights from the demo plan.
- [`demo-data/`](demo-data/): the demo dataset and plan outputs as CSVs (re-importable into the app), `summary.json`, and an Excel workbook (`WorkX_demo_data_and_findings.xlsx`) with a Findings sheet plus one sheet per dataset.
- Regenerate with `npm run export-demo` then `python3 scripts/build_findings_workbook.py` (needs `openpyxl`).

## Live site

**https://joelraj18.github.io/Product-based-Analytics/**

Every push to `main` builds and deploys the site through `.github/workflows/deploy.yml`. In the repository settings, Pages → Source must be set to **GitHub Actions**. `package.json` uses `"homepage": "."` so asset paths are relative and the site works under any repository name.

## Getting started

```bash
npm install
npm start          # http://localhost:3000
npm test           # unit tests (planning maths, CSV, Erlang C) + app smoke test
npm run build      # production build
npm run deploy     # optional: publish build/ to a gh-pages branch instead
```

Create a local account on the sign-in screen. Accounts are stored only in this browser and are a convenience profile, not a security boundary.

## Project layout

```
src/
  App.jsx                   app shell, navigation, auth gate
  state/workspace.jsx       shared workspace state (persisted) + derived plan
  lib/                      pure, unit-tested logic
    forecast.js  erlang.js  capacity.js  budget.js  planEngine.js
    kpis.js  stats.js  csv.js  dates.js  format.js  storage.js  theme.js
  data/seed.js              deterministic demo dataset
  components/               shared UI (cards, tables, inputs, toasts, error boundary)
  modules/                  one file per screen
```
