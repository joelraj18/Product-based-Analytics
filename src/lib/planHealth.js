// Turns plan output into status flags and plain-language insights.
export const lineStatus = (p) => {
  if (!p.sim.length) return { status: 'info', label: 'No data' };
  const uncovered = p.sim.filter(r => r.uncoveredFTE > 1).length;
  const otWeeks = p.sim.filter(r => r.otHours > 0).length;
  if (uncovered > 0) return { status: 'critical', label: `${uncovered} wk short` };
  if (otWeeks > 0) return { status: 'warning', label: `${otWeeks} wk on OT` };
  const excess = p.sim.filter(r => r.gapPct > 15).length;
  if (excess > 2) return { status: 'warning', label: `${excess} wk >15% over` };
  return { status: 'good', label: 'Covered' };
};

export const planInsights = (plans, fmtCost) => {
  const out = [];
  plans.forEach(p => {
    if (p.error) { out.push({ status: 'warning', text: `${p.line.name}: ${p.error}.` }); return; }
    const lead = p.line.trainingWeeks + p.line.rampWeeks;
    const short = p.sim.map((r, i) => ({ r, i })).filter(({ r }) => r.uncoveredFTE > 1);
    if (short.length) {
      const first = short[0];
      const inLead = first.i < lead;
      out.push({
        status: 'critical',
        text: `${p.line.name}: short ${first.r.uncoveredFTE.toFixed(1)} FTE in week of ${p.weeks[first.i]} after max OT\n${inLead ? 'It is inside the hiring lead time, so cover it with vendor flex, cross skilling or a leave blackout' : 'Add a hiring class or start one earlier'}`,
      });
    }
    const ot = p.sim.reduce((s, r) => s + r.otHours, 0);
    if (ot > 0) {
      out.push(p.line.costModel === 'perUnit'
        ? { status: 'warning', text: `${p.line.name}: vendor needs about ${Math.round(ot).toLocaleString()} extra hours of flex\nConfirm capacity in the vendor staffing review, billed per unit` }
        : { status: 'warning', text: `${p.line.name}: ${Math.round(ot).toLocaleString()} OT hours planned, costing ${fmtCost(p.costs.reduce((s, c) => s + c.overtime, 0))}` });
    }
    const temps = p.temps ? p.temps.reduce((a, b) => a + b, 0) : 0;
    if (temps > 0) {
      const startIdx = p.temps.findIndex(v => v > 0);
      out.push({ status: 'info', text: `${p.line.name}: ${temps} seasonal hire(s) needed for the peak\nStart the class by the week of ${p.weeks[startIdx]}` });
    }
    const w = p.forecast && p.forecast.accuracy && p.forecast.accuracy.wape;
    if (Number.isFinite(w) && w > 10) out.push({ status: 'warning', text: `${p.line.name}: forecast backtest WAPE is ${w.toFixed(1)}%\nReview the drivers before committing the plan` });
  });
  return out;
};
