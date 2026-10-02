// Chart palette (validated categorical order, light surface). Colors follow the
// entity, never its rank: assign by stable index (e.g. plan line order).
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

// Reserved for state; always paired with an icon + label.
export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };

export const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
};

// Sequential blue ramp (light → dark) for heatmaps.
export const SEQ_BLUE = ['#f0f6fe', '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];

export const seqColor = (value, max) => {
  if (!max || value <= 0) return SEQ_BLUE[0];
  const idx = Math.min(SEQ_BLUE.length - 1, Math.max(1, Math.round((value / max) * (SEQ_BLUE.length - 1))));
  return SEQ_BLUE[idx];
};

export const AXIS_PROPS = {
  tick: { fontSize: 11, fill: INK.muted },
  axisLine: { stroke: INK.axis },
  tickLine: false,
};

export const GRID_PROPS = { strokeDasharray: '0', stroke: INK.grid, vertical: false };

export const TOOLTIP_PROPS = {
  contentStyle: { borderRadius: 8, border: '1px solid rgba(11,11,11,0.10)', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)', fontSize: 12 },
  labelStyle: { color: INK.primary, fontWeight: 600 },
  itemStyle: { color: INK.secondary },
};

// Recharts 3 chart-level click gives the active index, not the payload.
export const clickedRow = (e, data) => {
  const i = e && (e.activeIndex ?? e.activeTooltipIndex);
  const n = Number(i);
  return i !== undefined && i !== null && Number.isInteger(n) ? data[n] : undefined;
};

// Avoids Recharts' "width(-1)" warning on the first render before measuring.
export const CHART_INIT = { width: 600, height: 280 };
