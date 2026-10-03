import { render, screen, fireEvent, within } from '@testing-library/react';
import App, { NAV } from './App';

beforeEach(() => localStorage.clear());

const register = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  fireEvent.change(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Test Planner' } });
  fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));
};

test('shows sign-in without any prefilled personal details', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument();
  expect(screen.getByPlaceholderText('name@company.com')).toHaveValue('');
});

test('rejects unknown users', () => {
  render(<App />);
  fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'nobody@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'whatever' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/not found/i);
});

test('registers and renders every module without crashing', async () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  // jsdom has no layout, so Recharts warns about zero-size containers.
  const warns = jest.spyOn(console, 'warn').mockImplementation(() => {});
  render(<App />);
  register();
  // findBy waits for the async IndexedDB load of uploaded tables to settle.
  expect(await screen.findByRole('heading', { name: 'Welcome to WorkX' })).toBeInTheDocument();
  const nav = screen.getByRole('complementary', { name: 'Main navigation' });
  NAV.flatMap(g => g.items).forEach(item => {
    fireEvent.click(within(nav).getByRole('button', { name: item.label }));
    expect(screen.queryByText('This module hit an error')).not.toBeInTheDocument();
  });
  // Help box is present on module screens.
  expect(screen.getByRole('button', { name: /What am I looking at/ })).toBeInTheDocument();
  expect(errors.mock.calls).toEqual([]);
  errors.mockRestore();
  warns.mockRestore();
});

// Cells are addressed by their data-cell position, like a real sheet.
/* eslint-disable testing-library/no-node-access */
test('Excel Lab evaluates formulas, spills arrays and grades practice', async () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<App />);
  register();
  await screen.findByRole('heading', { name: 'Welcome to WorkX' });
  const nav = screen.getByRole('complementary', { name: 'Main navigation' });
  fireEvent.click(within(nav).getByRole('button', { name: 'Excel Lab' }));
  const grid = screen.getByRole('grid', { name: 'Spreadsheet' });
  // Select N2 (the first free column) and type a formula.
  fireEvent.mouseDown(grid.querySelector('[data-cell="1,13"]'));
  const bar = screen.getByRole('textbox', { name: 'Formula bar' });
  fireEvent.change(bar, { target: { value: '=SEQUENCE(3)*10' } });
  fireEvent.keyDown(bar, { key: 'Enter' });
  expect(grid.querySelector('[data-cell="3,13"]')).toHaveTextContent('30');
  fireEvent.click(screen.getByRole('tab', { name: 'Pivot table' }));
  expect(screen.getAllByText('Grand Total').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('tab', { name: 'Practice' }));
  const practice = screen.getByRole('grid', { name: 'Practice sheet' });
  fireEvent.mouseDown(practice.querySelector('[data-cell="1,13"]'));
  const bar2 = screen.getByRole('textbox', { name: 'Formula bar' });
  fireEvent.change(bar2, { target: { value: '=SUM(C:C)' } });
  fireEvent.keyDown(bar2, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: /Check my answer/ }));
  expect(screen.getByRole('status')).toHaveTextContent('Correct');
  fireEvent.click(screen.getByRole('tab', { name: /VBA, Power Query/ }));
  expect(screen.getByRole('heading', { name: 'Your first macro' })).toBeInTheDocument();
  expect(errors.mock.calls).toEqual([]);
  errors.mockRestore();
});
/* eslint-enable testing-library/no-node-access */
