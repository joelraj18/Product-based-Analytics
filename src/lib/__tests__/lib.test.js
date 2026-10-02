import { parseCSV, toCSV } from '../csv';
import { requiredAgents, serviceLevel, erlangC } from '../erlang';
import { requiredFTE, simulatePlan, recommendHires, cohortProductivity, withDefaults } from '../capacity';
import { holtWinters, seasonalNaive, backtest, applyEvents } from '../forecast';
import { mape, wape, bias, toNumber, isMissing, median } from '../stats';
import { weekStart } from '../dates';
import { formatCurrency } from '../format';
import { buildPlan, weeklySeries } from '../planEngine';
import { seedLines, seedVolumeHistory, seedEvents, DEFAULT_SETTINGS } from '../../data/seed';

describe('csv', () => {
  test('keeps empty fields in position', () => {
    const rows = parseCSV('a,b,c\n1,,3\n,2,\n');
    expect(rows).toEqual([{ a: 1, b: '', c: 3 }, { a: '', b: 2, c: '' }]);
  });
  test('handles quotes, commas and newlines inside quotes', () => {
    const rows = parseCSV('name,note\n"Doe, J","said ""hi""\nthen left"\n');
    expect(rows[0]).toEqual({ name: 'Doe, J', note: 'said "hi"\nthen left' });
  });
  test('round-trips through toCSV, preserving zero', () => {
    const data = [{ id: 'A', qty: 0, note: 'x,y' }, { id: 'B', qty: 5, note: '' }];
    expect(parseCSV(toCSV(data))).toEqual(data);
  });
  test('keeps leading-zero codes as text', () => {
    expect(parseCSV('zip\n00123')[0].zip).toBe('00123');
  });
});

describe('stats', () => {
  test('zero is a number, not missing', () => {
    expect(toNumber(0)).toBe(0);
    expect(toNumber('₹1,299')).toBe(1299);
    expect(isMissing(0)).toBe(false);
    expect(isMissing('')).toBe(true);
    expect(Number.isNaN(toNumber('High'))).toBe(true);
    expect(Number.isNaN(toNumber('ORD-10000'))).toBe(true);
    expect(Number.isNaN(toNumber('FC-3'))).toBe(true);
    expect(toNumber('(150)')).toBe(-150);
    expect(toNumber('Rs. 2,500.50')).toBe(2500.5);
    expect(toNumber('-12.5%')).toBe(-12.5);
  });
  test('accuracy metrics', () => {
    expect(mape([100, 200], [110, 180])).toBeCloseTo(10);
    expect(wape([100, 200], [110, 180])).toBeCloseTo(10);
    expect(bias([100, 100], [110, 110])).toBeCloseTo(10);
    expect(median([3, 1, 2, 10])).toBe(2.5);
  });
});

describe('erlang C', () => {
  test('textbook case: 100 contacts / 30 min, AHT 180s, 80/20 → 14 agents (SL 88.8%)', () => {
    expect(erlangC(13, 10)).toBeGreaterThan(0);
    expect(serviceLevel(13, 100, 180, 20)).toBeCloseTo(0.7956, 3);
    expect(serviceLevel(14, 100, 180, 20)).toBeCloseTo(0.8884, 3);
    expect(requiredAgents({ volume: 100, aht: 180, interval: 1800, slTarget: 0.8, slSeconds: 20 }).agents).toBe(14);
  });
  test('zero volume needs zero agents', () => {
    expect(requiredAgents({ volume: 0, aht: 180 }).agents).toBe(0);
  });
});

