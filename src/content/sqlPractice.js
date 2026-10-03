// Guided SQL exercises on the built in tables. "Check my answer" compares
// your result with the solution's result, ignoring column names.
// Prompts and hints follow the prose style: code in `backticks`, sentences
// separated by line breaks, no dashes, underscores or full stops.
export const PRACTICE = [
  {
    id: 'p1', level: 'Beginner', title: 'See a whole table',
    prompt: 'Show every column and every row of the `sites` table',
    hint: '`SELECT *` means all columns, and `FROM` names the table',
    solution: 'SELECT * FROM sites',
  },
  {
    id: 'p2', level: 'Beginner', title: 'Filter with WHERE',
    prompt: 'List the `id` and `name` of plan lines whose `type` is `\'realtime\'`',
    hint: 'Pick columns after `SELECT`, then add `WHERE type = \'realtime\'`\nText values go in single quotes',
    solution: "SELECT id, name FROM plan_lines WHERE type = 'realtime'",
  },
  {
    id: 'p3', level: 'Beginner', title: 'Sort and LIMIT',
    prompt: 'Show `sku`, `name` and `stock` for the 5 inventory items with the lowest stock, lowest first, breaking ties by `sku`',
    hint: '`ORDER BY stock, sku` sorts ascending\n`LIMIT 5` keeps the first five rows',
    solution: 'SELECT sku, name, stock FROM inventory ORDER BY stock, sku LIMIT 5',
    ordered: true,
  },
  {
    id: 'p4', level: 'Beginner', title: 'Count rows',
    prompt: 'How many planning defects are logged?\nReturn one number',
    hint: '`COUNT(*)` counts rows\nGive it a name with `AS`',
    solution: 'SELECT COUNT(*) AS defect_count FROM defects',
  },
  {
    id: 'p5', level: 'Intermediate', title: 'GROUP BY',
    prompt: 'Count defects per `category`\nReturn the category and the count',
    hint: 'Put the grouping column in `SELECT` and in `GROUP BY`, with `COUNT(*)` beside it',
    solution: 'SELECT category, COUNT(*) AS defects FROM defects GROUP BY category',
  },
  {
    id: 'p6', level: 'Intermediate', title: 'Filter groups with HAVING',
    prompt: 'Which defect categories have more than 5 defects?\nReturn the category and the count',
    hint: '`WHERE` filters rows before grouping, and `HAVING` filters groups after, like `HAVING COUNT(*) > 5`',
    solution: 'SELECT category, COUNT(*) AS defects FROM defects GROUP BY category HAVING COUNT(*) > 5',
  },
  {
    id: 'p7', level: 'Intermediate', title: 'SUM per group',
    prompt: 'Total `forecast_volume` per `line_id` across the whole `capacity_plan`',
    hint: 'Use `SUM(forecast_volume)` with `GROUP BY line_id`',
    solution: 'SELECT line_id, SUM(forecast_volume) AS total_volume FROM capacity_plan GROUP BY line_id',
  },
  {
    id: 'p8', level: 'Intermediate', title: 'JOIN two tables',
    prompt: 'Show each plan line name next to the name of its site',
    hint: '`plan_lines.siteId` matches `sites.id`\nUse aliases: `FROM plan_lines l JOIN sites s ON l.siteId = s.id`',
    solution: 'SELECT l.name AS line_name, s.name AS site_name FROM plan_lines l JOIN sites s ON l.siteId = s.id',
  },
  {
    id: 'p9', level: 'Advanced', title: 'Subquery',
    prompt: 'From `actuals`, list `week_start`, `line_id` and `sl_actual` for weeks where `sl_actual` was below the average `sl_actual` of all rows',
    hint: 'Compare with a subquery: `WHERE sl_actual < (SELECT AVG(sl_actual) FROM actuals)`',
    solution: 'SELECT week_start, line_id, sl_actual FROM actuals WHERE sl_actual < (SELECT AVG(sl_actual) FROM actuals)',
  },
  {
    id: 'p10', level: 'Advanced', title: 'CASE WHEN',
    prompt: 'For each risk show `id`, `title`, a score of likelihood × impact, and a level: High if the score is at least 15, Medium if at least 8, otherwise Low',
    hint: 'Use `CASE WHEN condition THEN value WHEN … ELSE value END AS level`',
    solution: "SELECT id, title, likelihood * impact AS score, CASE WHEN likelihood * impact >= 15 THEN 'High' WHEN likelihood * impact >= 8 THEN 'Medium' ELSE 'Low' END AS level FROM risks",
  },
  {
    id: 'p11', level: 'Advanced', title: 'Business metric: forecast error',
    prompt: 'Compute forecast WAPE % per line from `actuals`: 100 × SUM of the absolute miss ÷ SUM of actual volume, rounded to 2 decimals',
    hint: '`ABS()` gives the absolute value and `ROUND(x, 2)` rounds\nGroup by `line_id`',
    solution: 'SELECT line_id, ROUND(100 * SUM(ABS(actual_volume - forecast_volume)) / SUM(actual_volume), 2) AS wape_pct FROM actuals GROUP BY line_id',
  },
  {
    id: 'p12', level: 'Advanced', title: 'Top N after grouping',
    prompt: 'Which 3 plan weeks have the highest total `forecast_volume` across all lines?\nReturn `week_start` and the total, highest first',
    hint: 'Use `GROUP BY week_start`, `ORDER BY` the sum descending, then `LIMIT 3`',
    solution: 'SELECT week_start, SUM(forecast_volume) AS total_volume FROM capacity_plan GROUP BY week_start ORDER BY total_volume DESC LIMIT 3',
    ordered: true,
  },
];
