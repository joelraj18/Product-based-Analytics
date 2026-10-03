# WorkX: Interview Guide

How to present WorkX in a data analyst interview at a product company: what changed, how each feature works, the logic behind it, and the questions you are likely to get.

> The demo data is anchored to the current week, so the exact numbers below will shift a little when you open the app on a different day. The shape of the results stays the same.

---

## 1. The 60-second pitch

> "WorkX is a browser-based analytics and planning suite for a product company. It covers two jobs.
> **Product analytics:** what drives revenue, where orders leak, whether customers come back, who the best customers are, and whether an experiment worked.
> **Workforce planning:** forecasting contact volume, turning it into headcount and cost, and tracking it against budget.
> Everything runs client-side in React. The maths lives in small, pure JavaScript modules covered by about 250 unit tests. Users can upload their own CSV or Excel files and query them with SQL or Excel-style formulas. I built the statistics myself (z-test, Welch t-test, sample size, Erlang C, Holt-Winters) so I can explain every number on screen."

**Three things to emphasise:**
1. **Metric definitions are explicit.** There's a KPI dictionary, a North Star, guardrails, and a metric tree that multiplies back exactly.
2. **Results are honest.**
   - Partial months are never compared with full ones.
   - In-flight orders are excluded from the funnel.
   - Sample ratio mismatch is checked before any A/B result is shown.
   - Anomaly baselines never include the point being tested.
3. **Everything is tested and reproducible.** The demo data is deterministic, and every exercise and formula has a test.

---

## 2. Architecture (if asked "how is it built?")

| Layer | What | Why |
|---|---|---|
| UI | React 19, Tailwind, Recharts | Fast to build; charts are declarative |
| Logic | `src/lib/**`: pure functions, no React | Easy to unit test, reusable from UI and scripts |
| Data | Seeded demo data, plus browser storage (localStorage for the workspace, IndexedDB for uploads) | No server needed; data never leaves the browser |
| SQL | alasql (in-browser SQL engine) | Real SQL with JOINs, CTEs and window functions on any table |
| Excel | Formula engine written for this project (parser, evaluator, 115 functions, dynamic arrays) | HyperFormula is GPL-licensed, so I wrote a small one |
| Tests | Jest + Testing Library, a prose style test, and Playwright checks | About 250 tests; the build is warning-free |

**Design choice to mention:** the product analytics screens read the **same orders table** as the Sales Dashboard, through a column mapping. Any uploaded orders file with a date, amount, status and customer column works without code changes.

---

## 3. What changed in this round

### 3.1 UI: Apple-style beige theme
- **Warm neutrals and Apple blue.** Tailwind's `slate` palette was remapped to warm greys; `blue` is now Apple's `#0071e3`; and a `beige` palette was sampled from the natural titanium phone.
  - **Why centrally:** about 360 class names change look at once, with no risk of missing a screen.
- **Shell:**
  - light frosted beige sidebar, where the active item is a white pill
  - translucent top bar
  - a large page title with a grey tagline (like "Shop iPhone" / "Take your pick")
- **Components:**
  - 18px-radius cards with soft shadows
  - pill buttons
  - underline tabs (like "All Models · Ease of Switching")
  - larger KPI figures
  - sentence-case form labels
- **Charts:** the first series is Apple blue. The palette was re-validated for colour-blind separation (all checks pass).

### 3.2 Data: an industry-scale order sample with customers
- **Size and span:** 12,009 orders from **1 January 2024 to 31 December 2026**, placed by about 3,500 customers. It's a made-up but realistic e-commerce sample, deterministic so it is identical on every load.
- **How daily volume is generated:** `orders per day = base × 1.27^years × month season × weekday × sale lift × noise`
  - **Growth:** 27% a year. Revenue goes ₹73L (2024) → ₹1.0Cr (2025) → ₹1.45Cr (2026).
  - **Seasonality:** a January–February dip, and a festive peak in October–November (about 1.4×).
  - **Weekday rhythm:** busiest on weekends (Saturday 1.18×).
  - **Sale events:** about 1.5–2.3× volume, with prices about 18% lower.
  - **Mix shift:** Electronics and the South region grow faster, so the mix changes over time.
  - **Statuses:** orders in the last days are still in flight (Pending or Shipped); older orders show a realistic small backlog. Apparel returns more often, and sale days bring more cancellations.
