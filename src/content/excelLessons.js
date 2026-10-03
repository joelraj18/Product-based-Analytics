// Guided lessons for the parts of Excel that run only in desktop Excel:
// VBA macros, Power Query (M) and Power Pivot (DAX). Each lesson explains
// an idea, shows working code, then sets a task with a revealable answer.
// Prose follows the house style: code in `backticks`, no dashes,
// underscores or full stops.

export const TRACKS = [
  { id: 'vba', label: 'VBA macros', blurb: 'Automate Excel with Visual Basic for Applications', setup: 'Press `Alt` + `F11` to open the editor, then Insert › Module and paste the code\nRun it with `F5`, or from Developer › Macros\nSave the file as a macro enabled workbook (`.xlsm`)' },
  { id: 'pq', label: 'Power Query', blurb: 'Clean and reshape data with repeatable steps written in M', setup: 'Data › Get Data › From Other Sources › Blank Query, then Advanced Editor and paste the code\nClose & Load sends the result to a sheet, and Refresh reruns every step' },
  { id: 'dax', label: 'Power Pivot & DAX', blurb: 'Data model, relationships and measures for pivot tables', setup: 'Select your table and use Power Pivot › Add to Data Model\nCreate measures in Power Pivot › Measures › New Measure, then use them in a PivotTable built from the data model' },
];

