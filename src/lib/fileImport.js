import { parseCSVRows, coerceValue, readFileText } from './csv';

export const ACCEPT = '.csv,.tsv,.txt,.json,.xlsx';
export const MAX_BYTES = 20 * 1024 * 1024;

const extOf = (name) => (String(name).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '';

const isEmpty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

const toISO = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const normalizeCell = (v) => {
  if (v instanceof Date) return toISO(v);
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (v === null || v === undefined) return '';
  return coerceValue(String(v));
};

// Spreadsheets often have a title or note rows above the real header. Pick the
// first of the top rows that is mostly text and about as wide as the table.
export const detectHeaderRow = (grid) => {
  const top = grid.slice(0, 10);
  const width = Math.max(0, ...top.map(r => r.filter(c => !isEmpty(c)).length));
  for (let i = 0; i < top.length; i++) {
    const cells = top[i].filter(c => !isEmpty(c));
    const texty = cells.filter(c => typeof c === 'string' && !/^-?\d+(\.\d+)?$/.test(c.trim())).length;
    if (cells.length >= Math.max(1, width * 0.6) && texty === cells.length) return i;
  }
  return 0;
};

const uniqueHeaders = (raw) => {
  const seen = {};
  return raw.map((h, i) => {
    let name = String(h ?? '').trim() || `column_${i + 1}`;
    if (seen[name]) { seen[name] += 1; name = `${name}_${seen[name]}`; } else seen[name] = 1;
    return name;
  });
};

// Turns a grid (array of row arrays) into { columns, rows } using headerRow.
export const gridToTable = (grid, headerRow = 0) => {
  const header = grid[headerRow] || [];
  const body = grid.slice(headerRow + 1).filter(r => r.some(c => !isEmpty(c)));
  const width = Math.max(header.length, ...body.map(r => r.length), 0);
  const columns = uniqueHeaders(Array.from({ length: width }, (_, i) => header[i]));
  const rows = body.map(r => Object.fromEntries(columns.map((c, i) => [c, normalizeCell(r[i])])));
  // Drop columns that have no header and no data at all.
  const keep = columns.filter((c, i) => !/^column_\d+$/.test(c) || rows.some(r => !isEmpty(r[c])) || !isEmpty(header[i]));
  return { columns: keep, rows: rows.map(r => Object.fromEntries(keep.map(c => [c, r[c]]))) };
};

const sniffDelimiter = (text) => {
  const line = text.split(/\r?\n/).find(l => l.trim()) || '';
  const counts = { ',': (line.match(/,/g) || []).length, '\t': (line.match(/\t/g) || []).length, ';': (line.match(/;/g) || []).length };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ',';
};

export const parseTextTable = (text, ext = 'csv') => {
  const delimiter = ext === 'tsv' ? '\t' : ext === 'csv' ? ',' : sniffDelimiter(text);
  return parseCSVRows(text, delimiter);
};

export const parseJsonTable = (text) => {
  let data = JSON.parse(text);
  if (!Array.isArray(data)) data = Array.isArray(data.data) ? data.data : Array.isArray(data.rows) ? data.rows : null;
  if (!data || !data.every(r => r && typeof r === 'object' && !Array.isArray(r))) {
    throw new Error('JSON must be an array of objects, e.g. [{"date": "2026-01-05", "volume": 120}]');
  }
  const columns = [...new Set(data.flatMap(r => Object.keys(r)))];
  return [columns, ...data.map(r => columns.map(c => (r[c] !== null && typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])))];
};

// Reads a user file into sheets of raw grids plus a detected header row.
// Returns { fileName, sheets: [{ name, grid, headerRow }] }.
export const readTable = async (file) => {
  if (!file) throw new Error('No file selected');
  if (file.size > MAX_BYTES) throw new Error(`File is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${MAX_BYTES / 1048576} MB. Split it or remove unused columns.`);
  const ext = extOf(file.name);
  let sheets;
  if (ext === 'xls') {
    throw new Error('Old .xls files are not supported. In Excel choose File → Save As → .xlsx (or .csv) and upload that.');
  } else if (ext === 'xlsx') {
    const { default: readXlsx } = await import('read-excel-file/browser');
    let result;
    try {
      result = await readXlsx(file);
    } catch (e) {
      throw new Error(`Could not read this Excel file (${e.message}). Make sure it is a normal .xlsx workbook, not password-protected.`);
    }
    sheets = result.map(s => ({ name: s.sheet, grid: s.data.map(r => r.map(c => (c instanceof Date ? toISO(c) : c))) }));
  } else if (['csv', 'tsv', 'txt', 'json'].includes(ext)) {
    const text = await readFileText(file);
    const grid = ext === 'json' ? parseJsonTable(text) : parseTextTable(text, ext);
    sheets = [{ name: file.name.replace(/\.[^.]+$/, ''), grid }];
  } else {
    throw new Error(`".${ext || '?'}" files are not supported. Upload .csv, .tsv, .txt, .json or .xlsx.`);
  }
  sheets = sheets.filter(s => s.grid.some(r => r.some(c => !isEmpty(c))));
  if (!sheets.length) throw new Error('The file is empty.');
  return { fileName: file.name, sheets: sheets.map(s => ({ ...s, headerRow: detectHeaderRow(s.grid) })) };
};

// Infers a simple type label for a column, for previews and schemas.
export const inferType = (rows, col) => {
  const vals = rows.map(r => r[col]).filter(v => !isEmpty(v)).slice(0, 200);
  if (!vals.length) return 'empty';
  if (vals.every(v => typeof v === 'number')) return 'number';
  if (vals.every(v => /^\d{4}-\d{2}-\d{2}/.test(String(v)))) return 'date';
  if (vals.every(v => /^\d{4}-\d{2}$/.test(String(v)))) return 'month';
  return 'text';
};
