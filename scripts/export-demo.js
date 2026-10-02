#!/usr/bin/env node
// Exports the WorkX demo dataset, the 26-week plan built from it, and the
// headline numbers behind FINDINGS.md into demo-data/. Uses the app's own
// libraries (src/lib, src/data) so the numbers match what the UI shows.
//
//   npm run export-demo
//
// The demo data is anchored to the current week, so re-running on a later
// date shifts dates but keeps the same shape.

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'demo-data');

// Transpile ES-module sources under src/ to CommonJS on require.
const defaultJs = require.extensions['.js'];
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(SRC)) return defaultJs(module, filename);
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  return module._compile(code, filename);
};

const seed = require(path.join(SRC, 'data/seed.js'));
const { buildPlan, planToRows, peakWeeks } = require(path.join(SRC, 'lib/planEngine.js'));
const { deriveOpTargets, monthlyTotals } = require(path.join(SRC, 'lib/opTargets.js'));
const { lineStatus, planInsights } = require(path.join(SRC, 'lib/planHealth.js'));
const { kpiRollup, pareto } = require(path.join(SRC, 'lib/kpis.js'));
const { requiredAgents } = require(path.join(SRC, 'lib/erlang.js'));
const { toCSV } = require(path.join(SRC, 'lib/csv.js'));
const { formatCurrency } = require(path.join(SRC, 'lib/format.js'));

const round = (v, d = 1) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

fs.mkdirSync(OUT, { recursive: true });
const written = [];
const writeCSV = (name, rows, columns) => {
  fs.writeFileSync(path.join(OUT, name), `${toCSV(rows, columns)}\n`);
  written.push(`${name} (${rows.length} rows)`);
};

// ---------- raw demo datasets ----------
const settings = seed.DEFAULT_SETTINGS;
const lines = seed.seedLines();
const sites = seed.seedSites();
const history = seed.seedVolumeHistory(lines);
const events = seed.seedEvents();
const actuals = seed.seedActuals(lines, history);
const defects = seed.seedDefects(lines);
const risks = seed.seedRisks();

writeCSV('orders.csv', seed.seedOrders());
writeCSV('inventory.csv', seed.seedInventory());
writeCSV('sites.csv', sites);
writeCSV('plan_lines.csv', lines.map(({ baseWeekly, ...l }) => l));
writeCSV('volume_history_daily.csv', history, ['date', 'line_id', 'volume', 'aht']);
writeCSV('events.csv', events);
writeCSV('actuals_weekly.csv', actuals);
writeCSV('defects.csv', defects);
writeCSV('risks.csv', risks);
writeCSV('tasks.csv', seed.seedTasks());

// ---------- plan built from the demo data ----------
const plan = buildPlan({ lines, history, settings, events, hiresPlan: {} });
writeCSV('capacity_plan_weekly.csv', planToRows(plan.plans));

const opTargets = deriveOpTargets(monthlyTotals(plan.plans));
writeCSV('op_targets.csv', opTargets);
const opByMonth = Object.fromEntries(opTargets.map(o => [o.month, o]));
const budget = monthlyTotals(plan.plans).map(m => {
  const o = opByMonth[m.month] || {};
  return {
    month: m.month,
    volume: Math.round(m.volume),
    base_cost: Math.round(m.base),
    overtime_cost: Math.round(m.overtime),
    hiring_cost: Math.round(m.hiring),
    total_cost: Math.round(m.total),
    cost_per_contact: round(m.volume ? m.total / m.volume : 0, 2),
    op1_cost: o.op1_cost ?? '',
    op2_cost: o.op2_cost ?? '',
    var_vs_op1_pct: o.op1_cost ? round((100 * (m.total - o.op1_cost)) / o.op1_cost) : '',
    var_vs_op2_pct: o.op2_cost ? round((100 * (m.total - o.op2_cost)) / o.op2_cost) : '',
  };
});
writeCSV('budget_monthly.csv', budget);

writeCSV('forecast_accuracy.csv', plan.plans.map(p => ({
  line_id: p.line.id,
  line_name: p.line.name,
  method: p.forecast.method,
  holdout_weeks: p.forecast.accuracy.holdout,
  wape_pct: round(p.forecast.accuracy.wape, 2),
  mape_pct: round(p.forecast.accuracy.mape, 2),
  bias_pct: round(p.forecast.accuracy.bias, 2),
})));

// ---------- scenario: +20% volume against the current hiring plan ----------
const frozen = Object.fromEntries(plan.plans.map(p => [p.line.id, {
  perm: Object.fromEntries(p.weeks.map((w, i) => [w, p.hires[i]])),
  temp: Object.fromEntries(p.weeks.map((w, i) => [w, p.temps[i]])),
}]));
const summarize = (pl) => ({
  peak_required_fte: round(Math.max(...pl.totals.map(t => t.required))),
  weeks_short_after_ot: pl.totals.filter(t => t.uncoveredFTE > 1).length,
  uncovered_fte_weeks: round(sum(pl.totals.map(t => t.uncoveredFTE))),
  ot_hours: Math.round(sum(pl.totals.map(t => t.otHours))),
  variable_cost: Math.round(sum(pl.totals.map(t => t.cost))),
  perm_hires: sum(pl.totals.map(t => t.hires)),
  temp_hires: sum(pl.totals.map(t => t.temps)),
});
const scenarioArgs = { lines, history, settings, events, scenario: { volumePct: 20 } };
const base = summarize(plan);
const stressed = summarize(buildPlan({ ...scenarioArgs, hiresPlan: frozen }));
const replanned = summarize(buildPlan({ ...scenarioArgs, hiresPlan: {} }));
writeCSV('scenario_volume_plus20.csv', Object.keys(base).map(k => ({
  metric: k,
  baseline: base[k],
  scenario_current_hiring_plan: stressed[k],
  scenario_replanned: replanned[k],
})));

