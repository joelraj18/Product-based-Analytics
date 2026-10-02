// RFC 4180 style parser: handles quoted fields, escaped quotes, empty fields,
// and newlines inside quotes.
export const parseCSVRows = (text, delimiter = ',') => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
};

// Convert numeric-looking strings to numbers so SQL/aggregations behave.
// Codes with leading zeros (e.g. "00123") stay text.
export const coerceValue = (v) => {
  const t = v.trim();
  if (t === '') return '';
  if (/^-?\d+(\.\d+)?$/.test(t) && !(t.length > 1 && t.startsWith('0') && !t.startsWith('0.'))) return Number(t);
  return t;
};

export const parseCSV = (text, { coerceNumbers = true } = {}) => {
  const rows = parseCSVRows(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h, i) => h.trim() || `column_${i + 1}`);
  return rows.slice(1).map(values => headers.reduce((obj, h, i) => {
    const v = values[i] ?? '';
    obj[h] = coerceNumbers ? coerceValue(v) : v;
    return obj;
  }, {}));
};

export const columnsOf = (rows) => {
  const seen = new Set();
  rows.forEach(r => Object.keys(r).forEach(k => seen.add(k)));
  return [...seen];
};

const escapeCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCSV = (rows, columns = columnsOf(rows)) =>
  [columns.map(escapeCell).join(','), ...rows.map(r => columns.map(c => escapeCell(r[c])).join(','))].join('\n');

export const downloadFile = (content, filename, type = 'text/csv;charset=utf-8;') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const downloadCSV = (rows, filename, columns) => downloadFile(toCSV(rows, columns), filename);

export const readFileText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = e => resolve(e.target.result);
  reader.onerror = () => reject(new Error('Could not read file'));
  reader.readAsText(file);
});

export const today = () => new Date().toISOString().slice(0, 10);
