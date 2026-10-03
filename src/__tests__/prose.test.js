// Style rule: user-facing descriptive text uses no dashes, underscores or
// full stops. Column/table names go inside `backticks` (rendered as code
// chips) and runtime values (dates, numbers) are interpolated, so both are
// exempt. This test scans every source file's string literals for prose.
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

const SRC = path.resolve(__dirname, '..');
const NON_PROSE_ATTRS = new Set(['className', 'fontFamily', 'fontSize', 'fontWeight', 'transform', 'viewBox', 'd', 'href', 'src', 'id', 'type', 'accept', 'role', 'data-testid', 'value', 'key', 'htmlFor', 'autoComplete', 'list', 'stroke', 'fill', 'dataKey', 'stackId', 'layout', 'stackOffset', 'width', 'height', 'step', 'tickFormatter', 'ifOverflow', 'position', 'strokeDasharray', 'stopColor', 'offset', 'x1', 'x2', 'y1', 'y2', 'aria-live', 'aria-current', 'interval']);
const NON_PROSE_KEYS = new Set(['sql', 'solution', 'className', 'id', 'value', 'key', 'mode', 'type', 'locale', 'symbol', 'path', 'name', 'lineId', 'line_id', 'siteId', 'month', 'start', 'end', 'date', 'due', 'week_start', 'category', 'status', 'owner', 'tag', 'priority', 'example', 'fill', 'stroke', 'currency', 'level', 'costModel', 'timezone', 'formula', 'code', 'answer', 'cell', 'letters', 'dataset', 'syntax', 'fn', 'format']);
const ALLOWED = new Set(['name@company.com', '••••••••', 'SELECT * FROM orders LIMIT 10']);

const files = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
  const p = path.join(dir, d.name);
  if (d.isDirectory()) { if (d.name !== '__tests__') walk(p); } else if (/\.(js|jsx)$/.test(d.name) && !/\.test\.js$/.test(d.name) && d.name !== 'setupTests.js') files.push(p);
});
walk(SRC);

const UTILITY = /^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|truncate|uppercase|lowercase|italic|underline|border|rounded|shadow|transition|group|peer|container|static|grow|shrink|contents|invisible|visible|outline|ring|resize|isolate|antialiased|sr-only|whitespace-\S+|list-none)$/;
const isClassList = (s) => {
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const classy = tokens.filter(t => /[-:[\]/]/.test(t) || UTILITY.test(t) || /^\$\{/.test(t));
  return classy.length / tokens.length >= 0.7;
};
const isSql = (s) => /\b(SELECT|INSERT|CREATE TABLE)\b[\s\S]*\bFROM\b/.test(s) || /^SELECT\b/.test(s.trim());
const words = (s) => (s.match(/\b[A-Za-z]{2,}\b/g) || []).length;

// Removes the parts that are allowed to contain punctuation.
const strip = (s) => s
  .replace(/`[^`]*`/g, ' CODE ')
  .replace(/\$\{[^}]*\}/g, ' X ')
  .replace(/\d{4}-\d{2}(-\d{2})?/g, ' D ')
  .replace(/\d+\.\d+/g, ' N ')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' E ')
  .replace(/…/g, ' ');

const violations = [];
const TW_PREFIX = /^(text|bg|border|ring|shadow|rounded|font|flex|grid|items|justify|gap|space|p[xytrbl]?|m[xytrbl]?|w|h|min|max|overflow|z|top|left|right|bottom|inset|translate|rotate|scale|opacity|cursor|select|pointer|transition|duration|ease|animate|outline|sr|not|line|list|tracking|leading|whitespace|break|self|place|order|col|row|aspect|object|fill|stroke|accent|caret|divide|from|to|via|decoration|underline|hover|focus|disabled|group|data|aria)-/;
const report = (s, file, line) => violations.push(`${path.relative(SRC, file)}:${line}  ${JSON.stringify(s.trim().slice(0, process.env.PROSE_REPORT ? 2000 : 120))}`);
const check = (raw, file, line, jsxText = false) => {
  const s = String(raw);
  // Visible JSX text is always checked, even a lone "— " or a trailing "wks).".
  if (jsxText && s.trim()) {
    const t = strip(s);
    if (/[—–_]|(^|\s)-(\s|$)|[A-Za-z)\]]\.(\s|$)|[a-z]-[a-z]/.test(t)) { report(s, file, line); return; }
  }
  // A lone hyphenated word ("over-forecasting") is prose too, unless it is a
  // CSS utility class, a locale, an uppercase data code (CS-VOICE) or an
  // internal event name (workx-…).
  const one = s.trim();
  if (/^[A-Za-z]+(-[A-Za-z]+)+$/.test(one) && !TW_PREFIX.test(one) && !/^[a-z]{2}-[A-Z]{2}$/.test(one) && !/^[A-Z0-9-]+$/.test(one) && !/^workx-/.test(one)) { report(s, file, line); return; }
  if (ALLOWED.has(s.trim()) || !/\s/.test(s.trim()) || words(s) < 2 || isClassList(s) || isSql(s)) return;
  const bad = strip(s).match(/[—–\-_.]/g);
  if (bad) report(s, file, line);
};

const templateText = (node) => node.quasis.map((q, i) => q.value.cooked + (i < node.expressions.length ? ' X ' : '')).join('');

const visit = (node, file, parent, parentKey) => {
  if (!node || typeof node.type !== 'string') return;
  // Text inside <code> or <pre> is code, not prose.
  if (node.type === 'JSXElement' && node.openingElement && node.openingElement.name && ['code', 'pre', 'kbd'].includes(node.openingElement.name.name)) return;
  if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return;
  if (node.type === 'JSXAttribute') {
    const name = node.name && (node.name.name || node.name.namespace);
    if (NON_PROSE_ATTRS.has(name)) return;
  }
  if ((node.type === 'ObjectProperty' || node.type === 'Property') && node.key) {
    const k = node.key.name || node.key.value;
    if (NON_PROSE_KEYS.has(k)) return;
  }
  // Skip template literals used only for class names or file names.
  if (node.type === 'CallExpression' && node.callee && ['downloadCSV', 'downloadFile', 'save', 'load', 'require', 'querySelector', 'getElementById'].includes(node.callee.name || (node.callee.property && node.callee.property.name))) return;
  if (node.type === 'JSXText') check(node.value, file, node.loc.start.line, true);
  // JSX attribute strings don't process escapes, so "a\nb" would show a literal \n.
  if (node.type === 'StringLiteral' && parent && parent.type === 'JSXAttribute' && node.value.includes('\\n')) report(`literal \\n in JSX attribute: ${node.value}`, file, node.loc.start.line);
  if (node.type === 'StringLiteral' && !(parent && parent.type === 'ObjectProperty' && parentKey === 'key')) check(node.value, file, node.loc.start.line);
  if (node.type === 'TemplateLiteral' && !(parent && parent.type === 'TaggedTemplateExpression')) check(templateText(node), file, node.loc.start.line);
  Object.keys(node).forEach(k => {
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments') return;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => visit(c, file, node, k));
    else if (v && typeof v.type === 'string') visit(v, file, node, k);
  });
};

test('prose has no dashes, underscores or full stops', () => {
  files.forEach(file => {
    const ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
    visit(ast.program, file, null, null);
  });
  if (process.env.PROSE_REPORT) fs.writeFileSync(process.env.PROSE_REPORT, violations.join('\n'));
  expect(violations).toEqual([]);
});
