import { readTable, gridToTable } from './fileImport';
import { SCHEMA_BY_ID, validate } from './schemas';

// Reads a file and validates it against a feature schema. Picks the first
// sheet that has every required column (handy for multi-sheet workbooks).
export const readForSchema = async (file, schemaId) => {
  const schema = SCHEMA_BY_ID[schemaId];
  const { sheets } = await readTable(file);
  let fallback = null;
  for (const sh of sheets) {
    const t = gridToTable(sh.grid, sh.headerRow);
    const v = validate(schema, t.columns, t.rows);
    const res = { ...v, sheet: sh.name, total: t.rows.length, columns: t.columns };
    if (!v.missing.length) return res;
    if (!fallback) fallback = res;
  }
  return fallback;
};

// Plain-language explanation of what is wrong with an upload.
export const explainProblems = (schemaId, v) => {
  const schema = SCHEMA_BY_ID[schemaId];
  const parts = [];
  if (v.missing.length) {
    parts.push(`Missing required column${v.missing.length > 1 ? 's' : ''}: ${v.missing.join(', ')}.`);
    parts.push(`"${schema.label}" files need these exact column names: ${schema.required.map(c => c.name).join(', ')}.`);
    if (v.columns && v.columns.length) parts.push(`Your file has: ${v.columns.slice(0, 12).join(', ')}${v.columns.length > 12 ? '…' : ''}.`);
  }
  v.issues.forEach(i => parts.push(`${i.count} row(s) with ${i.kind} "${i.column}" (e.g. row ${i.rows.join(', ')}).`));
  if (v.skipped) parts.push(`${v.skipped} row(s) skipped because a required value was missing or invalid.`);
  return parts.join('\n');
};
