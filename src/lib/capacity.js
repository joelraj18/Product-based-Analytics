// Long-term capacity model: weekly volume → workload → required FTE, then a
// headcount roll-forward with attrition, hiring classes, training and ramp.

export const DEFAULT_LINE_PARAMS = {
  aht: 360,               // seconds per contact
  npt: 10,                // % of on-shift time that is non-productive (meetings, coaching, system downtime)
  shrinkage: 30,          // % of paid time lost to leave, absenteeism, breaks, training
  occupancy: 85,          // % target occupancy while productive
  hoursPerWeek: 40,       // paid hours per FTE per week
  attritionMonthly: 3,    // % of headcount leaving per month
  trainingWeeks: 3,       // weeks in classroom, zero productivity
  rampWeeks: 4,           // nesting weeks to reach full productivity
  rampStart: 50,          // % productivity in first nesting week
  currentHC: 100,
  tempContractWeeks: 4,   // weeks a seasonal/temp hire stays after reaching full productivity
  maxOtPct: 10,           // OT allowed as % of tenured hours
  bufferPct: 2,           // plan to required × (1 + buffer)
  costModel: 'hourly',    // 'hourly' (in-house) or 'perUnit' (vendor)
  costPerHour: 450,
  costPerUnit: 60,
  otMultiplier: 1.5,
  hireCost: 25000,        // recruiting + onboarding per hire
  slTarget: 80,
  slSeconds: 30,
  type: 'realtime',       // realtime (Erlang C intraday) or deferred (workload)
};

export const withDefaults = (line) => ({ ...DEFAULT_LINE_PARAMS, ...line });

const n = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

export const productiveHoursPerFTE = (p) =>
  n(p.hoursPerWeek) * (1 - n(p.shrinkage) / 100) * (1 - n(p.npt) / 100);

export const workloadHours = (volume, aht) => (n(volume) * n(aht)) / 3600;

export const requiredFTE = (volume, params) => {
  const p = withDefaults(params);
  const prodHrs = productiveHoursPerFTE(p);
  const occ = n(p.occupancy, 85) / 100;
  if (prodHrs <= 0 || occ <= 0) return 0;
  return workloadHours(volume, p.aht) / occ / prodHrs;
};

export const weeklyAttrition = (monthlyPct) => 1 - (1 - n(monthlyPct) / 100) ** (12 / 52);

// Productivity (0–1) of a hire `age` weeks after their start week.
export const cohortProductivity = (age, p) => {
  const training = n(p.trainingWeeks);
  const ramp = n(p.rampWeeks);
  if (age < training) return 0;
  if (ramp <= 0) return 1;
  const nestingWeek = age - training;
  if (nestingWeek >= ramp) return 1;
  const start = n(p.rampStart, 50) / 100;
  return start + ((1 - start) * nestingWeek) / ramp;
};

