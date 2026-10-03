// A/B test statistics, implemented from first principles so every number can
// be explained: normal and t distributions, a two proportion z test, Welch's
// t test, sample size for a given power, and a sample ratio mismatch check.

// Error function, Abramowitz and Stegun 7.1.26 (error below 1.5e-7).
const erf = (x) => {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
};
export const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

// Inverse normal CDF, Acklam's rational approximation (error about 1e-9).
export const normInv = (p) => {
  if (p <= 0 || p >= 1) return p <= 0 ? -Infinity : Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -normInv(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
};

// Log gamma (Lanczos) and the regularised incomplete beta function, for the t distribution.
const logGamma = (x) => {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += g[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
};
const betacf = (a, b, x) => {
  const qab = a + b; const qap = a + 1; const qam = a - 1;
  let c = 1; let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
};
const incBeta = (x, a, b) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
};
// Two sided p value of a t statistic with df degrees of freedom.
export const tTwoSided = (t, df) => incBeta(df / (df + t * t), df / 2, 0.5);

// Two proportion z test. Pooled standard error for the test (assumes no
// difference), unpooled standard error for the confidence interval.
export const proportionTest = ({ nA, xA, nB, xB, alpha = 0.05 }) => {
  const pA = xA / nA;
  const pB = xB / nB;
  const pool = (xA + xB) / (nA + nB);
  const sePool = Math.sqrt(pool * (1 - pool) * (1 / nA + 1 / nB));
  const z = sePool ? (pB - pA) / sePool : 0;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  const se = Math.sqrt((pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB);
  const zc = normInv(1 - alpha / 2);
  const diff = pB - pA;
  return { pA, pB, diff, uplift: pA ? diff / pA : null, z, p, ci: [diff - zc * se, diff + zc * se], significant: p < alpha };
};

// Welch's t test for a continuous metric (for example revenue per user)
// when the two groups may have different variances.
export const welchTest = ({ meanA, sdA, nA, meanB, sdB, nB, alpha = 0.05 }) => {
  const vA = (sdA * sdA) / nA;
  const vB = (sdB * sdB) / nB;
  const se = Math.sqrt(vA + vB);
  const t = se ? (meanB - meanA) / se : 0;
  const df = (vA + vB) ** 2 / ((vA * vA) / (nA - 1) + (vB * vB) / (nB - 1));
  const p = tTwoSided(t, df);
  const zc = normInv(1 - alpha / 2); // large sample interval
  const diff = meanB - meanA;
  return { diff, uplift: meanA ? diff / meanA : null, t, df, p, ci: [diff - zc * se, diff + zc * se], significant: p < alpha };
};

// Users needed per arm to detect a relative lift of mde over the baseline
// conversion rate with a two sided test.
export const sampleSize = ({ baseline, mde, alpha = 0.05, power = 0.8 }) => {
  const p1 = baseline;
  const p2 = baseline * (1 + mde);
  const pBar = (p1 + p2) / 2;
  const za = normInv(1 - alpha / 2);
  const zb = normInv(power);
  const num = (za * Math.sqrt(2 * pBar * (1 - pBar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2;
  return Math.ceil(num / (p2 - p1) ** 2);
};

// Sample ratio mismatch: chi square test of the observed split against the
// planned split (1 degree of freedom for two arms).
export const srmCheck = ({ nA, nB, splitA = 0.5 }) => {
  const total = nA + nB;
  const eA = total * splitA;
  const eB = total - eA;
  const chi2 = (nA - eA) ** 2 / eA + (nB - eB) ** 2 / eB;
  const p = 2 * (1 - normCdf(Math.sqrt(chi2)));
  return { chi2, p, mismatch: p < 0.001, observedA: total ? nA / total : null };
};