- **Customers:** walking forward in time, about 30% of orders acquire a new customer. The rest go to a returning customer, picked from a random handful weighted by `loyalty × e^(−days since last order / 90)`. That gives loyal repeat buyers *and* churners: 53% repeat, month-1 retention ≈ 25%.
- **Older browsers:** a browser that still holds the original 400-order demo gets the new sample automatically. Orders a user uploaded or edited are never replaced.

### 3.3 New screen: Product Analytics
Six tabs, explained in section 4: Metric tree, Funnel, Cohorts & retention, RFM & CLV, A/B testing, Anomalies.

### 3.4 Refinements to existing screens
- **Sales Dashboard, month comparison.** The latest month is usually incomplete, and comparing it with a full month showed false drops (e.g. −45%). The dashboard now compares **month to date vs the same days of last month**, and the label says so.
- **Sales Dashboard, anomaly alerts.** A new strip shows weekly value against its expected band, with Spike/Drop pills and a link to the full analysis.
- **Glossary.** Ten new terms: AOV, North Star, cohort, retention, RFM, CLV, p-value, MDE, SRM, z-score. They appear as ⓘ tips.
- **Excel Lab.** The orders sheet now has column `I customer_id`. One exercise moved its input cell from `I2` to `K2`.

### 3.5 Latest round: data scale, A/B charts, schema popover
- **Order sample** from 2024 to December 2026 at scale (section 3.2). The Sales Dashboard now shows three years of growth, seasonality and sale spikes.
- **A/B testing charts:**
  - "Likely range of each conversion rate": two bell curves, one per arm. The less they overlap, the stronger the evidence.
  - A labelled confidence-interval chart for the difference, with a "No difference" line at zero. It's green when significant and grey when not. The continuous-metric test gets the same chart.
- **Schema reference:** the button now sits outside the SQL editor. The diagram opens in a layer above the whole page, sized to the screen, so it's never cut off.
- **Start Here banner:** a deeper sand than the page, espresso text and cream buttons, with no blue.
- **Performance fix the bigger data exposed:** alasql re-runs a scalar subquery like `(SELECT AVG(amount) FROM orders)` once per outer row. On 12,000 orders that took about 35 seconds. SQL Lab now runs any subquery that doesn't depend on the outer query once and substitutes the value: 35s → under 0.5s, same answer (tested). Correlated subqueries still run per row, so the correlated exercise now uses the small `inventory` table, and its hint explains why.
- **Analytics fixes:** frequency bins in RFM; CLV based on repeat orders over exposure; anomaly weeks exclude a partial last week.

### 3.6 Audit round (after the redesign)
A full pass over every screen at desktop and phone width (390px), plus stress tests: an empty orders table, an upload with no customer or status column, and impossible A/B inputs. There were no crashes, console errors or sideways overflow. Fixes made:

| Area | Problem | Fix |
|---|---|---|
| Status mapping | "Out for delivery" and "Undelivered" were counted as **delivered**, because the text contains "deliver" | Check transit and "undelivered" first (tested) |
| CLV | A one-order customer from last week got a CLV many times the average (pace = 1 order ÷ 1 week) | Shrink each customer's pace toward the average (tested) |
| A/B planner | A baseline × lift above 100% produced `NaN` users | Validate that both rates stay between 0 and 100%, and say so on screen |
| Welch t-test | Zero standard deviation in both arms gave `df = NaN` | Handle the no-spread case explicitly |
| SRM check | A planned split of 0% or 100% divided by zero | Guarded |
| Anomalies | A jump from a flat history (e.g. all zeros, then 500) was **not** flagged, because sd = 0 gave z = 0 | Treat any change from a flat baseline as unusual (z = ±∞) |
| Empty states | Metric tree, funnel (window too strict) and RFM had no message for "no data" | Clear empty states |
| Data safety | "Load demo orders" silently replaced an uploaded orders table | Renamed to "Replace with demo orders" and it now asks for confirmation |
| Customer picker | With no customer column, the picker displayed "date" as if selected | Shows "None" |
| UI | Duplicate page titles (shell title + section title), a dark navy hero on the beige theme, centred pages misaligned with their titles on wide screens, the Excel sheet opening scrolled sideways | Titles that repeat the page name are hidden from view (screen readers still get them); beige hero; left-aligned widths; the sheet opens at column A |

