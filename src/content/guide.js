// Plain-English explanations used by the Start Here page, the
// "What am I looking at?" boxes and the ⓘ tooltips.

export const GLOSSARY = {
  fte: { term: 'FTE (full-time equivalent)', short: 'One full-time person’s worth of work hours. Two half-time people = 1 FTE.' },
  requiredFte: { term: 'Required FTE', short: 'How many full-time people you need to handle the forecast work, after allowing for breaks, leave, meetings and idle time.' },
  effectiveFte: { term: 'Effective FTE', short: 'Productive capacity you actually have. Trainees count as 0 and new hires count partially until they are fully up to speed.' },
  paidHc: { term: 'Paid headcount (HC)', short: 'Everyone on the payroll for the line, including people still in training.' },
  aht: { term: 'AHT (average handle time)', short: 'Average time to complete one contact (talk + hold + after-call work), in seconds. 360 s = 6 minutes.' },
  npt: { term: 'NPT (non-productive time)', short: 'Share of on-shift time not available for customer work: team meetings, coaching, system downtime.' },
  shrinkage: { term: 'Shrinkage', short: 'Share of paid time people are not available at all: holidays, sick leave, breaks, training. 30% shrinkage means 40 paid hours give 28 available hours.' },
  occupancy: { term: 'Occupancy', short: 'Share of available time spent actually handling work. 100% would mean no gap between contacts — unsustainable; 80–88% is typical.' },
  serviceLevel: { term: 'Service level (SL)', short: 'Share of contacts answered within a target time, e.g. 80/30 = 80% answered within 30 seconds.' },
  erlang: { term: 'Erlang C', short: 'The standard queueing formula that tells how many agents you need in an interval to hit a service level, given volume and AHT.' },
  wape: { term: 'WAPE (forecast error)', short: 'Weighted absolute percentage error: total forecast miss ÷ total actual volume. Lower is better; under 5% is very good for weekly forecasts.' },
  mape: { term: 'MAPE', short: 'Mean absolute percentage error: the average of each period’s % miss. Sensitive to low-volume periods.' },
  bias: { term: 'Forecast bias', short: 'Whether forecasts run high (+) or low (−) on average. Good forecasts sit near 0%.' },
  backtest: { term: 'Backtest', short: 'Hiding the most recent weeks, forecasting them from older data, and measuring the error — a fair test of a forecast method.' },
  attrition: { term: 'Attrition', short: 'Share of staff who leave each month. 3%/month means about 1 in 3 people leave over a year.' },
  ramp: { term: 'Training, nesting & ramp', short: 'New hires spend weeks in training (0% productive), then “nesting” on live work at reduced productivity until fully ramped.' },
  leadTime: { term: 'Hiring lead time', short: 'Training + ramp weeks. A hire must start this many weeks before they are needed at full productivity.' },
  temps: { term: 'Seasonal / temp hires', short: 'Short-contract staff hired to cover a demand peak; they leave after it.' },
  overtime: { term: 'Overtime (OT)', short: 'Extra paid hours from existing staff — fast to switch on but capped and more expensive per hour.' },
  gap: { term: 'Over / under staffing (gap)', short: 'Effective FTE minus required FTE. Negative = short-staffed; large positive = paying for idle capacity.' },
  op: { term: 'OP1 / OP2', short: 'Operating-plan budget targets. OP1 is set for the year; OP2 is the mid-year refresh. Variance shows how far the plan is above (+) or below (−) target.' },
  cpc: { term: 'Cost per contact', short: 'Variable cost divided by contacts handled — a simple efficiency measure.' },
  variableCost: { term: 'Variable cost', short: 'Costs that move with volume: staff hours, overtime, hiring and vendor per-contact fees.' },
  adherence: { term: 'HC plan adherence', short: 'Actual headcount ÷ planned headcount. 100% means you staffed exactly to plan.' },
  peak: { term: 'Peak weeks', short: 'The highest-demand weeks in the horizon — usually sale seasons — where readiness matters most.' },
  scenario: { term: 'Scenario / what-if', short: 'Changing an input (volume, AHT, shrinkage, attrition) to see how the plan breaks and what it would cost to fix.' },
  pareto: { term: 'Pareto (80/20)', short: 'Sorting causes by frequency to find the few root causes behind most problems.' },
  planLine: { term: 'Plan line', short: 'One program or queue at one site that you plan headcount for, e.g. “Customer Support · Voice at North Hub”.' },
  sql: { term: 'SQL', short: 'A language for asking questions of tables: SELECT columns FROM a table WHERE a condition, GROUP BY to summarise, JOIN to combine tables.' },
};

