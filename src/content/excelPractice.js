// Graded Excel exercises for the live sheet in Excel Lab.
// Formula exercises name a target cell: your result there is compared with
// the reference formula evaluated in the same cell on the same data.
// Pivot exercises compare your pivot with the reference pivot.
// `{n}` in a prompt or formula is replaced with the last data row.

export const DATASETS = {
  orders: { label: 'Orders', letters: 'A id · B date · C amount · D units · E status · F region · G category · H fulfillment_center · I customer_id · J channel · K payment_method · L discount · M delivery_days' },
  actuals: { label: 'Weekly actuals', letters: 'A week_start · B line_id · C forecast_volume · D actual_volume · E planned_aht · F actual_aht · G planned_hc · H actual_hc · I planned_shrinkage · J actual_shrinkage · K sl_target · L sl_actual · M occupancy · N cost_planned · O cost_actual' },
  inventory: { label: 'Inventory', letters: 'A sku · B name · C category · D stock · E reorder_point' },
};

export const GROUPS = [
  { id: 'Basics', blurb: 'SUM, AVERAGE, COUNT, ROUND and cell references' },
  { id: 'Conditional', label: 'Conditional aggregation', blurb: 'SUMIFS, COUNTIFS, AVERAGEIFS, MAXIFS and criteria' },
  { id: 'Lookups', blurb: 'XLOOKUP, VLOOKUP, INDEX and MATCH' },
  { id: 'Text', label: 'Text & dates', blurb: 'LEFT, TEXT, SUBSTITUTE, EOMONTH and NETWORKDAYS' },
  { id: 'Dynamic', label: 'Dynamic arrays', blurb: 'FILTER, SORT, UNIQUE, SEQUENCE and LET' },
  { id: 'Array', label: 'Array formulas', blurb: 'SUMPRODUCT and boolean logic over whole ranges' },
  { id: 'Pivot', label: 'Pivot tables', blurb: 'Rows, columns, values and filters' },
];

const O = 'orders';
const A = 'actuals';
const V = 'inventory';