### 3.7 Earlier rounds (for "what else did you build?")
- Full audit and fixes: React version crash, SQL engine, CSV parser, zero-as-missing bugs, hiring cost understated by ₹38 lakh, and more. See `FINDINGS.md`.
- Upload center (CSV/Excel), schemas with exact column names, Start Here guide, and help tips.
- **SQL Lab:**
  - column previews
  - a visual schema diagram on hover
  - **100 graded exercises**, Beginner → Analyst/Executive
- **Excel Lab:**
  - a live sheet with real formulas and dynamic arrays
  - a pivot builder
  - 66 graded exercises
  - 32 VBA / Power Query / DAX lessons
  - a downloadable practice workbook

---

## 4. Feature deep dives

Each feature below covers the business question, how it works, the logic, its limits, and a 30-second demo.

### 4.1 Metric tree and KPI dictionary
**Business question:** "Revenue moved. Why?"

**How it works:**
```
net revenue = active customers × orders per customer × AOV × keep rate
keep rate   = net revenue ÷ gross revenue   (share not lost to cancels/returns)
```
This is an **identity**: the four drivers multiply back to net revenue exactly, and a test checks this.

**Attributing the change (log decomposition):**
- Because the drivers multiply, `ln(NR₁/NR₀) = Σ ln(driverᵢ₁/driverᵢ₀)`.
- Each driver gets `ln(ratioᵢ) ÷ ln(total ratio)` of the change. The parts add up to the total exactly, with no leftover "interaction" term.
- **Demo example (Dec vs Nov 2026):** net revenue −₹51K (−3.3%). Fewer active customers −₹137K and lower frequency −₹36K, partly offset by a better keep rate +₹68K and higher AOV +₹53K.
- **Story:** "After the festive peak, fewer customers came back in December. The ones who did spent more per order and returned less, which cushioned the drop."

**Uses the last complete month,** so a half-finished month never looks like a collapse.

**KPI dictionary:** each metric has one definition, a formula, a role (North Star / Driver / Input / Guardrail) and a limit. Guardrails (cancel rate ≤ 12%, return rate ≤ 25%) show a status pill.

**Why it matters:** in interviews, "how would you define X?" is often the real question. A dictionary shows you think about consistency across teams.

**Limits:** monthly grain only; the attribution is descriptive, not causal.

### 4.2 Funnel
**Business question:** "Where do we lose orders?"

**Steps:** Placed → Not cancelled → Shipped → Delivered → Kept (not returned). Each step keeps only the orders that reached it, so counts never increase (tested).

**Maturity window (the key refinement):**
- An order placed yesterday is "Pending" because it hasn't had time to ship, not because it failed.
- By default, orders younger than 14 days are excluded, so in-flight orders don't look like drop-off. You can change the window.

**Funnel by segment:** step conversion by region, category or fulfilment centre. Cells more than 5 points below the overall rate turn red.

**Demo:** 385 orders → 89% not cancelled → 83% of those shipped → 71% delivered → **74% kept**. The biggest leak is shipped → delivered.

**Interview angle:** "If the delivered step dropped, I'd segment by fulfilment centre and carrier first, check whether data latency (late status updates) explains it, then look at recent operational changes."

### 4.3 Cohorts and retention
**Business question:** "Do customers come back, and is that getting better?"

**How it works:**
- A customer's cohort is the month of their **first** order.
- For each cohort and each month offset k, compute the share of the cohort with an order in month k.
- Cancelled orders don't count as activity.

