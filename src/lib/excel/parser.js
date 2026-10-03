// Excel formula parser: text → AST.
// Precedence, highest first: range (:), negation, percent (%), ^, * /, + -,
// & (concatenate), comparison (= <> < > <= >=).

export const colToIndex = (letters) => letters.toUpperCase().split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
export const indexToCol = (i) => {
  let n = i + 1;
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};
export const parseRef = (ref) => {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref);
  return m ? { col: colToIndex(m[1]), row: Number(m[2]) - 1 } : null;
};
export const refName = (row, col) => `${indexToCol(col)}${row + 1}`;

const ERRORS = ['#N/A', '#VALUE!', '#REF!', '#DIV/0!', '#NAME?', '#NUM!', '#NULL!', '#SPILL!', '#CALC!', '#CIRC!'];

export class FormulaError extends Error {}

const tokenize = (src) => {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      for (;;) {
        if (j >= src.length) throw new FormulaError('Unclosed text: add a closing "');
        if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; }
        s += src[j++];
      }
      tokens.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    if (c === '#') {
      const rest = src.slice(i).toUpperCase();
      const err = ERRORS.find(e => rest.startsWith(e));
      if (!err) throw new FormulaError(`Unknown error value at ${src.slice(i, i + 6)}`);
      tokens.push({ t: 'err', v: err });
      i += err.length;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
    if (num && !/^[A-Za-z]/.test(src.slice(i + num[0].length, i + num[0].length + 1))) {
      tokens.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const word = /^\$?[A-Za-z_][A-Za-z0-9_.]*\$?\d*/.exec(src.slice(i));
    if (word) {
      tokens.push({ t: 'word', v: word[0] });
      i += word[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['<>', '<=', '>='].includes(two)) { tokens.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/^&=<>%,():{};'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue; }
    throw new FormulaError(`Unexpected character "${c}"`);
  }
  return tokens;
};

export const parseFormula = (text) => {
  const src = String(text).replace(/^=/, '');
  const tokens = tokenize(src);
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
  const expect = (v) => { if (!isOp(v)) throw new FormulaError(`Expected "${v}"`); p++; };

  const compare = () => {
    let a = concat();
    while (peek() && peek().t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) {
      const op = tokens[p++].v;
      a = { t: 'bin', op, a, b: concat() };
    }
    return a;
  };
  const concat = () => {
    let a = additive();
    while (isOp('&')) { p++; a = { t: 'bin', op: '&', a, b: additive() }; }
    return a;
  };
  const additive = () => {
    let a = multiplicative();
    while (isOp('+') || isOp('-')) { const op = tokens[p++].v; a = { t: 'bin', op, a, b: multiplicative() }; }
    return a;
  };
  const multiplicative = () => {
    let a = power();
    while (isOp('*') || isOp('/')) { const op = tokens[p++].v; a = { t: 'bin', op, a, b: power() }; }
    return a;
  };
  const power = () => {
    let a = unary();
    while (isOp('^')) { p++; a = { t: 'bin', op: '^', a, b: unary() }; }
    return a;
  };
  const unary = () => {
    if (isOp('-')) { p++; return { t: 'neg', a: unary() }; }
    if (isOp('+')) { p++; return unary(); }
    return percent();
  };
  const percent = () => {
    let a = primary();
    while (isOp('%')) { p++; a = { t: 'pct', a }; }
    return a;
  };
  const arrayConst = () => {
    const rows = [[]];
    for (;;) {
      const neg = isOp('-') ? (p++, -1) : 1;
      const tok = tokens[p++];
      if (!tok) throw new FormulaError('Unclosed array constant');
      if (tok.t === 'num') rows[rows.length - 1].push(neg * tok.v);
      else if (tok.t === 'str') rows[rows.length - 1].push(tok.v);
      else if (tok.t === 'word' && /^(TRUE|FALSE)$/i.test(tok.v)) rows[rows.length - 1].push(/^TRUE$/i.test(tok.v));
      else throw new FormulaError('Array constants can only hold numbers, text or TRUE/FALSE');
      if (isOp(',')) { p++; continue; }
      if (isOp(';')) { p++; rows.push([]); continue; }
      expect('}');
      break;
    }
    if (rows.some(r => r.length !== rows[0].length)) throw new FormulaError('Every row of an array constant needs the same number of items');
    return { t: 'arr', rows };
  };
  const primary = () => {
    const tok = peek();
    if (!tok) throw new FormulaError('The formula ends too early');
    if (tok.t === 'num') { p++; return { t: 'num', v: tok.v }; }
    if (tok.t === 'str') { p++; return { t: 'str', v: tok.v }; }
    if (tok.t === 'err') { p++; return { t: 'err', v: tok.v }; }
    if (isOp('(')) { p++; const e = compare(); expect(')'); return e; }
    if (isOp('{')) { p++; return arrayConst(); }
    if (tok.t === 'word') {
      p++;
      const w = tok.v;
      if (isOp('(')) {
        p++;
        const args = [];
        if (!isOp(')')) {
          for (;;) {
            // Empty argument like IF(A1,,1)
            if (isOp(',')) { args.push({ t: 'blank' }); p++; continue; }
            args.push(compare());
            if (isOp(',')) { p++; if (isOp(')')) args.push({ t: 'blank' }); continue; }
            break;
          }
        }
        expect(')');
        return { t: 'fn', name: w.toUpperCase().replace(/^_XLFN\./, ''), args };
      }
      if (/^(TRUE|FALSE)$/i.test(w)) return { t: 'bool', v: /^TRUE$/i.test(w) };
      const cell = parseRef(w);
      const colOnly = /^\$?([A-Za-z]{1,3})$/.exec(w);
      if (isOp(':') && (cell || colOnly)) {
        p++;
        const t2 = tokens[p++];
        if (!t2 || t2.t !== 'word') throw new FormulaError('A range needs an end, like A1:B10');
        const c2 = parseRef(t2.v);
        const colOnly2 = /^\$?([A-Za-z]{1,3})$/.exec(t2.v);
        if (cell && c2) {
          return { t: 'range', r1: Math.min(cell.row, c2.row), c1: Math.min(cell.col, c2.col), r2: Math.max(cell.row, c2.row), c2: Math.max(cell.col, c2.col) };
        }
        if (colOnly && colOnly2) {
          const a = colToIndex(colOnly[1]);
          const b = colToIndex(colOnly2[1]);
          return { t: 'range', r1: 0, c1: Math.min(a, b), r2: null, c2: Math.max(a, b) };
        }
        throw new FormulaError(`Invalid range ${w}:${t2.v}`);
      }
      if (cell) return { t: 'ref', row: cell.row, col: cell.col };
      return { t: 'name', v: w.toUpperCase() };
    }
    throw new FormulaError(`Unexpected "${tok.v}"`);
  };

  const ast = compare();
  if (p < tokens.length) throw new FormulaError(`Unexpected "${tokens[p].v}" after the end of the formula`);
  return ast;
};
