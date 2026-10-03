import { Sheet } from '../engine';
import { parseFormula, colToIndex, indexToCol } from '../parser';
import { isErr } from '../values';
import { formatText } from '../functions';

const sheet = () => Sheet.fromRows(['id', 'date', 'amount', 'status', 'region', 'units'], [
  { id: 'ORD-1', date: '2026-01-05', amount: 100, status: 'Delivered', region: 'North', units: 2 },
  { id: 'ORD-2', date: '2026-01-20', amount: 250, status: 'Pending', region: 'South', units: 5 },
  { id: 'ORD-3', date: '2026-02-03', amount: 75.5, status: 'Delivered', region: 'North', units: 1 },
  { id: 'ORD-4', date: '2026-02-14', amount: 400, status: 'Cancelled', region: 'East', units: 8 },
  { id: 'ORD-5', date: '2026-03-01', amount: 120, status: 'Pending', region: 'North', units: 3 },
]);
const ev = (f, s = sheet()) => { const v = s.evaluateAt(f.replace(/^=/, ''), 10, 10); return isErr(v) ? v.code : v; };

describe('parser', () => {
  test('column letters round trip', () => {
    expect(colToIndex('A')).toBe(0);
    expect(colToIndex('AA')).toBe(26);
    expect(indexToCol(27)).toBe('AB');
  });
  test('precedence follows Excel', () => {
    expect(ev('1+2*3')).toBe(7);
    expect(ev('-2^2')).toBe(4); // Excel negation binds tighter than ^
    expect(ev('2^3^2')).toBe(64); // left to right
    expect(ev('"a"&1+1')).toBe('a2');
    expect(ev('1+1=2')).toBe(true);
    expect(ev('50%*2')).toBe(1);
  });
  test('refs, absolute refs, ranges and whole columns', () => {
    expect(parseFormula('$C$2')).toMatchObject({ t: 'ref', row: 1, col: 2 });
    expect(ev('C2+C3')).toBe(350);
    expect(ev('SUM(C2:C6)')).toBe(945.5);
    expect(ev('SUM(C:C)')).toBe(945.5);
    expect(ev('SUM($C$2:$C$3)')).toBe(350);
  });
  test('syntax errors give #NAME?', () => {
    const s = sheet();
    s.setRaw(1, 8, '=SUM(1,');
    expect(s.value(1, 8).code).toBe('#NAME?');
    s.setRaw(1, 8, '=NOSUCH(1)');
    expect(s.value(1, 8).code).toBe('#NAME?');
  });
});

describe('engine', () => {
  test('errors and division by zero', () => {
    expect(ev('1/0')).toBe('#DIV/0!');
    expect(ev('"x"+1')).toBe('#VALUE!');
    expect(ev('IFERROR(1/0,"none")')).toBe('none');
  });
  test('cycles are detected', () => {
    const s = sheet();
    s.setRaw(1, 8, '=I3+1');
    s.setRaw(2, 8, '=I2+1');
    expect(s.value(1, 8).code).toBe('#CIRC!');
  });
  test('dynamic arrays spill and collide', () => {
    const s = sheet();
    s.setRaw(0, 8, '=SEQUENCE(3)');
    expect([s.value(0, 8), s.value(1, 8), s.value(2, 8)]).toEqual([1, 2, 3]);
    expect(s.isSpillCell(2, 8)).toBe(true);
    s.setRaw(0, 9, '=SUM(I1:I3)');
    expect(s.value(0, 9)).toBe(6);
    s.setRaw(1, 8, 'blocker');
    expect(s.value(0, 8).code).toBe('#SPILL!');
  });
  test('array arithmetic broadcasts', () => {
    expect(ev('SUMPRODUCT((E2:E6="North")*C2:C6)')).toBe(295.5);
    expect(ev('SUM((E2:E6="North")*F2:F6)')).toBe(6);
    expect(ev('SUM({1,2;3,4}*10)')).toBe(100);
  });
  test('dates as ISO text work in arithmetic', () => {
    expect(ev('B3-B2')).toBe(15);
    expect(ev('YEAR(B2)')).toBe(2026);
    expect(ev('DATE(2026,1,5)')).toBe('2026-01-05');
  });
  test('text values that start with = stay text', () => {
    const s = Sheet.fromRows(['a'], [{ a: '=1+1' }]);
    expect(s.value(1, 0)).toBe('=1+1');
  });
});