export const EXCEL_PRACTICE = [
  // ───────────── Basics ─────────────
  { id: 'e01', group: 'Basics', dataset: O, cell: 'N2', title: 'Total revenue', prompt: 'In `N2`, add up every order amount in column `C`', hint: 'Use `=SUM(C2:C{n})`, or `C:C` for the whole column', formula: '=SUM(C2:C{n})' },
  { id: 'e02', group: 'Basics', dataset: O, cell: 'N2', title: 'Average order value', prompt: 'In `N2`, find the average order amount', hint: '`AVERAGE` ignores the text header if you use the whole column', formula: '=AVERAGE(C2:C{n})' },
  { id: 'e03', group: 'Basics', dataset: O, cell: 'N2', title: 'How many orders', prompt: 'In `N2`, count the orders using the `id` column', hint: '`COUNT` only counts numbers, so use `COUNTA` for text', formula: '=COUNTA(A2:A{n})' },
  { id: 'e04', group: 'Basics', dataset: O, cell: 'N2', title: 'Largest and smallest', prompt: 'In `N2`, show the gap between the largest and the smallest order amount', hint: 'Subtract `MIN` from `MAX`', formula: '=MAX(C2:C{n})-MIN(C2:C{n})' },
  { id: 'e05', group: 'Basics', dataset: O, cell: 'N2', title: 'Units sold', prompt: 'In `N2`, add up all units in column `D`', hint: '`SUM` over `D2:D{n}`', formula: '=SUM(D2:D{n})' },
  { id: 'e06', group: 'Basics', dataset: O, cell: 'N2', title: 'Revenue per unit', prompt: 'In `N2`, divide total revenue by total units and round to 2 decimals', hint: 'Wrap the division in `ROUND(…, 2)`', formula: '=ROUND(SUM(C2:C{n})/SUM(D2:D{n}),2)' },
  { id: 'e07', group: 'Basics', dataset: O, cell: 'N2', title: 'Price of the first order', prompt: 'In `N2`, show the price per unit of the order in row 2\nRound to the nearest whole number', hint: 'Divide `C2` by `D2`, then `ROUND(…, 0)`', formula: '=ROUND(C2/D2,0)' },
  { id: 'e08', group: 'Basics', dataset: O, cell: 'N2', title: 'Median order', prompt: 'In `N2`, find the median order amount', hint: '`MEDIAN` is the middle value and ignores outliers', formula: '=MEDIAN(C2:C{n})' },
  { id: 'e09', group: 'Basics', dataset: O, cell: 'N2', title: 'Third biggest order', prompt: 'In `N2`, find the third largest order amount', hint: '`LARGE(range, k)` returns the kth largest value', formula: '=LARGE(C2:C{n},3)' },
  { id: 'e10', group: 'Basics', dataset: A, cell: 'Q2', title: 'Forecast error', prompt: 'In `Q2`, show the absolute error between forecast and actual volume for row 2', hint: '`ABS(C2-D2)` removes the sign', formula: '=ABS(C2-D2)' },

  // ───────────── Conditional aggregation ─────────────
  { id: 'e11', group: 'Conditional', dataset: O, cell: 'N2', title: 'Revenue for one region', prompt: 'In `N2`, add up order amounts for the North region', hint: '`SUMIFS(sum_range, criteria_range, criteria)`', formula: '=SUMIFS(C:C,F:F,"North")' },
  { id: 'e12', group: 'Conditional', dataset: O, cell: 'N2', title: 'Count by status', prompt: 'In `N2`, count the Pending orders', hint: '`COUNTIF(E:E, "Pending")`', formula: '=COUNTIF(E:E,"Pending")' },
  { id: 'e13', group: 'Conditional', dataset: O, cell: 'N2', title: 'Two conditions', prompt: 'In `N2`, add up Delivered Electronics revenue', hint: 'Add a second range and criteria pair to `SUMIFS`', formula: '=SUMIFS(C:C,E:E,"Delivered",G:G,"Electronics")' },
  { id: 'e14', group: 'Conditional', dataset: O, cell: 'N2', title: 'Comparison criteria', prompt: 'In `N2`, count orders worth more than 5000', hint: 'Put the operator inside quotes: `">5000"`', formula: '=COUNTIF(C:C,">5000")' },
  { id: 'e15', group: 'Conditional', dataset: O, cell: 'N2', title: 'Average for a category', prompt: 'In `N2`, find the average Grocery order amount, rounded to 0 decimals', hint: '`ROUND(AVERAGEIFS(…), 0)`', formula: '=ROUND(AVERAGEIFS(C:C,G:G,"Grocery"),0)' },
  { id: 'e16', group: 'Conditional', dataset: O, cell: 'N2', title: 'Not equal criteria', prompt: 'In `N2`, add up revenue for every order that was not Cancelled', hint: '`"<>Cancelled"` means anything except Cancelled', formula: '=SUMIFS(C:C,E:E,"<>Cancelled")' },
  { id: 'e17', group: 'Conditional', dataset: O, cell: 'N2', title: 'Biggest order in a region', prompt: 'In `N2`, find the largest order in the West region', hint: '`MAXIFS(max_range, criteria_range, criteria)`', formula: '=MAXIFS(C:C,F:F,"West")' },
  { id: 'e18', group: 'Conditional', dataset: O, cell: 'N2', title: 'Criteria from a cell', prompt: 'Type `South` in `O2`\nIn `N2`, count orders for the region typed in `O2`', hint: 'Use the cell as the criteria: `COUNTIF(F:F, O2)`', formula: '=COUNTIF(F:F,"South")' },
  { id: 'e19', group: 'Conditional', dataset: O, cell: 'N2', title: 'Wildcards', prompt: 'In `N2`, count orders from fulfillment centers whose code ends in 1 to 4\nThe codes look like `FC-1`', hint: 'Add four `COUNTIF` calls, one for each code', formula: '=COUNTIF(H:H,"FC-1")+COUNTIF(H:H,"FC-2")+COUNTIF(H:H,"FC-3")+COUNTIF(H:H,"FC-4")' },
  { id: 'e58', group: 'Conditional', dataset: O, cell: 'N2', title: 'Delivery speed by region', prompt: 'In `N2`, find the average `delivery_days` for the East region, rounded to 2 decimals\nBlank cells are orders not delivered yet', hint: '`AVERAGEIFS` skips blank cells in the average range', formula: '=ROUND(AVERAGEIFS(M:M,F:F,"East"),2)' },
  { id: 'e59', group: 'Conditional', dataset: O, cell: 'N2', title: 'Cash on delivery cancellations', prompt: 'In `N2`, find the share of `COD` orders that were Cancelled, rounded to 3 decimals', hint: 'Divide a two condition `COUNTIFS` by a one condition `COUNTIF`', formula: '=ROUND(COUNTIFS(K:K,"COD",E:E,"Cancelled")/COUNTIF(K:K,"COD"),3)' },
  { id: 'e60', group: 'Conditional', dataset: O, cell: 'N2', title: 'App revenue', prompt: 'In `N2`, add up revenue from orders placed in the App `channel` that were Delivered', hint: '`SUMIFS` with the `channel` column `J` and the status column `E`', formula: '=SUMIFS(C:C,J:J,"App",E:E,"Delivered")' },
  { id: 'e20', group: 'Conditional', dataset: A, cell: 'Q2', title: 'Weeks that missed SL', prompt: 'In `Q2`, count weeks of `CS-VOICE` where `sl_actual` was below 80', hint: '`COUNTIFS(B:B, "CS-VOICE", L:L, "<80")`', formula: '=COUNTIFS(B:B,"CS-VOICE",L:L,"<80")' },
  { id: 'e21', group: 'Conditional', dataset: A, cell: 'Q2', title: 'Overspend', prompt: 'In `Q2`, add up `cost_actual` for `RETURNS-OPS`', hint: '`SUMIFS(O:O, B:B, "RETURNS-OPS")`', formula: '=SUMIFS(O:O,B:B,"RETURNS-OPS")' },

  // ───────────── Lookups ─────────────
  { id: 'e22', group: 'Lookups', dataset: O, cell: 'N2', title: 'XLOOKUP an order', prompt: 'In `N2`, return the region of the order whose `id` is in `A10`', hint: '`XLOOKUP(lookup_value, lookup_range, return_range)`', formula: '=XLOOKUP(A10,A:A,F:F)' },
  { id: 'e23', group: 'Lookups', dataset: O, cell: 'N2', title: 'VLOOKUP the classic way', prompt: 'In `N2`, use `VLOOKUP` to return the amount for the order id in `A20`', hint: 'Amount is the 3rd column of `A:H`, and the last argument `FALSE` means exact match', formula: '=VLOOKUP(A20,A:H,3,FALSE)' },
  { id: 'e24', group: 'Lookups', dataset: O, cell: 'N2', title: 'INDEX and MATCH', prompt: 'In `N2`, use `INDEX` with `MATCH` to return the category of the order id in `A30`', hint: '`MATCH` finds the row, `INDEX` returns the value from that row', formula: '=INDEX(G:G,MATCH(A30,A:A,0))' },
  { id: 'e25', group: 'Lookups', dataset: O, cell: 'N2', title: 'Not found', prompt: 'In `N2`, look up the id `ORD-0` and return its amount, or the text `missing` if it does not exist', hint: 'XLOOKUP has a 4th argument for the not found value', formula: '=XLOOKUP("ORD-0",A:A,C:C,"missing")' },
  { id: 'e26', group: 'Lookups', dataset: O, cell: 'N2', title: 'Which row has the max', prompt: 'In `N2`, return the `id` of the biggest order', hint: 'Look up `MAX(C:C)` in column `C` and return column `A`', formula: '=XLOOKUP(MAX(C2:C{n}),C2:C{n},A2:A{n})' },
  { id: 'e27', group: 'Lookups', dataset: O, cell: 'N2', title: 'Last match', prompt: 'In `N2`, return the date of the last order from the East region in the list', hint: 'XLOOKUP searches from the bottom when its 6th argument is `-1`', formula: '=XLOOKUP("East",F2:F{n},B2:B{n},,0,-1)' },
  { id: 'e28', group: 'Lookups', dataset: V, cell: 'G2', title: 'Two way lookup', prompt: 'In `G2`, return the `stock` of `SKU-505` using `INDEX` with two `MATCH`es', hint: 'Match the row in column `A` and the column in the header row `1:1`', formula: '=INDEX(A1:E{n},MATCH("SKU-505",A1:A{n},0),MATCH("stock",A1:E1,0))' },
  { id: 'e29', group: 'Lookups', dataset: V, cell: 'G2', title: 'Approximate match bands', prompt: 'In `G2`, grade the stock in `D2` with bands: below 100 is `Low`, 100 to 499 is `Mid`, 500 and up is `High`', hint: 'An array constant works as a band table: `{0,"Low";100,"Mid";500,"High"}` with approximate `VLOOKUP`', formula: '=VLOOKUP(D2,{0,"Low";100,"Mid";500,"High"},2,TRUE)' },

  // ───────────── Text & dates ─────────────
  { id: 'e30', group: 'Text', dataset: O, cell: 'N2', title: 'Order number only', prompt: 'In `N2`, turn the id in `A2` into its number, without the `ORD-` prefix', hint: '`VALUE(MID(A2, 5, 10))` or `SUBSTITUTE`', formula: '=VALUE(SUBSTITUTE(A2,"ORD-",""))' },
  { id: 'e31', group: 'Text', dataset: O, cell: 'N2', title: 'Join text', prompt: 'In `N2`, build a label like `North / Beauty` from `F2` and `G2`', hint: 'Use `&` to join text: `F2&" / "&G2`', formula: '=F2&" / "&G2' },
  { id: 'e32', group: 'Text', dataset: O, cell: 'N2', title: 'Upper case', prompt: 'In `N2`, show the status in `E2` in capitals', hint: '`UPPER`', formula: '=UPPER(E2)' },
  { id: 'e33', group: 'Text', dataset: O, cell: 'N2', title: 'Month of an order', prompt: 'In `N2`, show the month of `B2` as text like `Jan 2026`', hint: '`TEXT(B2, "mmm yyyy")`', formula: '=TEXT(B2,"mmm yyyy")' },
  { id: 'e34', group: 'Text', dataset: O, cell: 'N2', title: 'Year and month key', prompt: 'In `N2`, build a `yyyy-mm` key for the date in `B2`', hint: '`TEXT(B2, "yyyy-mm")`, or `LEFT(B2, 7)` since dates here are ISO text', formula: '=TEXT(B2,"yyyy-mm")' },
  { id: 'e35', group: 'Text', dataset: O, cell: 'N2', title: 'End of month', prompt: 'In `N2`, return the last day of the month of `B2`', hint: '`EOMONTH(date, 0)`', formula: '=EOMONTH(B2,0)' },
  { id: 'e36', group: 'Text', dataset: O, cell: 'N2', title: 'Day of week', prompt: 'In `N2`, show the weekday name of `B2`, such as `Monday`', hint: '`TEXT(B2, "dddd")`', formula: '=TEXT(B2,"dddd")' },
  { id: 'e37', group: 'Text', dataset: O, cell: 'N2', title: 'Days between', prompt: 'In `N2`, count days between the first and the last order date in the whole list', hint: 'Dates are numbers: `MAX(B:B) - MIN(B:B)`', formula: '=MAX(B2:B{n})-MIN(B2:B{n})' },
  { id: 'e38', group: 'Text', dataset: O, cell: 'N2', title: 'Working days', prompt: 'In `N2`, count working days from `B2` to `B3`, counting both ends', hint: '`NETWORKDAYS(start, end)` skips weekends\nIf `B3` is earlier the answer is negative', formula: '=NETWORKDAYS(B2,B3)' },
  { id: 'e39', group: 'Text', dataset: O, cell: 'N2', title: 'Months between', prompt: 'In `N2`, count whole months from the earliest to the latest order date', hint: '`DATEDIF(start, end, "m")`', formula: '=DATEDIF(MIN(B2:B{n}),MAX(B2:B{n}),"m")' },
  { id: 'e40', group: 'Text', dataset: A, cell: 'Q2', title: 'Shorter line code', prompt: 'In `Q2`, show the part of `B2` before the first `-`', hint: '`LEFT(B2, FIND("-", B2) - 1)` or `TEXTBEFORE`', formula: '=LEFT(B2,FIND("-",B2)-1)' },

  // ───────────── Dynamic arrays ─────────────
  { id: 'e41', group: 'Dynamic', dataset: O, cell: 'N2', title: 'Unique regions', prompt: 'In `N2`, spill the list of distinct regions', hint: '`UNIQUE(F2:F{n})` spills down from `N2`', formula: '=UNIQUE(F2:F{n})' },
  { id: 'e42', group: 'Dynamic', dataset: O, cell: 'N2', title: 'Sorted categories', prompt: 'In `N2`, spill the distinct categories in A to Z order', hint: 'Wrap `UNIQUE` in `SORT`', formula: '=SORT(UNIQUE(G2:G{n}))' },
  { id: 'e43', group: 'Dynamic', dataset: O, cell: 'N2', title: 'Filter rows', prompt: 'In `N2`, spill the ids of every Cancelled order', hint: '`FILTER(A2:A{n}, E2:E{n}="Cancelled")`', formula: '=FILTER(A2:A{n},E2:E{n}="Cancelled")' },
  { id: 'e44', group: 'Dynamic', dataset: O, cell: 'N2', title: 'Filter with two conditions', prompt: 'In `N2`, spill `id` and `amount` for North orders above 8000', hint: 'Multiply conditions for AND: `(F2:F{n}="North")*(C2:C{n}>8000)`\nReturn two columns with `CHOOSECOLS(A2:C{n}, 1, 3)`', formula: '=FILTER(CHOOSECOLS(A2:C{n},1,3),(F2:F{n}="North")*(C2:C{n}>8000))' },
  { id: 'e45', group: 'Dynamic', dataset: O, cell: 'N2', title: 'Top 5 orders', prompt: 'In `N2`, spill the 5 largest order amounts, biggest first', hint: '`TAKE(SORT(C2:C{n}, 1, -1), 5)`', formula: '=TAKE(SORT(C2:C{n},1,-1),5)' },
  { id: 'e46', group: 'Dynamic', dataset: O, cell: 'N2', title: 'Top 5 ids by amount', prompt: 'In `N2`, spill the ids of the 5 largest orders, biggest first', hint: '`SORTBY` sorts one range by another', formula: '=TAKE(SORTBY(A2:A{n},C2:C{n},-1),5)' },
  { id: 'e47', group: 'Dynamic', dataset: O, cell: 'N2', title: 'Revenue for every region at once', prompt: 'In `N2`, spill the revenue of each distinct region with a single formula, in the order `UNIQUE` lists them', hint: 'Give `SUMIFS` an array of criteria: `SUMIFS(C:C, F:F, UNIQUE(F2:F{n}))`', formula: '=SUMIFS(C:C,F:F,UNIQUE(F2:F{n}))' },
  { id: 'e48', group: 'Dynamic', dataset: O, cell: 'N2', title: 'A number series', prompt: 'In `N2`, spill the numbers 1 to 12 down the column', hint: '`SEQUENCE(12)`', formula: '=SEQUENCE(12)' },
  { id: 'e49', group: 'Dynamic', dataset: O, cell: 'N2', title: 'Name parts with LET', prompt: 'In `N2`, use `LET` to name the North revenue and the total revenue, then return the North share rounded to 3 decimals', hint: '`LET(n, SUMIFS(…), t, SUM(…), ROUND(n/t, 3))`', formula: '=LET(n,SUMIFS(C:C,F:F,"North"),t,SUM(C2:C{n}),ROUND(n/t,3))' },
  { id: 'e50', group: 'Dynamic', dataset: O, cell: 'N2', title: 'Count of distinct values', prompt: 'In `N2`, count how many distinct fulfillment centers appear', hint: '`ROWS(UNIQUE(…))` or `COUNTA(UNIQUE(…))`', formula: '=ROWS(UNIQUE(H2:H{n}))' },

  // ───────────── Array formulas ─────────────
  { id: 'e51', group: 'Array', dataset: O, cell: 'N2', title: 'SUMPRODUCT with a condition', prompt: 'In `N2`, add up North revenue with `SUMPRODUCT` instead of `SUMIFS`', hint: 'A comparison gives TRUE or FALSE, and multiplying turns them into 1 and 0', formula: '=SUMPRODUCT((F2:F{n}="North")*C2:C{n})' },
  { id: 'e52', group: 'Array', dataset: O, cell: 'N2', title: 'OR logic', prompt: 'In `N2`, count orders that are Returned or Cancelled with one array formula', hint: 'Add the conditions for OR: `SUM((E2:E{n}="Returned")+(E2:E{n}="Cancelled"))`', formula: '=SUM((E2:E{n}="Returned")+(E2:E{n}="Cancelled"))' },
  { id: 'e53', group: 'Array', dataset: A, cell: 'Q2', title: 'Weighted average', prompt: 'In `Q2`, compute the average `actual_shrinkage` weighted by `actual_hc`, rounded to 2 decimals', hint: '`SUMPRODUCT(J2:J{n}, H2:H{n}) / SUM(H2:H{n})`', formula: '=ROUND(SUMPRODUCT(J2:J{n},H2:H{n})/SUM(H2:H{n}),2)' },
  { id: 'e54', group: 'Array', dataset: O, cell: 'N2', title: 'Orders above the average', prompt: 'In `N2`, count orders whose amount is above the average amount', hint: '`SUM(--(C2:C{n} > AVERAGE(C2:C{n})))`\n`--` turns TRUE and FALSE into 1 and 0', formula: '=SUM(--(C2:C{n}>AVERAGE(C2:C{n})))' },
  { id: 'e61', group: 'Array', dataset: O, cell: 'N2', title: 'Discount rate', prompt: 'In `N2`, find total `discount` as a share of the price before discount, rounded to 4 decimals\nThe price before discount is `amount` plus `discount`', hint: 'Divide `SUM(L…)` by `SUM(C…)+SUM(L…)`', formula: '=ROUND(SUM(L2:L{n})/(SUM(C2:C{n})+SUM(L2:L{n})),4)' },
  { id: 'e55', group: 'Array', dataset: A, cell: 'Q2', title: 'WAPE in one cell', prompt: 'In `Q2`, compute forecast WAPE as a fraction: total absolute error divided by total actual volume, rounded to 4 decimals', hint: '`SUMPRODUCT(ABS(C2:C{n} - D2:D{n})) / SUM(D2:D{n})`', formula: '=ROUND(SUMPRODUCT(ABS(C2:C{n}-D2:D{n}))/SUM(D2:D{n}),4)' },
  { id: 'e56', group: 'Array', dataset: A, cell: 'Q2', title: 'SL attainment rate', prompt: 'In `Q2`, compute the share of rows where `sl_actual` met or beat `sl_target`, rounded to 3 decimals', hint: 'Compare two columns row by row: `L2:L{n} >= K2:K{n}`', formula: '=ROUND(SUM(--(L2:L{n}>=K2:K{n}))/ROWS(L2:L{n}),3)' },
  { id: 'e57', group: 'Array', dataset: V, cell: 'G2', title: 'Items to reorder', prompt: 'In `G2`, count SKUs where `stock` is below `reorder_point`', hint: '`SUM(--(D2:D{n} < E2:E{n}))`', formula: '=SUM(--(D2:D{n}<E2:E{n}))' },

  // ───────────── Pivot tables ─────────────
  { id: 'p01', group: 'Pivot', dataset: O, title: 'Revenue by region', prompt: 'Build a pivot with `region` in Rows and the Sum of `amount` in Values', hint: 'Rows: region · Values: amount · Summarise: Sum', pivot: { rows: 'region', value: 'amount', agg: 'Sum' } },
  { id: 'p02', group: 'Pivot', dataset: O, title: 'Orders by status', prompt: 'Count orders by `status`', hint: 'Rows: status · Values: id · Summarise: Count', pivot: { rows: 'status', value: 'id', agg: 'Count' } },
  { id: 'p03', group: 'Pivot', dataset: O, title: 'Region by status matrix', prompt: 'Show the Sum of `amount` with `region` in Rows and `status` in Columns', hint: 'Use the Columns field for the second dimension', pivot: { rows: 'region', cols: 'status', value: 'amount', agg: 'Sum' } },
  { id: 'p04', group: 'Pivot', dataset: O, title: 'Average basket by category', prompt: 'Show the Average `amount` by `category`', hint: 'Change Summarise to Average', pivot: { rows: 'category', value: 'amount', agg: 'Average' } },
  { id: 'p05', group: 'Pivot', dataset: O, title: 'Filter a pivot', prompt: 'Show the Sum of `units` by `category` for Delivered orders only', hint: 'Filter field: status · Filter value: Delivered', pivot: { rows: 'category', value: 'units', agg: 'Sum', filterField: 'status', filterValue: 'Delivered' } },
  { id: 'p06', group: 'Pivot', dataset: O, title: 'Share of total', prompt: 'Show each region’s share of total revenue as a percentage of the grand total', hint: 'Tick Show as % of grand total', pivot: { rows: 'region', value: 'amount', agg: 'Sum', percent: true } },
  { id: 'p07', group: 'Pivot', dataset: O, title: 'Distinct centers per region', prompt: 'Count distinct `fulfillment_center` values per `region`', hint: 'Summarise: Distinct count', pivot: { rows: 'region', value: 'fulfillment_center', agg: 'Distinct count' } },
  { id: 'p10', group: 'Pivot', dataset: O, title: 'Channel by payment', prompt: 'Count orders with `channel` in Rows and `payment_method` in Columns', hint: 'Rows: `channel` · Columns: `payment_method` · Values: `id` · Summarise: Count', pivot: { rows: 'channel', cols: 'payment_method', value: 'id', agg: 'Count' } },
  { id: 'p11', group: 'Pivot', dataset: O, title: 'Slowest fulfillment center', prompt: 'Show the Average `delivery_days` by `fulfillment_center`', hint: 'Rows: `fulfillment_center` · Values: `delivery_days` · Summarise: Average', pivot: { rows: 'fulfillment_center', value: 'delivery_days', agg: 'Average' } },
  { id: 'p08', group: 'Pivot', dataset: A, title: 'Cost by line', prompt: 'On weekly actuals, show the Sum of `cost_actual` by `line_id`', hint: 'Switch the dataset to Weekly actuals first', pivot: { rows: 'line_id', value: 'cost_actual', agg: 'Sum' } },
  { id: 'p09', group: 'Pivot', dataset: A, title: 'Worst SL week per line', prompt: 'On weekly actuals, show the Min of `sl_actual` by `line_id`', hint: 'Summarise: Min', pivot: { rows: 'line_id', value: 'sl_actual', agg: 'Min' } },
];

// Fills `{n}` with the last data row (header is row 1).
export const fill = (text, lastRow) => String(text || '').replace(/\{n\}/g, String(lastRow));
