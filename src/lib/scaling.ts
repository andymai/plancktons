// Least-squares regression utilities for the η(N) and rg(N) sweeps.
//
// fitLogLog:  y = A · x^α          (single power law)
// fitAsymptotePower:  y = y∞ + B · x^(-β)   (asymptote + power-law correction)
// fitExpDecay:  y = y∞ + B · exp(-x / N0)   (exponential approach)
//
// Each fit reports {params, σ on each param where available, R², AIC}. AIC
// enables principled model selection between the three forms; ΔAIC > 2 is
// considered meaningful evidence for the lower-AIC model.

export interface FitBase {
  /** Number of usable data points after filtering for finite/positive values. */
  n: number;
  /** Coefficient of determination on the fit's natural scale (log for LogLog). */
  r2: number;
  /** Akaike Information Criterion. Lower = better. */
  aic: number;
}

export interface LogLogFit extends FitBase {
  /** Slope in ln(y) = α·ln(x) + intercept, so y = exp(intercept)·x^α. */
  alpha: number;
  /** 1-sigma uncertainty on alpha from Var(α) = MSE / Σ(ln xᵢ - ⟨ln x⟩)². */
  alphaErr: number;
  intercept: number;
  interceptErr: number;
}

export interface AsymptotePowerFit extends FitBase {
  yInf: number;
  B: number;
  /** Decay exponent β > 0 in y = y∞ + B·x^(-β). */
  beta: number;
}

export interface ExpDecayFit extends FitBase {
  yInf: number;
  B: number;
  /** Decay scale N0 > 0 in y = y∞ + B·exp(-x / N0). */
  N0: number;
}

export function fitLogLog(xs: ReadonlyArray<number>, ys: ReadonlyArray<number>): LogLogFit | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const lx: number[] = [];
  const ly: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i] as number;
    const y = ys[i] as number;
    if (x > 0 && Number.isFinite(y) && y > 0) {
      lx.push(Math.log(x));
      ly.push(Math.log(y));
    }
  }
  const n = lx.length;
  if (n < 3) return null;
  const mx = lx.reduce((s, v) => s + v, 0) / n;
  const my = ly.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = lx[i]! - mx;
    const dy = ly[i]! - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx < 1e-15) return null;
  const alpha = sxy / sxx;
  const intercept = my - alpha * mx;
  const r2 = syy < 1e-15 ? 1 : (sxy * sxy) / (sxx * syy);
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const resid = ly[i]! - (alpha * lx[i]! + intercept);
    sse += resid * resid;
  }
  const dof = Math.max(1, n - 2);
  const mse = sse / dof;
  const alphaErr = Math.sqrt(mse / sxx);
  const interceptErr = Math.sqrt(mse * (1 / n + (mx * mx) / sxx));
  const aic = computeAic(n, sse, 2);
  return { alpha, alphaErr, intercept, interceptErr, r2, aic, n };
}

/**
 * y = y∞ + B · x^(-β), β > 0. Nonlinear in β; at fixed β the conditional fit
 * is OLS on basis [1, x^(-β)], so we grid-search β and pick the minimum SSE.
 * Crude but adequate for ~10 data points.
 */
export function fitAsymptotePower(
  xs: ReadonlyArray<number>,
  ys: ReadonlyArray<number>
): AsymptotePowerFit | null {
  const { xx, yy } = filterFinite(xs, ys);
  const n = xx.length;
  if (n < 4) return null;
  let bestSse = Infinity;
  let bestBeta = 1;
  let bestYInf = 0;
  let bestB = 0;
  for (let logBeta = -2; logBeta <= 2.5; logBeta += 0.05) {
    const beta = Math.exp(logBeta);
    const basis = xx.map((x) => Math.pow(x, -beta));
    const lin = linearFit(basis, yy);
    if (!lin) continue;
    if (lin.sse < bestSse) {
      bestSse = lin.sse;
      bestBeta = beta;
      bestYInf = lin.a;
      bestB = lin.b;
    }
  }
  return {
    yInf: bestYInf,
    B: bestB,
    beta: bestBeta,
    n,
    r2: r2From(yy, bestSse),
    aic: computeAic(n, bestSse, 3),
  };
}

/** y = y∞ + B · exp(-x / N0), N0 > 0. Same grid-search strategy as above. */
export function fitExpDecay(
  xs: ReadonlyArray<number>,
  ys: ReadonlyArray<number>
): ExpDecayFit | null {
  const { xx, yy } = filterFinite(xs, ys);
  const n = xx.length;
  if (n < 4) return null;
  const xMax = Math.max(...xx);
  const lo = Math.log(Math.max(1e-3, xMax / 50));
  const hi = Math.log(xMax * 5);
  let bestSse = Infinity;
  let bestN0 = xMax;
  let bestYInf = 0;
  let bestB = 0;
  for (let k = 0; k <= 100; k++) {
    const N0 = Math.exp(lo + ((hi - lo) * k) / 100);
    const basis = xx.map((x) => Math.exp(-x / N0));
    const lin = linearFit(basis, yy);
    if (!lin) continue;
    if (lin.sse < bestSse) {
      bestSse = lin.sse;
      bestN0 = N0;
      bestYInf = lin.a;
      bestB = lin.b;
    }
  }
  return {
    yInf: bestYInf,
    B: bestB,
    N0: bestN0,
    n,
    r2: r2From(yy, bestSse),
    aic: computeAic(n, bestSse, 3),
  };
}

/** OLS fit y = a + b·x, returning the SSE for downstream R²/AIC. */
function linearFit(xs: number[], ys: number[]): { a: number; b: number; sse: number } | null {
  const n = xs.length;
  if (n < 2) return null;
  const sx = xs.reduce((s, v) => s + v, 0);
  const sy = ys.reduce((s, v) => s + v, 0);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += xs[i]! * xs[i]!;
    sxy += xs[i]! * ys[i]!;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-18) return null;
  const b = (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const r = ys[i]! - (a + b * xs[i]!);
    sse += r * r;
  }
  return { a, b, sse };
}

function r2From(ys: number[], sse: number): number {
  if (ys.length === 0) return 0;
  const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
  const sstot = ys.reduce((s, v) => s + (v - mean) ** 2, 0);
  return sstot < 1e-18 ? 1 : 1 - sse / sstot;
}

function filterFinite(
  xs: ReadonlyArray<number>,
  ys: ReadonlyArray<number>
): { xx: number[]; yy: number[] } {
  const xx: number[] = [];
  const yy: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i] as number;
    const y = ys[i] as number;
    if (Number.isFinite(x) && Number.isFinite(y) && x > 0) {
      xx.push(x);
      yy.push(y);
    }
  }
  return { xx, yy };
}

// AIC for Gaussian residuals: n · ln(SSE/n) + 2·k. Additive constants cancel
// in model comparisons.
function computeAic(n: number, sse: number, k: number): number {
  if (sse <= 0 || !Number.isFinite(sse)) return Infinity;
  return n * Math.log(sse / n) + 2 * k;
}
