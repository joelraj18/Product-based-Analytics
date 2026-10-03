// Plain English explanations used by the Start Here page, the
// "What am I looking at?" boxes and the ⓘ tooltips.
// Style: no dashes, underscores or full stops in prose. Separate sentences
// with a line break (\n); put column names in `backticks`.

export const GLOSSARY = {
  fte: { term: 'FTE (full time equivalent)', short: 'One full time person’s worth of work hours\nTwo people working half time make 1 FTE' },
  requiredFte: { term: 'Required FTE', short: 'How many full time people you need for the forecast work, after allowing for breaks, leave, meetings and idle time' },
  effectiveFte: { term: 'Effective FTE', short: 'Productive capacity you actually have\nTrainees count as 0 and new hires count partly until they are fully up to speed' },
  paidHc: { term: 'Paid headcount (HC)', short: 'Everyone on the payroll for the line, including people still in training' },
  aht: { term: 'AHT (average handle time)', short: 'Average time to finish one contact, covering talk, hold and after call work, in seconds\n360 seconds is 6 minutes' },
  npt: { term: 'NPT (non productive time)', short: 'Share of on shift time not available for customer work, such as team meetings, coaching and system downtime' },
  shrinkage: { term: 'Shrinkage', short: 'Share of paid time people are not available at all, such as holidays, sick leave, breaks and training\nWith 30% shrinkage, 40 paid hours give 28 available hours' },
  occupancy: { term: 'Occupancy', short: 'Share of available time spent actually handling work\n100% would mean no gap between contacts, which nobody can sustain, so 80% to 88% is typical' },
  serviceLevel: { term: 'Service level (SL)', short: 'Share of contacts answered within a target time\n80/30 means 80% answered within 30 seconds' },
  erlang: { term: 'Erlang C', short: 'The standard queueing formula that tells how many agents you need in an interval to hit a service level, given volume and AHT' },
  wape: { term: 'WAPE (forecast error)', short: 'Weighted absolute percentage error: total forecast miss divided by total actual volume\nLower is better, and under 5% is very good for weekly forecasts' },
  mape: { term: 'MAPE', short: 'Mean absolute percentage error: the average of each period’s % miss\nIt is sensitive to low volume periods' },
  bias: { term: 'Forecast bias', short: 'Whether forecasts run high (+) or low (−) on average\nGood forecasts sit near 0%' },
  backtest: { term: 'Backtest', short: 'Hide the most recent weeks, forecast them from older data, then measure the error\nIt is a fair test of a forecast method' },
  attrition: { term: 'Attrition', short: 'Share of staff who leave each month\n3% a month means about 1 in 3 people leave over a year' },
  ramp: { term: 'Training, nesting and ramp', short: 'New hires spend weeks in training at 0% productivity, then “nest” on live work at reduced productivity until fully ramped' },
  leadTime: { term: 'Hiring lead time', short: 'Training weeks plus ramp weeks\nA hire must start this many weeks before they are needed at full productivity' },
  temps: { term: 'Seasonal or temp hires', short: 'Short contract staff hired to cover a demand peak, who leave after it' },
  overtime: { term: 'Overtime (OT)', short: 'Extra paid hours from existing staff\nFast to switch on, but capped and more expensive per hour' },
  gap: { term: 'Over or under staffing (gap)', short: 'Effective FTE minus required FTE\nNegative means short staffed, and a large positive gap means paying for idle capacity' },
  op: { term: 'OP1 and OP2', short: 'Operating plan budget targets\nOP1 is set for the year and OP2 is the mid year refresh\nVariance shows how far the plan is above (+) or below (−) target' },
  cpc: { term: 'Cost per contact', short: 'Variable cost divided by contacts handled, a simple efficiency measure' },
  variableCost: { term: 'Variable cost', short: 'Costs that move with volume: staff hours, overtime, hiring and vendor fees per contact' },
  adherence: { term: 'HC plan adherence', short: 'Actual headcount divided by planned headcount\n100% means you staffed exactly to plan' },
  peak: { term: 'Peak weeks', short: 'The highest demand weeks in the horizon, usually sale seasons, where readiness matters most' },
  scenario: { term: 'Scenario or what if', short: 'Change an input such as volume, AHT, shrinkage or attrition to see how the plan breaks and what a fix would cost' },
  pareto: { term: 'Pareto (80/20)', short: 'Sort causes by how often they happen to find the few root causes behind most problems' },
  planLine: { term: 'Plan line', short: 'One program or queue at one site that you plan headcount for, like Customer Support · Voice at North Hub' },
  sql: { term: 'SQL', short: 'A language for asking questions of tables\nSELECT picks columns FROM a table WHERE a condition holds, GROUP BY summarises and JOIN combines tables' },
};

