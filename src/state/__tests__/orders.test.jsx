import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { WorkspaceProvider, useWorkspace } from '../workspace';
import { kvGet, kvDelete } from '../../lib/idb';
import { ORDERS_TARGET } from '../../data/seed';

let ws;
const Probe = () => {
  ws = useWorkspace();
  return <div data-testid="probe">{`${ws.ordersSource}:${ws.ordersReady}:${ws.orders.length}`}</div>;
};
// Waits for the uploaded tables to load, so no state update lands after the test.
const mount = async () => {
  const view = render(<WorkspaceProvider><Probe /></WorkspaceProvider>);
  await waitFor(() => expect(ws.userTablesReady).toBe(true));
  return view;
};
const probe = () => screen.getByTestId('probe').textContent;
const v2Demo = () => Array.from({ length: 6000 }, (_, i) => ({ id: `ORD-${100001 + i}`, date: '2025-01-01', amount: 10, units: 1, status: 'Delivered', region: 'North', category: 'Home', fulfillment_center: 'FC-1', customer_id: 'CUST-1' }));

beforeEach(async () => { localStorage.clear(); await kvDelete('orders'); });

test('a new visitor gets the 100,000 order sample, and it is never saved', async () => {
  await mount();
  expect(probe()).toBe(`demo:true:${ORDERS_TARGET}`);
  expect(localStorage.getItem('workx_orders_source')).toBe('"demo"');
  expect(localStorage.getItem('workx_db_orders')).toBeNull();
});

test('an old demo saved by an earlier version is replaced by the new sample', async () => {
  localStorage.setItem('workx_db_orders', JSON.stringify(v2Demo()));
  await mount();
  expect(probe()).toBe(`demo:true:${ORDERS_TARGET}`);
  expect(localStorage.getItem('workx_db_orders')).toBeNull();
});

test('orders a user saved in an earlier version move to IndexedDB', async () => {
  const mine = [{ id: 'A1', date: '2025-05-01', amount: 99 }];
  localStorage.setItem('workx_db_orders', JSON.stringify(mine));
  await mount();
  expect(probe()).toBe('user:true:1');
  await waitFor(() => expect(localStorage.getItem('workx_db_orders')).toBeNull());
  expect(await kvGet('orders')).toEqual(mine);
});

test('an edit makes the orders yours, survives a reload and can be reset to the sample', async () => {
  const first = await mount();
  act(() => { ws.setOrders(rows => rows.slice(0, 10)); });
  expect(probe()).toBe('user:true:10');
  await waitFor(async () => expect((await kvGet('orders')) || []).toHaveLength(10));
  first.unmount();

  await mount();
  await waitFor(() => expect(probe()).toBe('user:true:10'));
  act(() => { ws.resetOrders(); });
  expect(probe()).toBe(`demo:true:${ORDERS_TARGET}`);
  await waitFor(async () => expect(await kvGet('orders')).toBeUndefined());
});
