# WorkX — Audit & Planning Findings

Snapshot exported on **2026-10-02**. The plan horizon is the **week of 2026-09-28 → week of 2027-03-22** (26 weeks). Currency is INR.

All numbers come from [`demo-data/summary.json`](demo-data/summary.json) and the CSVs in [`demo-data/`](demo-data/). They are produced by `npm run export-demo` using the same code the app runs, so they match the screens exactly. The same content is in [`demo-data/WorkX_demo_data_and_findings.xlsx`](demo-data/WorkX_demo_data_and_findings.xlsx).

---

## Part 1 — Audit findings (bugs found and fixed)

The audit ran in three passes: a code read-through, a browser run through all 13 modules with real workflows, and a data export review.

| # | Severity | Area | Symptom | Root cause | Fix |
|---|---|---|---|---|---|
| 1 | Critical | Dependencies | App crashed on load ("Incompatible React versions") | `react` resolved to 19.3.0 while `react-dom` stayed at 19.2.0 | Pinned both to exactly 19.2.0 |
| 2 | Critical | SQL Lab | Every query failed, including `SELECT * FROM orders` ("table does not exist") | Tables were passed as a parameter object that alasql never maps to table names. The engine was also loaded from a CDN at runtime, so it broke offline. | Bundled alasql. Each run uses a fresh in-memory database with every workspace table registered. |
| 3 | High | Dashboard | Clicking a month on the trend chart did nothing | Recharts 3 no longer sends `activePayload` on chart click events | Index-based click helper (`clickedRow`) |
| 4 | High | Dashboard | "Jan" drill-down mixed records from different years | Drill filter used the month name, not `YYYY-MM` | Keyed by `YYYY-MM` everywhere |
| 5 | High | CSV import | One empty cell shifted every later value into the wrong column | Regex `[^,]+` skipped empty fields. Newlines inside quotes also broke rows. | RFC 4180 state-machine parser plus a serializer with round-trip tests |
| 6 | High | Data cleaning | "Fill with mean" overwrote real zeros. Export dropped `0` values. Health score counted `0` as missing. | Missing values were tested with `!val` | Explicit `isMissing()`; zero is a real value |
| 7 | High | Data cleaning | IDs such as `ORD-10000` and `FC-3` were profiled as numbers (−10000, −3) and could be overwritten by imputation | The number parser stripped letters but kept the hyphen | Strict parser: text containing letters is not numeric. It still handles ₹, commas, `%`, `(150)` and "Rs." |
| 8 | High | Capacity screen | Screen crashed ("ws.slice is not a function") | Numeric simulation `week` index overwrote the week-start date in table rows | Spread order fixed; formatter hardened |
| 9 | High | Budget | Seasonal temp hires cost ₹0 to hire, so cost was understated by ₹38 lakh on the demo plan | `weekCost` charged hiring cost only for permanent hires | Temp hires carry the same recruiting and training cost |
| 10 | Medium | Hiring model | Recommender hired permanent staff for a 4-week peak, leaving about 35% overstaffing afterwards | Single hiring bucket with no notion of peak vs base | Split permanent (sustained base) from temp (peak) hiring, with overtime first inside the lead time |
| 11 | Medium | Settings | "Backup" did nothing; "Factory Reset" deleted every user account | Button had no handler; reset used `localStorage.clear()` | JSON backup and restore; reset clears workspace keys only |
| 12 | Medium | Currency | All values silently multiplied by 84.5 | Hardcoded USD→INR rate inside the formatter | Currency setting (INR default) with no hidden conversion |
| 13 | Medium | Data Grid / Workboard | Grid could not edit; re-importing the same file did nothing; task board started empty with no delete | Unfinished features; file input value never reset | Inline edit, add/delete, search and sort; seeded, editable tasks |
| 14 | Medium | Auth / content | Personal name and email prefilled; passwordless login for one email; company-specific "About" text | Hardcoded defaults | Removed (login otherwise kept as-is, as requested) |
| 15 | Low | Build / tests | Only test imported a non-existent `./App`; unused imports; CRA placeholder title and metadata | Leftover scaffolding | 25 tests (planning maths plus app smoke test); clean `CI=true` build; real metadata |
| 16 | Low | Robustness | One failing screen blanked the whole app; corrupt local storage threw on load | No error boundary; unguarded `JSON.parse` | Per-module error boundary; safe storage helpers |

**Verification:** 25/25 Jest tests pass. `CI=true npm run build` compiles with zero warnings and ESLint is clean. A Playwright run visited all 13 modules plus the main workflows (import, edit, undo, SQL, drill-down, scenario, backup and restore, currency) with no console errors. At 390px mobile width there is no horizontal overflow.

---

## Part 2 — Planning findings from the demo plan

Demo scope: 4 plan lines across 3 sites.

| Line | Site | Type | Cost model |
|---|---|---|---|
| Customer Support · Voice | North Hub | Real-time | In-house |
| Customer Support · Chat | South Hub | Real-time | In-house |
| Partner Support · Email | North Hub | Deferred | In-house |
| Returns & Claims Ops | Vendor East | Deferred | Vendor, per unit |

### 2.1 Demand and peak
- Required FTE rises from **241.6** in week 1 to a peak of **396.8** (+64%). The top-4 demand weeks are **16 Nov, 23 Nov, 30 Nov and 14 Dec**: the festive season plus a planned +12% incremental sale event.
- Forecast accuracy is strong. *Trend × seasonal index* won the 26-week backtest on every line, with WAPE between **1.8% and 2.5%** ([`forecast_accuracy.csv`](demo-data/forecast_accuracy.csv)).

### 2.2 Headcount and hiring