// ---------- headline numbers for FINDINGS.md ----------
const occupancyCheck = plan.plans.filter(p => p.line.type === 'realtime').map(p => {
  const i = p.volumes.indexOf(Math.max(...p.volumes));
  const L = p.line;
  let agentHours = 0;
  seed.DOW_SHARE.forEach((share, d) => {
    seed.intradayProfile(L.type, d >= 5).forEach(h => {
      agentHours += requiredAgents({ volume: p.volumes[i] * share * h, aht: L.aht, interval: 3600, slTarget: L.slTarget / 100, slSeconds: L.slSeconds, maxOccupancy: 0.95 }).agents;
    });
  });
  const workload = (p.volumes[i] * L.aht) / 3600;
  return { line_id: L.id, peak_week: p.weeks[i], planned_occupancy_pct: L.occupancy, erlang_implied_occupancy_pct: round((100 * workload) / agentHours) };
});

const lastWeeks = [...new Set(actuals.map(a => a.week_start))].sort().slice(-13);
const kpi13 = kpiRollup(actuals.filter(a => lastWeeks.includes(a.week_start)));
const totalCost = sum(plan.totals.map(t => t.cost));
const opCovered = budget.filter(b => b.op2_cost !== '');

const summary = {
  exported_at: new Date().toISOString(),
  plan_horizon: { first_week: plan.totals[0].weekStart, last_week: plan.totals[plan.totals.length - 1].weekStart, weeks: plan.totals.length },
  currency: settings.currency,
  lines: plan.plans.map(p => ({
    line_id: p.line.id,
    name: p.line.name,
    site: (sites.find(s => s.id === p.line.siteId) || {}).name,
    type: p.line.type,
    cost_model: p.line.costModel,
    required_fte_week1: round(p.sim[0].required),
    paid_hc_week1: round(p.sim[0].totalHC),
    peak_required_fte: round(p.summary.peakRequired),
    perm_hires: p.summary.totalHires,
    temp_hires: p.summary.totalTemps,
    ot_hours: Math.round(p.summary.totalOtHours),
    weeks_over_15pct: p.sim.filter(r => r.gapPct > 15).length,
    status: lineStatus(p),
    forecast_method: p.forecast.method,
    forecast_wape_pct: round(p.forecast.accuracy.wape, 2),
    variable_cost: Math.round(sum(p.costs.map(c => c.total))),
  })),
  totals: {
    peak_weeks: peakWeeks(plan.totals, 4),
    peak_required_fte: base.peak_required_fte,
    required_fte_week1: round(plan.totals[0].required),
    perm_hires: base.perm_hires,
    temp_hires: base.temp_hires,
    ot_hours: base.ot_hours,
    variable_cost: totalCost,
    variable_cost_fmt: formatCurrency(totalCost, settings.currency),
    vs_op1_pct: round((100 * (sum(opCovered.map(b => b.total_cost)) - sum(opCovered.map(b => b.op1_cost)))) / sum(opCovered.map(b => b.op1_cost))),
    vs_op2_pct: round((100 * (sum(opCovered.map(b => b.total_cost)) - sum(opCovered.map(b => b.op2_cost)))) / sum(opCovered.map(b => b.op2_cost))),
    cost_per_contact: round(totalCost / sum(plan.totals.map(t => t.volume)), 2),
  },
  occupancy_check: occupancyCheck,
  scenario_volume_plus20: { baseline: base, current_hiring_plan: stressed, replanned },
  kpis_last_13_weeks: {
    wape_pct: round(kpi13.wape, 2),
    bias_pct: round(kpi13.bias, 2),
    service_level_pct: round(kpi13.sl),
    sl_target_pct: round(kpi13.slTarget),
    sl_weeks_met_pct: round(kpi13.slAttainment, 0),
    occupancy_pct: round(kpi13.occupancy),
    hc_adherence_pct: round(kpi13.hcAdherence),
    shrinkage_vs_plan_pts: round(kpi13.shrinkVar),
    cost_vs_plan_pct: round(kpi13.costVar),
  },
  defect_pareto: pareto(defects).map(p => ({ ...p, pct: round(p.pct, 0), cumPct: round(p.cumPct, 0) })),
  open_risks: risks.filter(r => !['Mitigated', 'Closed'].includes(r.status)).map(r => ({ id: r.id, title: r.title, score: r.likelihood * r.impact, owner: r.owner })),
  insights: planInsights(plan.plans, v => formatCurrency(v, settings.currency)),
};
fs.writeFileSync(path.join(OUT, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
written.push('summary.json');

console.log(`Wrote ${written.length} files to demo-data/:\n  ${written.join('\n  ')}`);