describe('capacity', () => {
  test('required FTE from volume, AHT, shrinkage, NPT, occupancy', () => {
    // 3600 contacts × 360s = 360 h; productive hrs/FTE = 40 × 0.7 × 0.9 = 25.2; / 0.85 occ
    const fte = requiredFTE(3600, { aht: 360, shrinkage: 30, npt: 10, occupancy: 85, hoursPerWeek: 40 });
    expect(fte).toBeCloseTo(360 / 0.85 / 25.2, 5);
  });
  test('ramp curve', () => {
    const p = withDefaults({ trainingWeeks: 2, rampWeeks: 4, rampStart: 50 });
    expect(cohortProductivity(0, p)).toBe(0);
    expect(cohortProductivity(2, p)).toBe(0.5);
    expect(cohortProductivity(6, p)).toBe(1);
  });
  test('attrition erodes headcount and recommended hires close later gaps', () => {
    const params = withDefaults({ currentHC: 100, attritionMonthly: 4, bufferPct: 0 });
    const required = Array(26).fill(100);
    const noHire = simulatePlan(params, required, []);
    expect(noHire[25].effective).toBeLessThan(85);
    const { hires, temps } = recommendHires(params, required);
    expect(temps.every(v => v === 0)).toBe(true); // flat demand needs no temps
    const plan = simulatePlan(params, required, hires, temps);
    const lead = params.trainingWeeks + params.rampWeeks;
    plan.slice(lead).forEach(r => expect(r.effective).toBeGreaterThan(98));
  });
});

test('peaks are covered by temps who roll off afterwards', () => {
  const params = withDefaults({ currentHC: 100, attritionMonthly: 0, bufferPct: 0, trainingWeeks: 2, rampWeeks: 2, tempContractWeeks: 4 });
  const required = Array(30).fill(100).map((v, t) => (t >= 10 && t < 14 ? 140 : v));
  const { hires, temps } = recommendHires(params, required);
  expect(hires.reduce((a, b) => a + b, 0)).toBe(0);
  expect(temps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(40);
  const plan = simulatePlan(params, required, hires, temps);
  [10, 11, 12, 13].forEach(t => expect(plan[t].effective).toBeGreaterThanOrEqual(140));
  expect(plan[29].totalHC).toBeCloseTo(100, 0);
});

describe('forecast', () => {
  const season = 52;
  const y = Array.from({ length: 156 }, (_, t) => 1000 + 2 * t + 200 * Math.sin((2 * Math.PI * t) / season));
  test('holt-winters tracks trend + seasonality', () => {
    const { wape: w } = backtest(y, 'holtWinters', 13, { season });
    expect(w).toBeLessThan(5);
  });
  test('seasonal naive repeats last season', () => {
    expect(seasonalNaive([1, 2, 3, 4], 2, { season: 2 })).toEqual([3, 4]);
  });
  test('never negative', () => {
    expect(Math.min(...holtWinters([5, 3, 1, 0.5], 10))).toBeGreaterThanOrEqual(0);
  });
  test('events apply uplift to overlapping weeks only', () => {
    const out = applyEvents(['2026-01-05', '2026-01-12'], [100, 100], [{ start: '2026-01-14', end: '2026-01-15', upliftPct: 20 }]);
    expect(out).toEqual([100, 120]);
  });
});

describe('dates & format', () => {
  test('week start is Monday', () => {
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // Sunday
    expect(weekStart('2026-09-28')).toBe('2026-09-28');
  });
  test('currency has no hidden conversion', () => {
    expect(formatCurrency(1000, 'INR')).toBe('₹1,000');
    expect(formatCurrency(1000, 'USD')).toBe('$1,000');
  });
});

describe('plan engine on seed data', () => {
  const lines = seedLines();
  const history = seedVolumeHistory(lines);
  test('weekly series has only complete weeks', () => {
    const s = weeklySeries(history);
    expect(s['CS-VOICE'].values.length).toBe(156);
  });
  test('builds a sensible plan for every line', () => {
    const { plans, totals } = buildPlan({ lines, history, settings: DEFAULT_SETTINGS, events: seedEvents(), hiresPlan: {} });
    expect(plans).toHaveLength(4);
    plans.forEach(p => {
      expect(p.weeks).toHaveLength(26);
      p.sim.forEach(r => {
        expect(Number.isFinite(r.required)).toBe(true);
        expect(r.required).toBeGreaterThan(0);
      });
      expect(p.forecast.accuracy.wape).toBeLessThan(25);
    });
    expect(totals).toHaveLength(26);
    expect(totals.every(t => t.cost > 0)).toBe(true);
  });
  test('scenario +10% volume raises required FTE', () => {
    const args = { lines, history, settings: DEFAULT_SETTINGS, events: [], hiresPlan: {} };
    const base = buildPlan(args).totals;
    const up = buildPlan({ ...args, scenario: { volumePct: 10 } }).totals;
    expect(up[0].required / base[0].required).toBeCloseTo(1.1, 1);
  });
});