**Retention curve:** the size-weighted average across cohorts **old enough** to have reached month k. Young cohorts would otherwise drag later months down.

**Demo:**
- M1 25%, M2 20%, M3 17%, M6 12%: steep early drop, then a loyal core that keeps buying
- repeat purchase rate 53%
- 3.2 orders per customer over three years

**Revenue view:** revenue per original cohort member by month. This is the building block for cohort-based LTV.

**Why cohorts rather than overall retention:** fast growth in new users can hide falling retention in the overall number. Cohorts separate the two.

**Limits:** monthly grain; "active" means placed an order. A product with a usage signal would use logins or sessions instead.

### 4.4 RFM segmentation and CLV
**Business question:** "Who are our best customers, and who is slipping away?"

**R, F, M:**
- Recency = days since last order. Frequency = number of orders. Monetary = net spend.
- **Recency and Monetary** are scored 1–5 by **quintile**, using the average rank so ties share a score. Recency is inverted: fewer days scores 5.
- **Frequency uses fixed bins:** 1, 2, 3, 4–5 and 6+ orders. Almost half of customers order once, so quintiles would put them all in the same tied rank, and the "New" segment could never appear.

**Segments, from R and F:**

| Segment | Rule | Action |
|---|---|---|
| Champions | R 4–5, F 4–5 | Reward, referrals |
| Loyal | R 3, F 4–5 | Upsell |
| Potential loyalists | R 4–5, F 2–3 | Bundles, membership |
| New | R 4–5, F 1 | Second-order nudge |
| At risk | R 1–2, F 3–5 | Win-back now |
| Needs attention | R 3, F 1–3 | Reminders |
| Hibernating | R 2, F 1–2 | Cheap reactivation |
| Lost | R 1, F 1–2 | Don't overspend |

**CLV (simple, explainable):**
```
CLV = AOV × repeat orders per year × gross margin × expected lifespan (years)
repeat orders per year = Σ (orders − 1) ÷ Σ years each customer has been with us
```
- **Why repeat orders over exposure:** counting each customer's first order would make every brand-new customer look like a heavy buyer. Dividing by the whole three-year span instead of each customer's own tenure would understate recent customers. Demo: about 1.7 repeat orders a year and CLV ≈ ₹3,800 at 30% margin over 3 years.
- Margin and lifespan are editable.
- Each customer's CLV uses their own AOV and their own repeat pace, **shrunk toward the average** with six months of "prior" history: `pace = (orders − 1 + avg rate × 0.5) / (tenure in years + 0.5)`. A customer who just made a first order gets the average pace, not zero and not fifty a year. This is the same idea as Bayesian smoothing or a credibility weight.

**Pareto:** the top 20% of customers bring about **63%** of net revenue. Champions alone (448 customers, 13%) bring 36%.

**Limits and better models to mention:**
- **BG/NBD + Gamma-Gamma** (probabilistic "buy till you die"): handles churn uncertainty.
- **Cohort-based LTV curves.**
- **Discounting** future cash flows.

### 4.5 A/B testing
**Business question:** "Did the change work, and can we trust it?"

**Conversion test (two-proportion z-test):**
```
p̂ = (x_A + x_B) / (n_A + n_B)                       pooled rate (assumes H₀: no difference)
SE_pooled = √(p̂(1−p̂)(1/n_A + 1/n_B))
z = (p_B − p_A) / SE_pooled,   p-value = 2(1 − Φ(|z|))
95% CI for the difference uses the unpooled SE: √(p_A(1−p_A)/n_A + p_B(1−p_B)/n_B)
```
- **Example:** 10,000/1,000 vs 10,000/1,100 gives z = 2.31, **p = 0.021**, +10% relative uplift, and a CI that excludes 0. The result is significant at 5%.
- **Why pooled for the test and unpooled for the CI:** the test assumes no difference, so both arms share one rate; the CI describes the actual difference.