| Line | Req FTE wk 1 | Peak req FTE | Perm hires | Temp hires | OT hrs | Status |
|---|---:|---:|---:|---:|---:|---|
| Customer Support · Voice | 89.6 | 145.7 | 25 | 75 | 0 | 8 wks >15% over |
| Customer Support · Chat | 60.0 | 99.8 | 19 | 50 | 98 | 3 wks on OT |
| Partner Support · Email | 35.2 | 56.4 | 7 | 27 | 0 | 7 wks >15% over |
| Returns & Claims Ops | 56.8 | 94.9 | 28 | 35 | 47 | 1 wk on OT |
| **Total** | **241.6** | **396.8** | **79** | **187** | **145** | |

- **The peak is 7 weeks away, which equals the hiring lead time** (3 weeks training plus 4 weeks nesting). Every seasonal class must therefore **start this week** to be productive by mid-November. That is 266 hires, most of them in week 1. It is the single biggest execution risk: recruiting and training-seat capacity have to be confirmed now.
- Supply is front-loaded. Nesting temps make lines **more than 15% overstaffed for 7–8 weeks**, before and right after the peak. This is the cost of a fixed 7-week ramp; shortening nesting or using shorter temp contracts reduces it.
- Overtime need is small (145 hrs, mostly Chat in weeks 1–3, inside the lead time).

### 2.3 Variable cost vs OP

| | Value |
|---|---|
| Plan variable cost (26 wks) | **₹15.91 Cr** |
| vs OP2 (mid-year refresh) | **+0.6%** (watch) |
| vs OP1 (annual plan) | **+5.1%** (over) |
| Cost per contact | **₹108.24** |

- October runs **+7.0% over OP1** and +1.2% over OP2, driven by ₹44.5 lakh of seasonal hiring cost in Sep–Oct. November comes in **under** OP2 (−1.2%) as volume peaks and cost per contact falls to ₹108 (Sep: ₹204) ([`budget_monthly.csv`](demo-data/budget_monthly.csv)).

### 2.4 Occupancy realism (Erlang C check)
At peak, the interval-level Erlang requirement implies **82.1% occupancy for Voice** (plan assumes 85%) and **79.0% for Chat** (plan 82%). The long-term plan therefore **understates real-time staffing by about 3.5–4%**. Lower the planning occupancy to roughly 82% (Voice) and 79% (Chat), or add an intraday buffer.

### 2.5 Scenario: +20% volume (stress test)

| Metric | Baseline | +20%, current hiring plan | +20%, re-planned |
|---|---:|---:|---:|
| Peak required FTE | 396.8 | 476.1 | 476.1 |
| Weeks short after max OT | 0 | **13** | 3 |
| Uncovered FTE-weeks | 0 | **56.4** | 23.9 |
| OT hours | 145 | **17,497** | 2,888 |
| Variable cost | ₹15.91 Cr | ₹17.39 Cr | ₹18.81 Cr |
| Hires (perm + temp) | 79 + 187 | 79 + 187 | 150 + 171 |

With today's hiring plan, a 20% volume miss leaves **13 weeks short** even after maximum overtime. Re-planning recovers most of it, but **3 weeks stay short because they fall inside the hiring lead time**. Contingency for those weeks has to be vendor overflow or cross-skilling, not hiring.

### 2.6 Operational KPIs (last 13 weeks of actuals)

| KPI | Value | Read |
|---|---:|---|
| Forecast WAPE / bias | 4.3% / +0.1% | Healthy |
| Service level vs target | 82.9% vs 85.7% | **Below target; only 44% of line-weeks met SL** |
| Occupancy | 87.7% | High: little headroom |
| HC plan adherence | 99.1% | On plan |
| Shrinkage vs plan | +0.7 pts | Slightly above plan |
| Cost vs plan | +1.0% | Slight overrun |

Headcount was delivered to plan and forecasts were accurate, yet SL still missed target in most line-weeks. The gap therefore comes from **planning assumptions** (occupancy too high, shrinkage under-planned), not from execution. This matches the Erlang check in 2.4.

### 2.7 Root causes and risks
- **Defect Pareto** (36 planning defects): unplanned shrinkage **33%**, forecast miss **28%**, AHT drift **19%**. These three account for **81%** of defects.
- **Highest open risks:** peak volume above forecast (score 15, Planning), hiring class delayed by recruiting backlog (12, Talent Acquisition), vendor attrition above 5%/month (12, Vendor Mgmt).

### 2.8 Recommended actions
1. **Start seasonal hiring classes this week** (187 temps plus 79 permanent). Confirm recruiting throughput and training seats with Talent Acquisition, because the peak sits exactly at the 7-week lead time.
2. **Lower planning occupancy** for real-time queues to the Erlang-implied 82% (Voice) and 79% (Chat), and **raise planned shrinkage about 1 pt**. This closes the SL gap seen in actuals.
3. **Pre-approve contingency for a +20% peak:** vendor overflow and cross-skilling for the 3 weeks that hiring cannot reach.
4. **Take the OP1 variance to Finance:** +5.1% vs OP1 (mostly Sep–Oct hiring cost); within 0.6% of OP2.
5. **Target the top two defect drivers** (shrinkage and forecast miss) with a weekly shrinkage review and an event-uplift sign-off step.

---

## Regenerating and reusing the data

```bash
npm run export-demo                                   # rewrites demo-data/*.csv and summary.json
python3 scripts/build_findings_workbook.py            # rebuilds the Excel workbook
```

The CSVs re-import directly into the app:
- `volume_history_daily.csv` → Demand Forecast → *Import history CSV*
- `actuals_weekly.csv` → Planning KPIs → *Import actuals*
- `op_targets.csv` → Budget & OP → *Import OP targets*
- `orders.csv` → Data Grid → *Import (replace)*

The demo data is anchored to the current week, so a later export shifts dates but keeps the same shape.
