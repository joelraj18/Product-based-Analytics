import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import usePersistentState from '../hooks/usePersistentState';
import { buildPlan } from '../lib/planEngine';
import { deriveOpTargets, monthlyTotals } from '../lib/opTargets';
import { idbGetAll, idbSet, idbDelete } from '../lib/idb';
import {
  seedOrders, seedInventory, seedSites, seedLines, seedVolumeHistory, seedEvents,
  seedActuals, seedDefects, seedRisks, seedTasks, DEFAULT_SETTINGS,
} from '../data/seed';

const WorkspaceContext = createContext(null);

const DEFAULT_DASHBOARD = { dateCol: 'date', valCol: 'amount', statusCol: 'status', catCol: 'region' };

export { deriveOpTargets, monthlyTotals };

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

  // Uploaded SQL tables live in IndexedDB (they can be large).
  const [userTables, setUserTables] = useState({});
  const [userTablesReady, setUserTablesReady] = useState(false);
  useEffect(() => {
    let alive = true;
    idbGetAll()
      .then(t => { if (alive) setUserTables(t || {}); })
      .catch(() => {})
      .finally(() => { if (alive) setUserTablesReady(true); });
    return () => { alive = false; };
  }, []);
  const saveUserTable = useCallback(async (name, table) => {
    await idbSet(name, table);
    setUserTables(t => ({ ...t, [name]: table }));
  }, []);
  const deleteUserTable = useCallback(async (name) => {
    await idbDelete(name);
    setUserTables(t => { const { [name]: _, ...rest } = t; return rest; });
  }, []);

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
    userTables, userTablesReady, saveUserTable, deleteUserTable,
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
