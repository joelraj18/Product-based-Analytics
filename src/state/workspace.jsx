import React, { createContext, useContext, useEffect, useMemo } from 'react';
import usePersistentState from '../hooks/usePersistentState';
import { buildPlan } from '../lib/planEngine';
import { rollupByMonth } from '../lib/budget';
import { makeRng } from '../lib/random';
import {
  seedOrders, seedInventory, seedSites, seedLines, seedVolumeHistory, seedEvents,
  seedActuals, seedDefects, seedRisks, seedTasks, DEFAULT_SETTINGS,
} from '../data/seed';

const WorkspaceContext = createContext(null);

const DEFAULT_DASHBOARD = { dateCol: 'date', valCol: 'amount', statusCol: 'status', catCol: 'region' };

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

export const WorkspaceProvider = ({ children }) => {
  const [settings, setSettings] = usePersistentState('settings', DEFAULT_SETTINGS);
  const [orders, setOrders] = usePersistentState('db_orders', seedOrders);
  const [sites, setSites] = usePersistentState('sites', seedSites);
  const [lines, setLines] = usePersistentState('plan_lines', seedLines);
  const [volumeHistory, setVolumeHistory] = usePersistentState('volume_history', () => seedVolumeHistory());
  const [events, setEvents] = usePersistentState('events', seedEvents);
  const [hiresPlan, setHiresPlan] = usePersistentState('hires_plan', {});
  const [actuals, setActuals] = usePersistentState('actuals', () => seedActuals());
  const [defects, setDefects] = usePersistentState('defects', seedDefects);
  const [risks, setRisks] = usePersistentState('risks', seedRisks);
  const [tasks, setTasks] = usePersistentState('tasks', seedTasks);
  const [opTargets, setOpTargets] = usePersistentState('op_targets', null);
  const [scenario, setScenario] = usePersistentState('scenario', { volumePct: 0, ahtPct: 0, shrinkagePts: 0, attritionPts: 0 });
  const [dashboardConfig, setDashboardConfig] = usePersistentState('dashboard_config', DEFAULT_DASHBOARD);
  const [sqlHistory, setSqlHistory] = usePersistentState('sql_history', []);
  const inventory = useMemo(() => seedInventory(), []);

  const s = { ...DEFAULT_SETTINGS, ...settings };
  const plan = useMemo(
    () => buildPlan({ lines, history: volumeHistory, settings: s, events, hiresPlan }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, volumeHistory, s.horizonWeeks, s.forecastMethod, events, hiresPlan],
  );

  useEffect(() => {
    if (opTargets === null && plan.plans.some(p => p.costs.length)) {
      setOpTargets(deriveOpTargets(monthlyTotals(plan.plans)));
    }
  }, [opTargets, plan, setOpTargets]);

  const value = {
    settings: s, setSettings,
    orders, setOrders,
    inventory,
    sites, setSites,
    lines, setLines,
    volumeHistory, setVolumeHistory,
    events, setEvents,
    hiresPlan, setHiresPlan,
    actuals, setActuals,
    defects, setDefects,
    risks, setRisks,
    tasks, setTasks,
    opTargets: opTargets || [], setOpTargets,
    scenario, setScenario,
    dashboardConfig: { ...DEFAULT_DASHBOARD, ...dashboardConfig }, setDashboardConfig,
    sqlHistory, setSqlHistory,
    plan,
    currency: s.currency,
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
};