// hires: permanent hires starting each week; temps: seasonal hires starting
// each week who leave `tempContractWeeks` after they are fully ramped.
export const simulatePlan = (params, required, hires = [], temps = []) => {
  const p = withDefaults(params);
  const attr = weeklyAttrition(p.attritionMonthly);
  const prodHrs = productiveHoursPerFTE(p);
  const tempStay = n(p.trainingWeeks) + n(p.rampWeeks) + n(p.tempContractWeeks);
  let tenured = n(p.currentHC);
  let cohorts = [];
  return required.map((req, t) => {
    const newHires = Math.max(0, Math.round(n(hires[t])));
    const newTemps = Math.max(0, Math.round(n(temps[t])));
    if (newHires) cohorts.push({ start: t, count: newHires, temp: false });
    if (newTemps) cohorts.push({ start: t, count: newTemps, temp: true });

    // Temps roll off at contract end; that is planned release, not attrition.
    const released = cohorts.filter(c => c.temp && t - c.start >= tempStay).reduce((s, c) => s + c.count, 0);
    cohorts = cohorts.filter(c => !(c.temp && t - c.start >= tempStay));

    const leavers = tenured * attr + cohorts.reduce((s, c) => s + c.count * attr, 0);
    tenured *= 1 - attr;
    cohorts = cohorts.map(c => ({ ...c, count: c.count * (1 - attr) }));

    // Graduate fully ramped permanent cohorts into tenured.
    cohorts = cohorts.filter(c => {
      if (!c.temp && cohortProductivity(t - c.start, p) >= 1) { tenured += c.count; return false; }
      return true;
    });

    const inTraining = cohorts.filter(c => t - c.start < p.trainingWeeks).reduce((s, c) => s + c.count, 0);
    const tempHC = cohorts.filter(c => c.temp).reduce((s, c) => s + c.count, 0);
    const nesting = cohorts.filter(c => !c.temp && t - c.start >= p.trainingWeeks).reduce((s, c) => s + c.count, 0);
    const effective = tenured + cohorts.reduce((s, c) => s + c.count * cohortProductivity(t - c.start, p), 0);
    const totalHC = tenured + cohorts.reduce((s, c) => s + c.count, 0);
    const target = req * (1 + n(p.bufferPct) / 100);
    const gap = effective - req;
    const deficit = Math.max(0, -gap);
    const otCapHours = tenured * n(p.hoursPerWeek) * (n(p.maxOtPct) / 100);
    const otHours = Math.min(deficit * prodHrs, otCapHours);
    const uncoveredFTE = prodHrs > 0 ? Math.max(0, deficit - otHours / prodHrs) : deficit;
    return {
      week: t,
      required: req,
      target,
      tenured,
      inTraining,
      nesting,
      tempHC,
      totalHC,
      effective,
      gap,
      gapPct: req > 0 ? (gap / req) * 100 : 0,
      hires: newHires,
      temps: newTemps,
      leavers,
      released,
      otHours,
      uncoveredFTE,
      excessFTE: Math.max(0, gap),
    };
  });
};

// Requirement sustained for `window` consecutive weeks from t — the level
// worth staffing with permanent hires. Spikes above it go to temps/OT.
export const sustainedRequirement = (required, window = 10) =>
  required.map((_, t) => Math.min(...required.slice(t, Math.min(required.length, t + window))));

// Greedy plan. Permanent classes cover the sustained base; temp classes cover
// peaks. Inside the hiring lead time, overtime is used before temps because a
// class started now would mostly sit in training while the need passes.
export const recommendHires = (params, required, { minClass = 1 } = {}) => {
  const p = withDefaults(params);
  const lead = n(p.trainingWeeks) + n(p.rampWeeks);
  const attr = weeklyAttrition(p.attritionMonthly);
  const buffer = 1 + n(p.bufferPct) / 100;
  const prodHrs = productiveHoursPerFTE(p);
  const hires = Array(required.length).fill(0);
  const temps = Array(required.length).fill(0);
  const fill = (targets, bucket, otFirst) => {
    for (let t = 0; t < required.length; t++) {
      const sim = simulatePlan(p, required, hires, temps);
      let shortfall = targets[t] - sim[t].effective;
      if (otFirst && t < lead && prodHrs > 0) shortfall -= sim[t].otHours / prodHrs;
      if (shortfall <= 0.5) continue;
      const start = Math.max(0, t - lead);
      const prodAtT = cohortProductivity(t - start, p) * (1 - attr) ** (t - start + 1);
      if (prodAtT <= 0) continue;
      bucket[start] += Math.max(minClass, Math.ceil(shortfall / prodAtT));
    }
  };
  fill(sustainedRequirement(required).map(v => v * buffer), hires, false);
  fill(required.map(v => v * buffer), temps, true);
  return { hires, temps };
};

export const planSummary = (rows) => {
  if (!rows.length) return { avgGap: 0, minGapPct: 0, shortWeeks: 0, totalHires: 0, totalTemps: 0, totalOtHours: 0, peakRequired: 0, endHC: 0 };
  return {
    avgGap: rows.reduce((s, r) => s + r.gap, 0) / rows.length,
    minGapPct: Math.min(...rows.map(r => r.gapPct)),
    shortWeeks: rows.filter(r => r.uncoveredFTE > 0.5).length,
    totalHires: rows.reduce((s, r) => s + r.hires, 0),
    totalTemps: rows.reduce((s, r) => s + r.temps, 0),
    totalOtHours: rows.reduce((s, r) => s + r.otHours, 0),
    peakRequired: Math.max(...rows.map(r => r.required)),
    endHC: rows[rows.length - 1].totalHC,
  };
};
