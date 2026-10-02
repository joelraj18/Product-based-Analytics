import { weekStart } from './dates';
import { forecastSeries } from './forecast';
import { requiredFTE, simulatePlan, recommendHires, planSummary, withDefaults } from './capacity';
import { costRows } from './budget';

// Daily history rows → { [lineId]: { weeks: [...], values: [...], aht: [...] } }
// Partial weeks at either end are dropped so they don't distort the forecast.
export const weeklySeries = (history) => {
  const acc = {};
  history.forEach(r => {
    const vol = Number(r.volume);
    if (!r.line_id || !r.date || !Number.isFinite(vol)) return;
    const ws = weekStart(r.date);
    const line = acc[r.line_id] || (acc[r.line_id] = {});
    const w = line[ws] || (line[ws] = { volume: 0, ahtWeighted: 0, days: 0 });
    w.volume += vol;
    w.ahtWeighted += (Number(r.aht) || 0) * vol;
    w.days += 1;
  });
  const out = {};
  Object.entries(acc).forEach(([lineId, weeks]) => {
    const keys = Object.keys(weeks).sort().filter(k => weeks[k].days === 7);
    out[lineId] = {
      weeks: keys,
      values: keys.map(k => weeks[k].volume),
      aht: keys.map(k => (weeks[k].volume ? weeks[k].ahtWeighted / weeks[k].volume : 0)),
    };
  });
  return out;
};

// Scenario levers: % changes for volume/AHT, point changes for shrinkage/attrition.
export const applyScenario = (line, s = {}) => ({
  ...line,
  aht: line.aht * (1 + (s.ahtPct || 0) / 100),
  shrinkage: Math.min(90, Math.max(0, line.shrinkage + (s.shrinkagePts || 0))),
  attritionMonthly: Math.max(0, line.attritionMonthly + (s.attritionPts || 0)),
});

export const buildLinePlan = ({ line, series, settings, events, hiresPlan, scenario }) => {
  const params = withDefaults(scenario ? applyScenario(line, scenario) : line);
  const horizon = settings.horizonWeeks;
  if (!series || series.values.length < 4) {
    return { line: params, error: 'Not enough history (need at least 4 complete weeks)', weeks: [], volumes: [], required: [], sim: [], costs: [], summary: planSummary([]) };
  }
  const lineEvents = events.filter(e => e.lineId === 'all' || e.lineId === line.id);
  const fc = forecastSeries({
    weeks: series.weeks, values: series.values, horizon,
    method: settings.forecastMethod, events: lineEvents,
    season: 52,
  });
  const volumes = fc.values.map(v => Math.round(v * (1 + ((scenario && scenario.volumePct) || 0) / 100)));
  const required = volumes.map(v => requiredFTE(v, params));
  // Saved plans are keyed by week start so they survive the horizon rolling forward.
  const saved = hiresPlan && hiresPlan[line.id];
  let hires;
  let temps;
  if (saved) {
    hires = fc.weeks.map(w => Number(saved.perm && saved.perm[w]) || 0);
    temps = fc.weeks.map(w => Number(saved.temp && saved.temp[w]) || 0);
  } else {
    ({ hires, temps } = recommendHires(params, required));
  }
  const sim = simulatePlan(params, required, hires, temps);
  const costs = costRows(params, sim, fc.weeks, volumes);
  return {
    line: params,
    forecast: fc,
    weeks: fc.weeks,
    volumes,
    required,
    hires,
    temps,
    hiresSource: saved ? 'saved' : 'recommended',
    sim,
    costs,
    summary: planSummary(sim),
  };
};

export const buildPlan = ({ lines, history, settings, events, hiresPlan, scenario }) => {
  const series = weeklySeries(history);
  const plans = lines.map(line => buildLinePlan({ line, series: series[line.id], settings, events, hiresPlan, scenario }));
  return { series, plans, totals: aggregate(plans) };
};

// Week-by-week totals across all lines.
export const aggregate = (plans) => {
  const ok = plans.filter(p => p.weeks.length);
  if (!ok.length) return [];
  return ok[0].weeks.map((ws, i) => {
    const row = { weekStart: ws, volume: 0, required: 0, effective: 0, totalHC: 0, gap: 0, hires: 0, temps: 0, otHours: 0, uncoveredFTE: 0, cost: 0 };
    ok.forEach(p => {
      const s = p.sim[i];
      if (!s) return;
      row.volume += p.volumes[i];
      row.required += s.required;
      row.effective += s.effective;
      row.totalHC += s.totalHC;
      row.gap += s.gap;
      row.hires += s.hires;
      row.temps += s.temps;
      row.otHours += s.otHours;
      row.uncoveredFTE += s.uncoveredFTE;
      row.cost += p.costs[i].total;
    });
    row.gapPct = row.required ? (row.gap / row.required) * 100 : 0;
    return row;
  });
};

// Flat weekly plan rows for CSV export and SQL.
export const planToRows = (plans) => plans.flatMap(p => p.weeks.map((ws, i) => ({
  week_start: ws,
  line_id: p.line.id,
  line_name: p.line.name,
  forecast_volume: p.volumes[i],
  aht_sec: Math.round(p.line.aht),
  required_fte: Number(p.sim[i].required.toFixed(1)),
  effective_fte: Number(p.sim[i].effective.toFixed(1)),
  total_hc: Number(p.sim[i].totalHC.toFixed(1)),
  in_training: Number(p.sim[i].inTraining.toFixed(1)),
  gap_fte: Number(p.sim[i].gap.toFixed(1)),
  hires: p.sim[i].hires,
  temp_hires: p.sim[i].temps,
  temp_hc: Number(p.sim[i].tempHC.toFixed(1)),
  ot_hours: Math.round(p.sim[i].otHours),
  uncovered_fte: Number(p.sim[i].uncoveredFTE.toFixed(1)),
  variable_cost: Math.round(p.costs[i].total),
})));

// Peak weeks = top-N forecast volume weeks across the horizon.
export const peakWeeks = (totals, n = 4) =>
  [...totals].sort((a, b) => b.volume - a.volume).slice(0, n).map(r => r.weekStart).sort();