**Continuous metrics (Welch's t-test):** for revenue per user, where variances differ between arms.
- `t = (x̄_B − x̄_A)/√(s²_A/n_A + s²_B/n_B)`, with Welch–Satterthwaite degrees of freedom.
- The t distribution is computed with the regularised incomplete beta function.

**Sample size (before launch):**
```
n per arm = [z_{1−α/2}·√(2p̄(1−p̄)) + z_{1−β}·√(p₁(1−p₁)+p₂(1−p₂))]² / (p₂−p₁)²
```
- 10% baseline, +10% relative MDE, α = 5%, power 80% gives **14,751 per arm** (matches standard calculators; tested).
- Also shows how many days that takes at your traffic. Run whole weeks to cover weekday effects.

**SRM check (sample ratio mismatch):**
- A chi-square test of the observed split against the planned split.
- If p < 0.001, the result is **blocked** with a warning, because broken assignment or logging invalidates everything.

**Checklist shown in the app:**
- no peeking or early stopping
- guardrail metrics
- multiple-testing correction
- practical vs statistical significance

**Implementation note:** the normal CDF uses Abramowitz–Stegun and the inverse uses Acklam's approximation. Both are tested against known values (Φ⁻¹(0.975) = 1.95996).

### 4.6 Anomaly detection
**Business question:** "Is this week unusual, or just noise?"

**How it works (trailing z-score):**
- For each point, take the mean and standard deviation of the **previous** N points, never including the point itself. Otherwise a spike inflates its own baseline and hides.
- `z = (value − mean)/sd`, flagged when |z| ≥ 2.5 (adjustable: 2, 2.5, 3).
- The shaded band on the chart is `mean ± threshold × sd`.

**Metrics:**
- weekly net revenue
- weekly orders
- daily contact volume per support line, with a window of at least 14 days so weekday patterns are covered
- **Empty weeks are filled with 0,** so a week with no orders shows up as a drop instead of disappearing.

- **The last week is left out when it's incomplete,** for the same reason as partial months.

**Demo:** it flags the planted sale weeks on its own: early October festive sales (z ≈ 7.7 in 2025, 6.6 in 2026), late November, and the July mid-year sale. A good talking point: "the detector rediscovered the promo calendar, so I'd feed known events in as covariates to avoid alerting on planned spikes."

**Limits and upgrades to mention:**
- seasonality-aware baselines (same weekday last N weeks, or STL decomposition)
- robust statistics (median and MAD) when history already contains outliers
- forecast-residual alerts, e.g. Prophet or Holt-Winters intervals

---

## 5. Workforce planning engine (the other half of the project)

| Piece | Logic |
|---|---|
| **Forecast** | Four methods: Holt-Winters (additive), linear trend × seasonal index, seasonal naive, moving average. *Auto* picks the lowest **WAPE** in a backtest whose length matches the planning horizon. Event uplifts multiply the weeks they overlap. |
| **Required FTE** | `volume × AHT ÷ 3600 ÷ occupancy ÷ (paid hrs × (1 − shrinkage) × (1 − NPT))` |
| **Supply** | Weekly roll-forward: attrition (monthly rate converted to weekly with `1 − (1 − m)^(12/52)`), training weeks, a ramp curve for new hires, temps who leave after their contract, and capped overtime. |
| **Hiring** | Permanent classes cover the **sustained** requirement (10-week rolling minimum). Temps cover peaks. Inside the hiring lead time, overtime is used first, because a class started now would still be in training when the peak passes. |
| **Intraday** | **Erlang C** for real-time queues: the smallest agent count that meets the SL target within the occupancy cap. Workload ÷ occupancy for deferred work. Flags when the long-term occupancy assumption is unrealistic. |
| **Budget** | Monthly variable cost (in-house labour, vendor per-unit, OT premium, hiring cost) vs OP1/OP2, with variance and cost per contact. |
| **KPIs** | WAPE, bias, SL attainment, occupancy, AHT and shrinkage drift, HC adherence, cost variance, defect Pareto. |

**Headline finding from the demo** (see `FINDINGS.md`): headcount was delivered to plan and the forecast was accurate (WAPE 4.3%), yet SL missed target in 56% of line-weeks. The gap comes from **planning assumptions** (occupancy too high, shrinkage under-planned), and the Erlang check confirms it.

---

## 6. SQL and Excel labs (skills evidence)
- **SQL Lab:**
  - 100 auto-graded exercises: 25 each at Beginner, Intermediate, Advanced and Analyst/Executive
  - covers JOINs, CTEs, window functions (`ROW_NUMBER`), running totals, conditional aggregation, YoY/MoM growth, WAPE, Pareto
  - grading compares result **values**, ignoring column aliases
- **Excel Lab:**
  - **engine:** written for this project. Includes a tokenizer, a recursive-descent parser with Excel precedence (`-2^2 = 4`), dynamic-array spill with `#SPILL!`, `#CIRC!` cycle detection, and 115 functions (XLOOKUP, SUMIFS with wildcards, FILTER/SORT/UNIQUE, LET, TEXT, EOMONTH, …)
  - pivot builder with the matching SUMIFS formula
  - 32 lessons on VBA, Power Query (M) and Power Pivot (DAX)

---

## 7. Likely interview questions, with answers

1. **"Why a two-proportion z-test and not a t-test?"**
   Conversion is binary, so its variance is p(1−p). With large samples the z-test is the standard choice. For continuous metrics like revenue per user I use Welch's t-test, because the variances differ.
2. **"What is a p-value?"**
   If there were truly no difference, it's the probability of seeing a gap at least this large. It is *not* the probability that the variant is better.
3. **"What is SRM and why check it first?"**
   Sample ratio mismatch means the arms don't match the planned split, for example 52/48 on a 50/50 test. It points to assignment or logging bugs, so no metric result can be trusted until it's fixed.
4. **"How do you choose the sample size?"**
   From the baseline rate, the smallest effect worth detecting (MDE), α and power. Halving the MDE needs about four times the users. Fix the sample size before launch and don't stop early.
5. **"What if you check results every day and stop when p < 0.05?"**
   That's peeking, and it inflates false positives. Fix the duration in advance, or use sequential testing (e.g. alpha spending or always-valid p-values).
6. **"How do you define an active customer?"**
   Here it's a customer with at least one non-cancelled order in the period. In a usage product it would be a meaningful action, not just a login. The key is to write the definition down: the KPI dictionary.
7. **"Revenue dropped 10%. How do you investigate?"**
   1. Check the data first: a partial period, pipeline delays, definition changes.
   2. Decompose: customers × frequency × AOV × keep rate.
   3. Segment the driver that moved (region, category, new vs returning).
   4. Check external events and releases.
   5. Quantify each piece and recommend.
8. **"Why is month-to-date compared with the same days of last month?"**
   A partial month always looks like a drop against a full month. Like-for-like windows remove that artefact.
9. **"What is a cohort analysis and when do you need it?"**
   Group users by start period and track them over time. Overall retention mixes old and new users, so growth can hide decay. Cohorts separate the two.
10. **"How would you improve the CLV estimate?"**
    Use probabilistic models (BG/NBD for purchase frequency, Gamma-Gamma for value), cohort revenue curves, a contribution margin rather than a flat margin, and discounting.
11. **"What's RFM good for, and what are its limits?"**
    It's quick, explainable segmentation that maps to actions. Limits: quintiles are relative, so scores shift as the base changes; heavy ties (most customers ordering once) break quintiles, which is why frequency uses fixed bins here; it ignores product mix and channel; and it isn't predictive by itself.
12. **"How does your anomaly detection avoid false alarms?"**
    The baseline excludes the current point. The threshold is adjustable. Daily data uses at least 14 days so weekly seasonality is covered. Next step: seasonal baselines or median/MAD.
13. **"What's a North Star metric, and why net revenue?"**
    The one metric that best reflects value delivered. Net revenue (after cancellations and returns) rewards orders customers actually keep, not just checkout clicks. Guardrails stop optimising it at the expense of experience.
14. **"What's a guardrail metric?"**
    A metric that must not get worse while you optimise another, e.g. cancel rate, return rate or latency.
15. **"Funnel conversion dropped at the delivered step. What next?"**
    Check whether it's real: status-update latency, or a maturity issue. Then segment by fulfilment centre, carrier and region, and compare against operational changes.
16. **"Explain WAPE vs MAPE."**
    WAPE = Σ|error| / Σ actual. It is volume-weighted and stable when some actuals are small. MAPE averages percentage errors and blows up near zero.
17. **"How does the forecast pick a method?"**
    A backtest on held-out recent weeks, with a holdout as long as the planning horizon (capped at 26). It picks the lowest WAPE, so the choice is judged on the look-ahead the plan needs.
18. **"Explain the FTE formula."**
    Workload hours = volume × AHT. Divide by occupancy (agents can't be busy 100% of the time), then by the productive hours one FTE delivers after shrinkage and non-productive time.
19. **"What does Erlang C assume?"**
    Random (Poisson) arrivals, exponential handle times, no abandonment, and infinite queue patience. It's conservative where callers abandon. Erlang A handles abandonment.
20. **"Why permanent hires for the base and temps for peaks?"**
    Hiring permanently for a 4-week peak leaves you overstaffed afterwards. The sustained (rolling minimum) requirement is the safe permanent level.
21. **"How do you make sure your numbers are right?"**
    Pure functions with unit tests: identities (the drivers multiply back), known textbook values (z, sample size, Φ⁻¹), monotonic funnels, and a cohort example built by hand. Plus browser tests for the UI.
22. **"How would you scale this to real company data?"**
    Move the transforms into a warehouse (SQL/dbt models for orders, customers and cohorts), keep the metric definitions in a semantic layer, schedule refreshes, and point the UI at an API. The pure logic modules port almost directly.
23. **"Simpson's paradox: have you seen it here?"**
    A segment can show better conversion in every region yet worse overall if the mix shifts. That's why the funnel-by-segment view and mix-aware decomposition matter.
24. **"Correlation vs causation in the driver chart?"**
    The decomposition is accounting, not causation. It says *which* driver moved, not *why*. Causal claims need experiments or quasi-experiments (difference-in-differences, synthetic control).
25. **"What would you build next?"**
    See section 8.

---

## 8. Not built yet: good "next steps" to discuss
- **Attribution:** marketing channel contribution (last-touch vs data-driven).
- **Causal impact** for launches without an A/B test (synthetic control, difference-in-differences).
- **Forecasting with external drivers** (price, promotions, holidays) using regression or gradient boosting.
- **CUPED variance reduction** for A/B tests, which cuts the sample size needed using pre-period data.
- **Sequential testing** with always-valid p-values, so results can be monitored safely.
- **Probabilistic CLV** (BG/NBD + Gamma-Gamma) and churn prediction.
- **Warehouse version:** dbt models plus a semantic layer, so the KPI dictionary becomes the single source of truth.

---

## 9. 5-minute live demo script
1. **Sales Dashboard:** KPI tiles compare month to date with the same days last month. Point at the anomaly strip and its spike week.
2. **Product Analytics → Metric tree:** "Net revenue barely moved, but AOV fell sharply; fewer returns and more customers offset it." Show the KPI dictionary and guardrails.
3. **Funnel:** explain the maturity window, then switch the segment to `fulfillment_center`.
4. **Cohorts:** M1 ≈ 25%. Explain why young cohorts are excluded from later months of the average curve.
5. **RFM & CLV:** Champions (13% of customers) bring 36% of revenue. Click *At risk* to list customers for a win-back campaign.
6. **A/B testing:**
   1. Enter 10,000/1,000 vs 10,000/1,100: p = 0.021, significant.
   2. Change control users to 10,600: the SRM warning blocks the result.
   3. Show the sample size planner.
7. **SQL Lab:** hover *Schema reference*, then solve one Analyst-level exercise.
8. Close with: "every number here has a unit test, and the definitions are in one place."