// Per-screen help: purpose, how to read it, and which uploads feed it.
export const HELP = {
  start: null,
  upload: {
    purpose: 'Bring your own data into WorkX from CSV, TSV, JSON or Excel (.xlsx) files.',
    steps: [
      'Drop a file (or click to browse). For Excel, choose the sheet.',
      'Check the preview. If the column names look wrong, change the header row.',
      'Choose where it goes: any file can become a SQL table for practice; files for planning screens must use the exact column names in the Column reference below.',
      'Fix anything marked ✗, then press Import. Everything stays in this browser.',
    ],
  },
  hub: {
    purpose: 'A one-page summary of whether every program and site has enough people for the coming weeks, and what it will cost.',
    steps: [
      'Top tiles: people needed vs people available this week, planned hiring, cost vs budget (OP), open risks.',
      'Chart: blue = people needed, orange = productive people you will have, green dashed = everyone on payroll. Dashed verticals mark peak weeks.',
      '“Actions & insights” lists what to do next, in plain language.',
      'Export weekly plan downloads the full plan as a CSV for Excel.',
    ],
    feeds: ['volume_history', 'plan_lines', 'actuals', 'op_targets', 'risks'],
  },
  forecast: {
    purpose: 'Predicts how many contacts each line will receive every week, based on past volume.',
    steps: [
      'The chart shows the last 52 weeks (blue) and the forecast (orange). The dashed line is the forecast before planned events.',
      'WAPE and bias tell you how accurate the method was when tested on past weeks you already know.',
      'Method “auto” picks whichever method tested best. Add events (sales, launches) to lift or lower specific weeks.',
    ],
    feeds: ['volume_history', 'events'],
  },
  capacity: {
    purpose: 'Turns the forecast into the number of people needed each week and plans hiring to get there.',
    steps: [
      'Required FTE = volume × AHT ÷ 3600 ÷ occupancy ÷ productive hours per person.',
      'Supply rolls forward: people leave (attrition), new hires train, then ramp up.',
      'Hiring is recommended automatically (permanent for the base, temps for peaks). Type your own numbers in the weekly table to override and lock.',
      'Change the assumptions at the bottom and every screen updates instantly.',
    ],
    feeds: ['plan_lines', 'volume_history'],
  },
  intraday: {
    purpose: 'Shows how many people must be working in each hour of a chosen week to answer contacts on time.',
    steps: [
      'Darker cells = more people needed. Hover a cell for the contacts and service level in that hour.',
      'Real-time queues (phone/chat) use Erlang C; back-office work uses workload ÷ occupancy.',
      'If “implied occupancy” is below the plan’s occupancy, the long-term plan is too optimistic.',
      'The Erlang calculator lets you test any interval by hand.',
    ],
    feeds: ['volume_history', 'plan_lines'],
  },
  budget: {
    purpose: 'Calculates what the staffing plan will cost each month and compares it with the budget (OP1/OP2).',
    steps: [
      'Positive variance = plan costs more than the budget target.',
      'Cost per contact falls in busy months because fixed staff handle more work.',
      'Edit OP target cells directly or import them from a file.',
    ],
    feeds: ['op_targets', 'plan_lines'],
  },
  scenarios: {
    purpose: 'Stress-tests the plan: what if volume is higher, calls take longer, or more people leave?',
    steps: [
      'Move a slider; the current hiring plan is held fixed so you see the risk.',
      '“Hires to cover” shows what a re-plan would need.',
      'The tornado chart shows which driver moves cost most.',
      'Track risks and their mitigations in the register below.',
    ],
    feeds: ['risks'],
  },
  kpis: {
    purpose: 'Reports how planning performed in past weeks: forecast accuracy, service level, staffing to plan and cost.',
    steps: [
      'Switch weekly/monthly and the date range at the top.',
      'Red numbers in the table missed their target.',
      '“Generate review summary” writes a ready-to-share weekly update.',
      'Log planning misses as defects; the Pareto chart shows the biggest root causes.',
    ],
    feeds: ['actuals', 'defects'],
  },
  dashboard: {
    purpose: 'A sales and fulfilment dashboard for any order-level table.',
    steps: [
      'Click a tile, bar or month to see the records behind it, then export them.',
      'Use the gear icon to pick which columns hold the date, value, status and category.',
    ],
    feeds: ['orders'],
  },
  sql: {
    purpose: 'Practise SQL on every table in your workspace, including files you upload.',
    steps: [
      'Query: write SQL and press Run (or Ctrl/⌘+Enter). Click a table name to preview it.',
      'Schema: see every table’s columns and how tables connect.',
      'Practice: guided exercises from basic SELECT to JOINs, with hints and answer checking.',
    ],
  },
  grid: {
    purpose: 'View and edit the orders table like a spreadsheet.',
    steps: ['Double-click a cell to edit. Search, sort, add or delete rows and columns.', 'Import replaces or appends rows; Export saves a CSV.'],
    feeds: ['orders'],
  },
  cleaning: {
    purpose: 'Find and fix data quality problems in the orders table before analysing it.',
    steps: ['The column profile shows missing values and types.', 'Fill blanks, cap outliers, remove duplicates, rename or drop columns. Undo reverts the last 5 steps.'],
    feeds: ['orders'],
  },
  projects: {
    purpose: 'A simple kanban board for planning tasks, owners and due dates.',
    steps: ['Add a task, move it across columns with the arrows, edit or delete it. Overdue tasks turn red.'],
  },
  settings: {
    purpose: 'Currency, plan horizon, forecast method, and backup/restore of all your data.',
    steps: ['Download a backup regularly — data lives only in this browser.', 'Reset returns everything to the demo data (your account is kept).'],
  },
};
