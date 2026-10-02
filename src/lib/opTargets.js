import { rollupByMonth } from './budget';
import { makeRng } from './random';

// OP1 is set early (tighter), OP2 is the mid-year refresh. Seeded around the
// first baseline so the demo has realistic variances; users can edit/import.
export const deriveOpTargets = (totalsByMonth) => {
  const rng = makeRng(808);
  return totalsByMonth.map(m => ({
    month: m.month,
    op1_volume: Math.round(m.volume * (0.93 + rng.next() * 0.05)),
    op1_cost: Math.round(m.total * (0.92 + rng.next() * 0.05)),
    op2_volume: Math.round(m.volume * (0.97 + rng.next() * 0.05)),
    op2_cost: Math.round(m.total * (0.97 + rng.next() * 0.05)),
  }));
};

export const monthlyTotals = (plans) => rollupByMonth(plans.flatMap(p => p.costs));