// Per screen help: purpose, how to read it, and which uploads feed it.
export const HELP = {
  start: null,
  upload: {
    purpose: 'Bring your own data into WorkX from CSV, TSV, JSON or Excel files',
    steps: [
      'Drop a file or click to browse, and for Excel choose the sheet',
      'Check the preview, and if the column names look wrong change the header row',
      'Choose where it goes: any file can become a SQL table for practice, while files for planning screens must use the exact column names in the Column reference below',
      'Fix anything marked ✗, then press Import\nEverything stays in this browser',
    ],
  },
  hub: {
    purpose: 'A one page summary of whether every program and site has enough people for the coming weeks, and what it will cost',
    steps: [
      'Top tiles: people needed vs people available this week, planned hiring, cost vs budget (OP) and open risks',
      'Chart: blue is people needed, orange is productive people you will have, green dashed is everyone on payroll, and the dashed verticals mark peak weeks',
      'Actions and insights lists what to do next in plain language',
      'Export weekly plan downloads the full plan as a CSV for Excel',
    ],
    feeds: ['volume_history', 'plan_lines', 'actuals', 'op_targets', 'risks'],
  },
  forecast: {
    purpose: 'Predicts how many contacts each line will receive every week, based on past volume',
    steps: [
      'The chart shows the last 52 weeks in blue and the forecast in orange, and the dashed line is the forecast before planned events',
      'WAPE and bias tell you how accurate the method was when tested on past weeks you already know',
      'Method auto picks whichever method tested best\nAdd events like sales or launches to lift or lower specific weeks',
    ],
    feeds: ['volume_history', 'events'],
  },
  capacity: {
    purpose: 'Turns the forecast into the number of people needed each week and plans hiring to get there',
    steps: [
      'Required FTE = volume × AHT ÷ 3600 ÷ occupancy ÷ productive hours per person',
      'Supply rolls forward: people leave through attrition, and new hires train and then ramp up',
      'Hiring is recommended automatically, permanent for the base and temps for peaks\nType your own numbers in the weekly table to override and lock them',
      'Change the assumptions at the bottom and every screen updates instantly',
    ],
    feeds: ['plan_lines', 'volume_history'],
  },
  intraday: {
    purpose: 'Shows how many people must be working in each hour of a chosen week to answer contacts on time',
    steps: [
      'Darker cells need more people\nHover a cell for the contacts and service level in that hour',
      'Real time queues like phone and chat use Erlang C, and back office work uses workload ÷ occupancy',
      'If implied occupancy is below the plan’s occupancy, the long term plan is too optimistic',
      'The Erlang calculator lets you test any interval by hand',
    ],
    feeds: ['volume_history', 'plan_lines'],
  },
  budget: {
    purpose: 'Calculates what the staffing plan will cost each month and compares it with the budget (OP1 and OP2)',
    steps: [
      'Positive variance means the plan costs more than the budget target',
      'Cost per contact falls in busy months because the same staff handle more work',
      'Edit OP target cells directly or import them from a file',
    ],
    feeds: ['op_targets', 'plan_lines'],
  },
  scenarios: {
    purpose: 'Stress tests the plan: what if volume is higher, calls take longer or more people leave',
    steps: [
      'Move a slider while the current hiring plan stays fixed, so you see the risk',
      'Hires to cover shows what a replan would need',
      'The tornado chart shows which driver moves cost the most',
      'Track risks and their mitigations in the register below',
    ],
    feeds: ['risks'],
  },
  kpis: {
    purpose: 'Reports how planning performed in past weeks: forecast accuracy, service level, staffing to plan and cost',
    steps: [
      'Switch between weekly and monthly, and pick the date range at the top',
      'Red numbers in the table missed their target',
      'Generate review summary writes a weekly update ready to share',
      'Log planning misses as defects, and the Pareto chart shows the biggest root causes',
    ],
    feeds: ['actuals', 'defects'],
  },
  dashboard: {
    purpose: 'A sales and fulfilment dashboard for any table of orders',
    steps: [
      'Click a tile, bar or month to see the records behind it, then export them',
      'Use the gear icon to pick which columns hold the date, value, status and category',
    ],
    feeds: ['orders'],
  },
  sql: {
    purpose: 'Practise SQL on every table in your workspace, including files you upload',
    steps: [
      'Query: write SQL and press Run, or use Ctrl or ⌘ with Enter\nClick a table name to preview it',
      'Schema: see every table’s columns and how tables connect',
      'Practice: 100 graded exercises in four levels, from `SELECT` to analyst questions for leadership',
    ],
  },
  excel: {
    purpose: 'Work and practise in a spreadsheet that runs real Excel formulas on your data, with pivot tables and lessons for VBA, Power Query and DAX',
    steps: [
      'Sheet: pick a dataset, click an empty cell to the right of the data and type a formula such as `=SUMIFS(C:C,F:F,"North")`\nDynamic arrays like `FILTER` and `UNIQUE` spill into the cells below, outlined in blue',
      'Pivot table: choose Rows, Columns, Values and a filter, and see the matching `SUMIFS` formula',
      'Practice: graded exercises from `SUM` to `SUMPRODUCT`, plus pivot tasks\nDownload the practice workbook to repeat them in desktop Excel',
      'VBA, Power Query and DAX: lessons with code to copy into desktop Excel, a task and an answer',
    ],
  },
  grid: {
    purpose: 'View and edit the orders table like a spreadsheet',
    steps: ['Double click a cell to edit it\nSearch, sort, add or delete rows and columns', 'Import replaces or appends rows, and Export saves a CSV'],
    feeds: ['orders'],
  },
  cleaning: {
    purpose: 'Find and fix data quality problems in the orders table before analysing it',
    steps: ['The column profile shows missing values and types', 'Fill blanks, cap outliers, remove duplicates, rename or drop columns, and Undo reverts the last 5 steps'],
    feeds: ['orders'],
  },
  projects: {
    purpose: 'A simple kanban board for planning tasks, owners and due dates',
    steps: ['Add a task, move it across columns with the arrows, edit or delete it\nOverdue tasks turn red'],
  },
  settings: {
    purpose: 'Currency, plan horizon, forecast method, and backup or restore of all your data',
    steps: ['Download a backup regularly, because data lives only in this browser', 'Reset returns everything to the demo data and keeps your account'],
  },
};
