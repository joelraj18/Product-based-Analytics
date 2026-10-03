import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import usePersistentState from '../hooks/usePersistentState';
import { buildPlan } from '../lib/planEngine';
import { deriveOpTargets, monthlyTotals } from '../lib/opTargets';
import { idbGetAll, idbSet, idbDelete } from '../lib/idb';
import {
  demoOrders, seedInventory, seedSites, seedLines, seedVolumeHistory, seedEvents,
  seedActuals, seedDefects, seedRisks, seedTasks, DEFAULT_SETTINGS,
} from '../data/seed';
import { load, save, remove } from '../lib/storage';
import { isOldDemoOrders, loadUserOrders, saveUserOrders, clearUserOrders } from '../lib/ordersStore';

// The orders table: the 100,000 row demo sample (rebuilt from a seed, never
// saved) until the user uploads, edits or cleans orders; from then on their
// rows are saved to IndexedDB. Older versions kept orders in localStorage:
// an old demo there is dropped, real user orders move to IndexedDB once.
const initialOrders = () => {
  const source = load('orders_source', null);
  if (source === 'user') return { source, rows: [], ready: false };
  if (source === 'demo') return { source, rows: demoOrders(), ready: true };
  const legacy = load('db_orders', undefined);
  if (Array.isArray(legacy) && legacy.length && !isOldDemoOrders(legacy)) return { source: 'user', rows: legacy, ready: true, migrate: true };
  return { source: 'demo', rows: demoOrders(), ready: true };
};

const useOrders = () => {
  const [state, setState] = useState(initialOrders);
  const dirty = useRef(Boolean(state.migrate));
  const fail = () => { try { window.dispatchEvent(new CustomEvent('workx-storage-full', { detail: { key: 'orders' } })); } catch { /* non-browser */ } };

  useEffect(() => {
    save('orders_source', state.source);
    if (!state.migrate) remove('db_orders');
    if (state.source !== 'user' || state.ready) return undefined;
    let alive = true;
    loadUserOrders()
      .then(rows => { if (alive) setState(rows ? { source: 'user', rows, ready: true } : { source: 'demo', rows: demoOrders(), ready: true }); })
      .catch(() => { if (alive) setState({ source: 'demo', rows: demoOrders(), ready: true }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { save('orders_source', state.source); }, [state.source]);

  // Saves the user's orders a moment after the last change, so a burst of
  // edits writes once.
  useEffect(() => {
    if (!dirty.current || state.source !== 'user') return undefined;
    const t = setTimeout(() => {
      dirty.current = false;
      saveUserOrders(state.rows).then(() => remove('db_orders')).catch(fail);
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  const setOrders = useCallback((next) => {
    dirty.current = true;
    setState(s => ({ source: 'user', ready: true, rows: typeof next === 'function' ? next(s.rows) : next }));
  }, []);
  const resetOrders = useCallback(() => {
    dirty.current = false;
    setState({ source: 'demo', rows: demoOrders(), ready: true });
    clearUserOrders().catch(() => {});
  }, []);
  return { orders: state.rows, setOrders, resetOrders, ordersSource: state.source, ordersReady: state.ready };
};

const WorkspaceContext = createContext(null);

const DEFAULT_DASHBOARD = { dateCol: 'date', valCol: 'amount', statusCol: 'status', catCol: 'region' };

export { deriveOpTargets, monthlyTotals };

export const WorkspaceProvider = ({ children }) => {
  const [settings, setSettings] = usePersistentState('settings', DEFAULT_SETTINGS);
  const { orders, setOrders, resetOrders, ordersSource, ordersReady } = useOrders();
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
    orders, setOrders, resetOrders, ordersSource, ordersReady,
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