export const LESSONS = [
  // ───────────── VBA ─────────────
  {
    id: 'vba01', track: 'vba', title: 'Your first macro',
    explain: 'A macro is a `Sub` procedure\nIt runs top to bottom and can read or change any cell\nThe macro recorder (Developer › Record Macro) writes VBA for you, which is a quick way to learn the object names',
    code: `Sub HelloWorkX()
    Range("J1").Value = "Report run on"
    Range("K1").Value = Date
    MsgBox "Done: " & Range("K1").Text
End Sub`,
    task: 'Change the macro so it also writes the number of orders into `L1`, using `WorksheetFunction.CountA` on column `A` minus the header',
    answer: `Sub HelloWorkX()
    Range("J1").Value = "Report run on"
    Range("K1").Value = Date
    Range("L1").Value = WorksheetFunction.CountA(Range("A:A")) - 1
End Sub`,
  },
  {
    id: 'vba02', track: 'vba', title: 'Variables and types',
    explain: 'Declare variables with `Dim` so typos are caught early\nPut `Option Explicit` at the top of every module to make declarations required\nCommon types are `Long` for whole numbers, `Double` for decimals, `String` and `Date`',
    code: `Option Explicit

Sub Totals()
    Dim lastRow As Long
    Dim total As Double
    lastRow = Cells(Rows.Count, "A").End(xlUp).Row
    total = WorksheetFunction.Sum(Range("C2:C" & lastRow))
    Range("J2").Value = total
End Sub`,
    task: 'Also store the average amount in a `Double` called `avgAmount` and write it to `J3`',
    answer: `Dim avgAmount As Double
avgAmount = WorksheetFunction.Average(Range("C2:C" & lastRow))
Range("J3").Value = avgAmount`,
  },
  {
    id: 'vba03', track: 'vba', title: 'Range and Cells',
    explain: '`Range("C2")` uses A1 addresses and `Cells(2, 3)` uses row and column numbers\n`Cells` is easier inside loops\n`.End(xlUp)` jumps to the last filled cell, the standard way to find the last row',
    code: `Sub FindLastRow()
    Dim lastRow As Long, lastCol As Long
    lastRow = Cells(Rows.Count, 1).End(xlUp).Row
    lastCol = Cells(1, Columns.Count).End(xlToLeft).Column
    MsgBox "Data is " & lastRow & " rows by " & lastCol & " columns"
End Sub`,
    task: 'Select the whole data block from `A1` to the last row and last column with one line',
    answer: `Range(Cells(1, 1), Cells(lastRow, lastCol)).Select`,
  },
  {
    id: 'vba04', track: 'vba', title: 'Loops',
    explain: '`For` loops walk through rows by number\n`For Each` walks through every cell in a range\nWriting to cells one at a time is slow on big sheets, so lesson 9 shows the faster array way',
    code: `Sub FlagBigOrders()
    Dim r As Long, lastRow As Long
    lastRow = Cells(Rows.Count, 1).End(xlUp).Row
    Cells(1, 10).Value = "big_order"
    For r = 2 To lastRow
        Cells(r, 10).Value = (Cells(r, 3).Value > 5000)
    Next r
End Sub`,
    task: 'Rewrite the loop with `For Each` over the range `C2:C` and last row, writing the flag one column to the right of column `I` using `Offset`',
    answer: `Dim c As Range
For Each c In Range("C2:C" & lastRow)
    c.Offset(0, 7).Value = (c.Value > 5000)
Next c`,
  },
  {
    id: 'vba05', track: 'vba', title: 'If and Select Case',
    explain: '`If … Then … ElseIf … Else … End If` handles yes or no rules\n`Select Case` is cleaner when one value has many possible outcomes',
    code: `Sub Bands()
    Dim r As Long
    For r = 2 To Cells(Rows.Count, 1).End(xlUp).Row
        Select Case Cells(r, 3).Value
            Case Is >= 8000: Cells(r, 10).Value = "High"
            Case Is >= 3000: Cells(r, 10).Value = "Mid"
            Case Else: Cells(r, 10).Value = "Low"
        End Select
    Next r
End Sub`,
    task: 'Colour the row red when the status in column `E` is Cancelled, using `If` and `Interior.Color`',
    answer: `If Cells(r, 5).Value = "Cancelled" Then
    Rows(r).Interior.Color = RGB(255, 199, 206)
End If`,
  },
  {
    id: 'vba06', track: 'vba', title: 'Custom worksheet functions',
    explain: 'A `Function` returns a value, so you can call it from a cell like any built in formula\nThis is called a user defined function or UDF',
    code: `Function WAPE(forecast As Range, actual As Range) As Double
    Dim i As Long, err As Double, tot As Double
    For i = 1 To actual.Cells.Count
        err = err + Abs(forecast.Cells(i).Value - actual.Cells(i).Value)
        tot = tot + actual.Cells(i).Value
    Next i
    If tot = 0 Then WAPE = 0 Else WAPE = err / tot
End Function`,
    task: 'Write a UDF called `FTE` that takes volume, AHT in seconds and productive hours, and returns volume times AHT divided by 3600 divided by hours',
    answer: `Function FTE(volume As Double, ahtSeconds As Double, hours As Double) As Double
    FTE = volume * ahtSeconds / 3600 / hours
End Function`,
  },
  {
    id: 'vba07', track: 'vba', title: 'Working with sheets',
    explain: 'Use `Worksheets("name")` to point at a sheet without selecting it\nAdding and naming sheets lets a macro build a full report',
    code: `Sub NewSummarySheet()
    Dim ws As Worksheet
    Application.DisplayAlerts = False
    On Error Resume Next
    Worksheets("Summary").Delete
    On Error GoTo 0
    Application.DisplayAlerts = True
    Set ws = Worksheets.Add(After:=Worksheets(Worksheets.Count))
    ws.Name = "Summary"
    ws.Range("A1").Value = "Region"
    ws.Range("B1").Value = "Revenue"
End Sub`,
    task: 'Loop through every sheet in the workbook and list their names in column `A` of Summary',
    answer: `Dim s As Worksheet, i As Long
i = 2
For Each s In ThisWorkbook.Worksheets
    Worksheets("Summary").Cells(i, 1).Value = s.Name
    i = i + 1
Next s`,
  },
  {
    id: 'vba08', track: 'vba', title: 'Dictionary for group totals',
    explain: 'A `Scripting.Dictionary` maps keys to values, which makes group by totals easy without formulas\n`.Exists` checks for a key, and `.Keys` and `.Items` return arrays',
    code: `Sub RevenueByRegion()
    Dim d As Object, r As Long, k As Variant, i As Long
    Set d = CreateObject("Scripting.Dictionary")
    For r = 2 To Cells(Rows.Count, 1).End(xlUp).Row
        d(Cells(r, 6).Value) = d(Cells(r, 6).Value) + Cells(r, 3).Value
    Next r
    i = 2
    For Each k In d.Keys
        Cells(i, 12).Value = k
        Cells(i, 13).Value = d(k)
        i = i + 1
    Next k
End Sub`,
    task: 'Change it to count orders per category instead of summing revenue per region',
    answer: `d(Cells(r, 7).Value) = d(Cells(r, 7).Value) + 1`,
  },
  {
    id: 'vba09', track: 'vba', title: 'Fast macros with arrays',
    explain: 'Reading a whole range into a `Variant` array and writing it back once is often 100 times faster than touching cells in a loop\nAlso turn off screen updating and automatic calculation while a long macro runs',
    code: `Sub FastFlags()
    Dim data As Variant, out() As Variant, r As Long, n As Long
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    n = Cells(Rows.Count, 1).End(xlUp).Row - 1
    data = Range("C2").Resize(n, 1).Value
    ReDim out(1 To n, 1 To 1)
    For r = 1 To n
        out(r, 1) = IIf(data(r, 1) > 5000, "big", "")
    Next r
    Range("J2").Resize(n, 1).Value = out
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
End Sub`,
    task: 'Read columns `C` and `D` together into one array and write price per unit (amount divided by units) to column `J`',
    answer: `data = Range("C2").Resize(n, 2).Value
For r = 1 To n
    If data(r, 2) <> 0 Then out(r, 1) = data(r, 1) / data(r, 2)
Next r`,
  },
  {
    id: 'vba10', track: 'vba', title: 'Error handling',
    explain: '`On Error GoTo label` jumps to a handler when something fails, so the macro can clean up and explain what went wrong\nAlways restore settings such as screen updating in the handler',
    code: `Sub SafeImport()
    On Error GoTo Failed
    Application.ScreenUpdating = False
    Workbooks.Open "C:\\data\\orders.xlsx"
    ' … work with the file …
Done:
    Application.ScreenUpdating = True
    Exit Sub
Failed:
    MsgBox "Import failed: " & Err.Description, vbExclamation
    Resume Done
End Sub`,
    task: 'Add a check that shows a message and exits early when the active sheet has no data in `A2`',
    answer: `If IsEmpty(Range("A2").Value) Then
    MsgBox "No data found on " & ActiveSheet.Name
    Exit Sub
End If`,
  },
  {
    id: 'vba11', track: 'vba', title: 'Events',
    explain: 'Event macros run on their own when something happens\nPut them in the sheet module (double click the sheet in the editor), not in a normal module\n`Worksheet_Change` fires when a user edits a cell',
    code: `Private Sub Worksheet_Change(ByVal Target As Range)
    If Intersect(Target, Range("C:C")) Is Nothing Then Exit Sub
    Application.EnableEvents = False
    Target.Offset(0, 7).Value = Now
    Application.EnableEvents = True
End Sub`,
    task: 'Use `Workbook_Open` in the `ThisWorkbook` module to activate the Summary sheet whenever the file opens',
    answer: `Private Sub Workbook_Open()
    Worksheets("Summary").Activate
End Sub`,
  },
  {
    id: 'vba12', track: 'vba', title: 'Automate a pivot and export',
    explain: 'Macros can build pivot tables and save reports, which turns a weekly manual task into one click\nThe pivot cache is the data snapshot, and the pivot table is the layout on top of it',
    code: `Sub BuildPivot()
    Dim pc As PivotCache, pt As PivotTable, ws As Worksheet
    Set ws = Worksheets.Add
    Set pc = ThisWorkbook.PivotCaches.Create(xlDatabase, Worksheets("orders").Range("A1").CurrentRegion)
    Set pt = pc.CreatePivotTable(ws.Range("A3"), "RevenuePivot")
    pt.PivotFields("region").Orientation = xlRowField
    pt.PivotFields("status").Orientation = xlColumnField
    pt.AddDataField pt.PivotFields("amount"), "Revenue", xlSum
End Sub`,
    task: 'Save a PDF of the pivot sheet next to the workbook, named with today’s date',
    answer: `ws.ExportAsFixedFormat xlTypePDF, ThisWorkbook.Path & "\\revenue_" & Format(Date, "yyyymmdd") & ".pdf"`,
  },

  // ───────────── Power Query ─────────────
  {
    id: 'pq01', track: 'pq', title: 'Load a table',
    explain: 'Every query is a list of steps\nEach step is a name and an expression, and `in` names the step to return\nThis is the M language behind the Power Query editor',
    code: `let
    Source = Excel.CurrentWorkbook(){[Name="orders"]}[Content],
    Typed = Table.TransformColumnTypes(Source, {{"date", type date}, {"amount", type number}, {"units", Int64.Type}})
in
    Typed`,
    task: 'Add a step that keeps only the `id`, `date`, `amount` and `region` columns',
    answer: `Kept = Table.SelectColumns(Typed, {"id", "date", "amount", "region"})`,
  },
  {
    id: 'pq02', track: 'pq', title: 'Filter rows',
    explain: '`Table.SelectRows` keeps rows where a function returns true\n`each` is short for a function of the current row, and `[column]` reads a field',
    code: `let
    Source = Excel.CurrentWorkbook(){[Name="orders"]}[Content],
    Delivered = Table.SelectRows(Source, each [status] = "Delivered" and [amount] > 1000)
in
    Delivered`,
    task: 'Keep rows whose region is North or South',
    answer: `Table.SelectRows(Source, each List.Contains({"North", "South"}, [region]))`,
  },
  {
    id: 'pq03', track: 'pq', title: 'Add columns',
    explain: '`Table.AddColumn` computes a new column for every row\nGive it a type as the last argument so later steps know what it holds',
    code: `let
    Source = Excel.CurrentWorkbook(){[Name="orders"]}[Content],
    Price = Table.AddColumn(Source, "price_per_unit", each [amount] / [units], type number),
    Month = Table.AddColumn(Price, "month", each Date.StartOfMonth([date]), type date)
in
    Month`,
    task: 'Add a column `size` that says Big when amount is over 5000 and Small otherwise',
    answer: `Table.AddColumn(Month, "size", each if [amount] > 5000 then "Big" else "Small", type text)`,
  },
  {
    id: 'pq04', track: 'pq', title: 'Group by',
    explain: '`Table.Group` is the Power Query version of a pivot or SQL `GROUP BY`\nList the key columns, then one aggregation per output column',
    code: `let
    Source = Excel.CurrentWorkbook(){[Name="orders"]}[Content],
    Grouped = Table.Group(Source, {"region"}, {
        {"orders", each Table.RowCount(_), Int64.Type},
        {"revenue", each List.Sum([amount]), type number}
    })
in
    Grouped`,
    task: 'Group by region and category, and add the average amount as `avg_amount`',
    answer: `Table.Group(Source, {"region", "category"}, {{"avg_amount", each List.Average([amount]), type number}})`,
  },
  {
    id: 'pq05', track: 'pq', title: 'Merge queries',
    explain: 'Merging joins two tables on matching keys, like `XLOOKUP` for whole tables or a SQL `JOIN`\nAfter the merge, expand the nested table column to pick the fields you need',
    code: `let
    Orders = Excel.CurrentWorkbook(){[Name="orders"]}[Content],
    Stock = Excel.CurrentWorkbook(){[Name="inventory"]}[Content],
    Merged = Table.NestedJoin(Orders, {"category"}, Stock, {"category"}, "inv", JoinKind.LeftOuter),
    Expanded = Table.ExpandTableColumn(Merged, "inv", {"stock"}, {"category_stock"})
in
    Expanded`,
    task: 'Change the merge so only orders with a matching category are kept',
    answer: `Table.NestedJoin(Orders, {"category"}, Stock, {"category"}, "inv", JoinKind.Inner)`,
  },
  {
    id: 'pq06', track: 'pq', title: 'Unpivot',
    explain: 'Reports often arrive wide, with one column per month\nUnpivoting turns them into a long table with one row per value, which pivots and formulas handle far better',
    code: `let
    Source = Excel.CurrentWorkbook(){[Name="op_wide"]}[Content],
    Long = Table.UnpivotOtherColumns(Source, {"line_id"}, "month", "budget")
in
    Long`,
    task: 'Turn the long table back into one column per month with `Table.Pivot`, summing budget',
    answer: `Table.Pivot(Long, List.Distinct(Long[month]), "month", "budget", List.Sum)`,
  },
  {
    id: 'pq07', track: 'pq', title: 'Append a folder of files',
    explain: 'Point Power Query at a folder and it combines every file in it\nDrop next month’s file into the folder, press Refresh, and the report updates',
    code: `let
    Files = Folder.Files("C:\\data\\weekly_actuals"),
    Csvs = Table.SelectRows(Files, each [Extension] = ".csv"),
    Parsed = Table.AddColumn(Csvs, "data", each Table.PromoteHeaders(Csv.Document([Content]))),
    Combined = Table.Combine(Parsed[data])
in
    Combined`,
    task: 'Keep the file name as a column called `source_file` before combining',
    answer: `Parsed = Table.AddColumn(Csvs, "data", each Table.AddColumn(Table.PromoteHeaders(Csv.Document([Content])), "source_file", (r) => [Name]))`,
  },
  {
    id: 'pq08', track: 'pq', title: 'Clean text and fill gaps',
    explain: 'Real exports have stray spaces, mixed case and blanks\nTransform steps fix them once and every refresh repeats the fix',
    code: `let
    Source = Excel.CurrentWorkbook(){[Name="orders"]}[Content],
    Trimmed = Table.TransformColumns(Source, {{"region", Text.Trim}, {"status", Text.Proper}}),
    Filled = Table.FillDown(Trimmed, {"fulfillment_center"}),
    NoBlanks = Table.ReplaceValue(Filled, null, 0, Replacer.ReplaceValue, {"units"})
in
    NoBlanks`,
    task: 'Remove duplicate rows based on the `id` column',
    answer: `Table.Distinct(NoBlanks, {"id"})`,
  },

  // ───────────── Power Pivot / DAX ─────────────
  {
    id: 'dax01', track: 'dax', title: 'The data model',
    explain: 'Power Pivot holds several tables in memory and links them with relationships, so one pivot can use fields from all of them without `VLOOKUP`\nThe usual shape is a star: a fact table of events (orders) surrounded by dimension tables (dates, products, regions)',
    code: `Orders[category]  →  Inventory[category]   (many to one)
Orders[date]      →  Calendar[Date]        (many to one)
Actuals[line_id]  →  PlanLines[id]         (many to one)`,
    task: 'Which table is the fact table in `Actuals` and `PlanLines`, and which side of the relationship is the one side',
    answer: `Actuals is the fact table (many rows per line)
PlanLines is the dimension, the one side, keyed by id`,
  },
  {
    id: 'dax02', track: 'dax', title: 'Your first measure',
    explain: 'A measure is a formula evaluated for each cell of a pivot, in that cell’s filter context\nAlways prefer measures to calculated columns for totals and ratios',
    code: `Revenue := SUM ( Orders[amount] )
Order Count := COUNTROWS ( Orders )
Avg Order := DIVIDE ( [Revenue], [Order Count] )`,
    task: 'Write a measure `Units` and a measure `Price per Unit` that reuses it',
    answer: `Units := SUM ( Orders[units] )
Price per Unit := DIVIDE ( [Revenue], [Units] )`,
  },
  {
    id: 'dax03', track: 'dax', title: 'Calculated columns',
    explain: 'A calculated column is computed once per row when data refreshes, and it can be used as a pivot field\nUse it for row level labels, and use measures for anything that aggregates',
    code: `Orders[Size] = IF ( Orders[amount] > 5000, "Big", "Small" )
Orders[Month] = FORMAT ( Orders[date], "YYYY-MM" )`,
    task: 'Add a column `Price` with amount divided by units, safe from division by zero',
    answer: `Orders[Price] = DIVIDE ( Orders[amount], Orders[units] )`,
  },
  {
    id: 'dax04', track: 'dax', title: 'CALCULATE',
    explain: '`CALCULATE` evaluates a measure with changed filters\nIt is the most important function in DAX: every “revenue for X” question uses it',
    code: `North Revenue := CALCULATE ( [Revenue], Orders[region] = "North" )
Delivered Revenue := CALCULATE ( [Revenue], Orders[status] = "Delivered" )`,
    task: 'Write `Delivered Share` as delivered revenue divided by all revenue',
    answer: `Delivered Share := DIVIDE ( [Delivered Revenue], [Revenue] )`,
  },
  {
    id: 'dax05', track: 'dax', title: 'ALL and percent of total',
    explain: '`ALL` removes filters from a table or column\nInside `CALCULATE` it gives the grand total, so you can show each row as a share',
    code: `All Revenue := CALCULATE ( [Revenue], ALL ( Orders ) )
Revenue Share := DIVIDE ( [Revenue], [All Revenue] )`,
    task: 'Show each category’s share of its region, keeping the region filter but removing the category filter',
    answer: `Share of Region := DIVIDE ( [Revenue], CALCULATE ( [Revenue], ALL ( Orders[category] ) ) )`,
  },
  {
    id: 'dax06', track: 'dax', title: 'FILTER for row conditions',
    explain: '`FILTER` walks a table row by row and keeps rows that pass a test\nUse it inside `CALCULATE` when the condition is more than a simple column equals value',
    code: `Big Order Revenue :=
CALCULATE (
    [Revenue],
    FILTER ( Orders, Orders[amount] > 5000 )
)`,
    task: 'Count orders where amount per unit is above 2000',
    answer: `Premium Orders := COUNTROWS ( FILTER ( Orders, DIVIDE ( Orders[amount], Orders[units] ) > 2000 ) )`,
  },
  {
    id: 'dax07', track: 'dax', title: 'Iterators: SUMX',
    explain: 'Functions ending in X (`SUMX`, `AVERAGEX`, `MAXX`) evaluate an expression for every row, then aggregate\nUse them when the value must be computed per row first',
    code: `Forecast Abs Error := SUMX ( Actuals, ABS ( Actuals[forecast_volume] - Actuals[actual_volume] ) )
WAPE := DIVIDE ( [Forecast Abs Error], SUM ( Actuals[actual_volume] ) )`,
    task: 'Write `Forecast Bias` as total forecast minus total actual, divided by total actual',
    answer: `Forecast Bias := DIVIDE ( SUM ( Actuals[forecast_volume] ) - SUM ( Actuals[actual_volume] ), SUM ( Actuals[actual_volume] ) )`,
  },
  {
    id: 'dax08', track: 'dax', title: 'RELATED across tables',
    explain: '`RELATED` reads a value from the one side of a relationship, like a lookup that follows the model\n`RELATEDTABLE` goes the other way and returns the matching many side rows',
    code: `Actuals[site_id] = RELATED ( PlanLines[site_id] )
PlanLines[weeks_of_actuals] = COUNTROWS ( RELATEDTABLE ( Actuals ) )`,
    task: 'On `Orders`, add the category stock from `Inventory` (assume one row per category in a Categories table)',
    answer: `Orders[category_stock] = RELATED ( Categories[stock] )`,
  },
  {
    id: 'dax09', track: 'dax', title: 'A calendar table',
    explain: 'Time intelligence needs a calendar table with one row per day and no gaps, marked as a date table\nRelate it to every date column in your facts',
    code: `Calendar =
ADDCOLUMNS (
    CALENDAR ( DATE ( 2025, 1, 1 ), DATE ( 2027, 12, 31 ) ),
    "Year", YEAR ( [Date] ),
    "Month", FORMAT ( [Date], "YYYY-MM" ),
    "Weekday", FORMAT ( [Date], "ddd" )
)`,
    task: 'Add a `Quarter` column that shows text like Q1',
    answer: `"Quarter", "Q" & QUARTER ( [Date] )`,
  },
  {
    id: 'dax10', track: 'dax', title: 'Time intelligence',
    explain: 'With a calendar table, DAX can shift periods for you\n`TOTALYTD` gives year to date, and `SAMEPERIODLASTYEAR` gives the same dates a year earlier',
    code: `Revenue YTD := TOTALYTD ( [Revenue], Calendar[Date] )
Revenue LY := CALCULATE ( [Revenue], SAMEPERIODLASTYEAR ( Calendar[Date] ) )
YoY % := DIVIDE ( [Revenue] - [Revenue LY], [Revenue LY] )`,
    task: 'Write `Revenue Last Month` with `DATEADD`',
    answer: `Revenue Last Month := CALCULATE ( [Revenue], DATEADD ( Calendar[Date], -1, MONTH ) )`,
  },
  {
    id: 'dax11', track: 'dax', title: 'Variables and readable measures',
    explain: '`VAR` names an intermediate result and `RETURN` gives the answer\nVariables are computed once, so they are faster and much easier to read',
    code: `Cost vs Plan % :=
VAR actualCost = SUM ( Actuals[cost_actual] )
VAR plannedCost = SUM ( Actuals[cost_planned] )
RETURN
    DIVIDE ( actualCost - plannedCost, plannedCost )`,
    task: 'Write `SL Attainment` as the share of rows where `sl_actual` is at least `sl_target`, using variables',
    answer: `SL Attainment :=
VAR met = COUNTROWS ( FILTER ( Actuals, Actuals[sl_actual] >= Actuals[sl_target] ) )
VAR allRows = COUNTROWS ( Actuals )
RETURN DIVIDE ( met, allRows )`,
  },
  {
    id: 'dax12', track: 'dax', title: 'KPIs and ranking',
    explain: 'A KPI compares a measure with a target and shows a status icon in the pivot\n`RANKX` ranks items by a measure, which is handy for top N reports',
    code: `Revenue Target := 1.1 * [Revenue LY]
Region Rank := RANKX ( ALL ( Orders[region] ), [Revenue] )`,
    task: 'Write a measure that shows revenue only for the top 3 categories and blank for the rest',
    answer: `Top 3 Revenue :=
IF ( RANKX ( ALL ( Orders[category] ), [Revenue] ) <= 3, [Revenue] )`,
  },
];
