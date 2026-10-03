/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { render, screen, fireEvent } from '@testing-library/react';
import SchemaDiagram, { layoutSchema, SchemaReferenceButton } from '../SchemaDiagram';
import { BUILTIN_TABLES, RELATIONSHIPS } from '../../lib/sqlTables';

const tables = Object.fromEntries(BUILTIN_TABLES.map(n => [n, [{ id: 'x', line_id: 'A', lineId: 'A', siteId: 'S', category: 'C', week_start: '2026-01-05' }]]));

test('lays out every table with no overlapping boxes and every relationship', () => {
  const { boxes, edges } = layoutSchema({ ...tables, my_upload: [{ a: 1 }] });
  expect(boxes.map(b => b.name).sort()).toEqual([...BUILTIN_TABLES, 'my_upload'].sort());
  expect(edges).toHaveLength(RELATIONSHIPS.length);
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => {
    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    expect(overlap).toBe(false);
  }));
});

test('renders a box per table and a path per relationship', () => {
  const { container } = render(<SchemaDiagram tables={tables} uploaded={{}} />);
  expect(container.querySelectorAll('[data-table]')).toHaveLength(BUILTIN_TABLES.length);
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(RELATIONSHIPS.length);
});

test('schema reference opens on hover and pins on click', () => {
  render(<SchemaReferenceButton tables={tables} uploaded={{}} />);
  const button = screen.getByRole('button', { name: /Schema reference/ });
  fireEvent.mouseEnter(button.parentElement);
  expect(screen.getByRole('dialog', { name: 'Schema reference' })).toBeInTheDocument();
  fireEvent.click(button);
  fireEvent.mouseLeave(button.parentElement);
  expect(screen.getByRole('dialog', { name: 'Schema reference' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close schema reference' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