describe('functions', () => {
  test('math and statistics', () => {
    expect(ev('AVERAGE(C2:C6)')).toBeCloseTo(189.1);
    expect(ev('MIN(C2:C6)')).toBe(75.5);
    expect(ev('MAX(C2:C6)')).toBe(400);
    expect(ev('COUNT(A2:A6)')).toBe(0);
    expect(ev('COUNTA(A2:A6)')).toBe(5);
    expect(ev('COUNTBLANK(G2:G6)')).toBe(5);
    expect(ev('ROUND(2.345,2)')).toBe(2.35);
    expect(ev('ROUND(-2.5,0)')).toBe(-3);
    expect(ev('ROUNDUP(2.341,2)')).toBe(2.35);
    expect(ev('ROUNDDOWN(-2.349,2)')).toBe(-2.34);
    expect(ev('MOD(-3,2)')).toBe(1);
    expect(ev('INT(-1.5)')).toBe(-2);
    expect(ev('MEDIAN(C2:C6)')).toBe(120);
    expect(ev('STDEV.S(1,2,3,4)')).toBeCloseTo(1.290994, 5);
    expect(ev('LARGE(C2:C6,2)')).toBe(250);
    expect(ev('SMALL(C2:C6,1)')).toBe(75.5);
    expect(ev('RANK.EQ(250,C2:C6)')).toBe(2);
    expect(ev('PERCENTILE.INC(C2:C6,0.25)')).toBe(100);
    expect(ev('SUM(1,"2",TRUE)')).toBe(4);
  });
  test('conditional aggregation with operators and wildcards', () => {
    expect(ev('SUMIFS(C:C,E:E,"North")')).toBe(295.5);
    expect(ev('SUMIFS(C2:C6,E2:E6,"North",D2:D6,"Delivered")')).toBe(175.5);
    expect(ev('COUNTIF(C2:C6,">100")')).toBe(3);
    expect(ev('COUNTIF(D2:D6,"<>Pending")')).toBe(3);
    expect(ev('COUNTIF(A2:A6,"ORD-?")')).toBe(5);
    expect(ev('COUNTIF(D2:D6,"*ing")')).toBe(2);
    expect(ev('SUMIF(E2:E6,"North")')).toBe(0);
    expect(ev('SUMIF(E2:E6,"North",C2:C6)')).toBe(295.5);
    expect(ev('AVERAGEIFS(C2:C6,E2:E6,"North")')).toBeCloseTo(98.5);
    expect(ev('MAXIFS(C2:C6,E2:E6,"North")')).toBe(120);
    expect(ev('MINIFS(C2:C6,D2:D6,"Pending")')).toBe(120);
    expect(ev('COUNTIFS(B2:B6,">="&DATE(2026,2,1),B2:B6,"<"&DATE(2026,3,1))')).toBe(2);
    expect(ev('COUNTIFS(B2:B6,">=2026-02-01")')).toBe(3);
  });
  test('logic', () => {
    expect(ev('IF(C2>150,"big","small")')).toBe('small');
    expect(ev('IFS(C3>300,"A",C3>200,"B",TRUE,"C")')).toBe('B');
    expect(ev('AND(1,TRUE)')).toBe(true);
    expect(ev('OR(FALSE,0)')).toBe(false);
    expect(ev('XOR(TRUE,TRUE)')).toBe(false);
    expect(ev('SWITCH(E2,"North",1,"South",2,0)')).toBe(1);
    expect(ev('SWITCH("x","a",1)')).toBe('#N/A');
    expect(ev('IFNA(MATCH("zz",A2:A6,0),"missing")')).toBe('missing');
    expect(ev('ISNUMBER(C2)')).toBe(true);
    expect(ev('ISTEXT(C2)')).toBe(false);
    expect(ev('ISBLANK(G2)')).toBe(true);
    expect(ev('SUM(IF(E2:E6="North",C2:C6,0))')).toBe(295.5);
  });
  test('lookups', () => {
    expect(ev('VLOOKUP("ORD-4",A2:F6,3,FALSE)')).toBe(400);
    expect(ev('VLOOKUP("ORD-9",A2:F6,3,FALSE)')).toBe('#N/A');
    expect(ev('VLOOKUP(130,{0,"low";100,"mid";300,"high"},2)')).toBe('mid');
    expect(ev('HLOOKUP("amount",A1:F6,3,FALSE)')).toBe(250);
    expect(ev('INDEX(C2:C6,MATCH("ORD-3",A2:A6,0))')).toBe(75.5);
    expect(ev('INDEX(A1:F6,2,5)')).toBe('North');
    expect(ev('MATCH(120,{50,100,200})')).toBe(2);
    expect(ev('XLOOKUP("ORD-2",A2:A6,E2:E6)')).toBe('South');
    expect(ev('XLOOKUP("nope",A2:A6,E2:E6,"none")')).toBe('none');
    expect(ev('XLOOKUP("North",E2:E6,C2:C6,,0,-1)')).toBe(120);
    expect(ev('XLOOKUP(130,{50;100;200},{1;2;3},,-1)')).toBe(2);
    expect(ev('XLOOKUP(130,{50;100;200},{1;2;3},,1)')).toBe(3);
    expect(ev('XMATCH("Pending",D2:D6)')).toBe(2);
    expect(ev('CHOOSE(2,"a","b","c")')).toBe('b');
  });
  test('text', () => {
    expect(ev('LEFT(A2,3)')).toBe('ORD');
    expect(ev('RIGHT(A2,1)')).toBe('1');
    expect(ev('MID("abcdef",2,3)')).toBe('bcd');
    expect(ev('LEN(D2)')).toBe(9);
    expect(ev('UPPER("ab")&LOWER("CD")')).toBe('ABcd');
    expect(ev('PROPER("hello wORLD")')).toBe('Hello World');
    expect(ev('TRIM("  a   b ")')).toBe('a b');
    expect(ev('TEXTJOIN(", ",TRUE,E2:E4)')).toBe('North, South, North');
    expect(ev('CONCAT("a",1,TRUE)')).toBe('a1TRUE');
    expect(ev('SUBSTITUTE("a-b-c","-","+")')).toBe('a+b+c');
    expect(ev('SUBSTITUTE("a-b-c","-","+",2)')).toBe('a-b+c');
    expect(ev('FIND("D",A2)')).toBe(3);
    expect(ev('SEARCH("d",A2)')).toBe(3);
    expect(ev('FIND("d",A2)')).toBe('#VALUE!');
    expect(ev('VALUE("1,200")')).toBe(1200);
    expect(ev('REPT("ab",3)')).toBe('ababab');
    expect(ev('EXACT("a","A")')).toBe(false);
    expect(ev('TEXT(B2,"mmm yyyy")')).toBe('Jan 2026');
    expect(ev('TEXT(1234.5,"#,##0.00")')).toBe('1,234.50');
    expect(ev('TEXT(0.256,"0.0%")')).toBe('25.6%');
    expect(formatText('2026-03-01', 'dddd')).toBe('Sunday');
  });
  test('dates', () => {
    expect(ev('MONTH(B4)')).toBe(2);
    expect(ev('DAY(B5)')).toBe(14);
    expect(ev('EOMONTH(B2,1)')).toBe('2026-02-28');
    expect(ev('EDATE("2026-01-31",1)')).toBe('2026-02-28');
    expect(ev('WEEKDAY(B2)')).toBe(2); // Monday
    expect(ev('WEEKDAY(B2,2)')).toBe(1);
    expect(ev('WEEKNUM("2026-01-05")')).toBe(2);
    expect(ev('DATEDIF(B2,B6,"m")')).toBe(1);
    expect(ev('DATEDIF("2024-02-29","2026-03-01","y")')).toBe(2);
    expect(ev('DAYS(B6,B2)')).toBe(55);
    expect(ev('NETWORKDAYS("2026-01-05","2026-01-16")')).toBe(10);
    expect(ev('DATE(2026,13,1)')).toBe('2027-01-01');
    expect(ev('MAX(B2:B6)')).toBe(46082);
    expect(ev('TEXT(MAX(B2:B6),"yyyy-mm-dd")')).toBe('2026-03-01');
  });
  test('dynamic arrays', () => {
    expect(ev('FILTER(A2:A6,D2:D6="Pending")')).toEqual([['ORD-2'], ['ORD-5']]);
    expect(ev('FILTER(A2:A6,C2:C6>1000,"none")')).toBe('none');
    expect(ev('FILTER(A2:A6,C2:C6>1000)')).toBe('#CALC!');
    expect(ev('SORT(C2:C6,1,-1)')).toEqual([[400], [250], [120], [100], [75.5]]);
    expect(ev('SORTBY(A2:A6,C2:C6,1)')[0]).toEqual(['ORD-3']);
    expect(ev('UNIQUE(E2:E6)')).toEqual([['North'], ['South'], ['East']]);
    expect(ev('UNIQUE(E2:E6,,TRUE)')).toEqual([['South'], ['East']]);
    expect(ev('SEQUENCE(2,3,10,5)')).toEqual([[10, 15, 20], [25, 30, 35]]);
    expect(ev('TRANSPOSE({1,2,3})')).toEqual([[1], [2], [3]]);
    expect(ev('TAKE(SORT(C2:C6,1,-1),2)')).toEqual([[400], [250]]);
    expect(ev('TAKE(A2:A6,-1)')).toEqual([['ORD-5']]);
    expect(ev('ROWS(UNIQUE(E2:E6))')).toBe(3);
    expect(ev('LET(x,C2,y,x*2,x+y)')).toBe(300);
    expect(ev('LET(n,E2:E6,SUM(--(n="North")))')).toBe(3);
    expect(ev('SUM(COUNTIFS(E2:E6,UNIQUE(E2:E6)))')).toBe(5);
  });
});
