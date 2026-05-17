// fitLogLog: y = A · x^α
// fitAsymptotePower: y = y∞ + B · x^(-β)
// fitExpDecay: y = y∞ + B · exp(-x / N0)
// Each fit reports {params, R², AIC}. AIC enables model selection; ΔAIC > 2
// is meaningful evidence for the lower-AIC model.

export interface FitBase {
  n: number;
  r2: number;
  /** Akaike Information Criterion. Lower = better. */
  aic: number;
}

export interface LogLogFit extends FitBase {
  alpha: number;
  alphaErr: number;
  intercept: number;
  interceptErr: number;
}

export interface AsymptotePowerFit extends FitBase {
  yInf: number;
  B: number;
  beta: number;
}

export interface ExpDecayFit extends FitBase {
  yInf: number;
  B: number;
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
  const mx = mean(lx);
  const my = mean(ly);
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
  // Log-space SSE: drives alpha/intercept uncertainty (Var(α) = MSE_log / SS_xx).
  let sseLog = 0;
  for (let i = 0; i < n; i++) {
    const resid = ly[i]! - (alpha * lx[i]! + intercept);
    sseLog += resid * resid;
  }
  const mseLog = sseLog / Math.max(1, n - 2);
  const alphaErr = Math.sqrt(mseLog / sxx);
  const interceptErr = Math.sqrt(mseLog * (1 / n + (mx * mx) / sxx));
  // Linear-space SSE: drives AIC. The competing models (fitAsymptotePower,
  // fitExpDecay) compute SSE in y-space too, so AIC values are only
  // comparable when all three use the same residual scale.
  const A = Math.exp(intercept);
  let sseLinear = 0;
  for (let i = 0; i < n; i++) {
    const yPred = A * Math.exp(alpha * lx[i]!);
    const r = Math.exp(ly[i]!) - yPred;
    sseLinear += r * r;
  }
  return {
    alpha,
    alphaErr,
    intercept,
    interceptErr,
    r2,
    aic: computeAic(n, sseLinear, 2),
    n,
  };
}

export function fitAsymptotePower(
  xs: ReadonlyArray<number>,
  ys: ReadonlyArray<number>
): AsymptotePowerFit | null {
  const { xx, yy } = filterFinite(xs, ys);
  if (xx.length < 4) return null;
  // y = y∞ + B · x^(-β). Nonlinear in β; at fixed β the conditional fit is OLS
  // on basis [1, x^(-β)]. Grid-search β in log space (≈90 samples).
  const result = gridSearch(
    yy,
    logSpace(-2, 2.5, 0.05),
    (beta) => xx.map((x) => Math.pow(x, -beta)),
    1
  );
  return {
    yInf: result.a,
    B: result.b,
    beta: result.param,
    n: xx.length,
    r2: r2From(yy, result.sse),
    aic: computeAic(xx.length, result.sse, 3),
  };
}

export function fitExpDecay(
  xs: ReadonlyArray<number>,
  ys: ReadonlyArray<number>
): ExpDecayFit | null {
  const { xx, yy } = filterFinite(xs, ys);
  if (xx.length < 4) return null;
  const xMax = Math.max(...xx);
  // Grid-search N0 across [xMax/50, 5·xMax] in 101 log-spaced samples.
  const N0Grid: number[] = [];
  const lo = Math.log(Math.max(1e-3, xMax / 50));
  const hi = Math.log(xMax * 5);
  for (let k = 0; k <= 100; k++) N0Grid.push(Math.exp(lo + ((hi - lo) * k) / 100));
  const result = gridSearch(yy, N0Grid, (N0) => xx.map((x) => Math.exp(-x / N0)), xMax);
  return {
    yInf: result.a,
    B: result.b,
    N0: result.param,
    n: xx.length,
    r2: r2From(yy, result.sse),
    aic: computeAic(xx.length, result.sse, 3),
  };
}

interface GridSearchResult {
  param: number;
  a: number;
  b: number;
  sse: number;
}

// For each candidate `param`, fit y = a + b·basis(param, x) with OLS and
// pick the min-SSE param. When no grid point yields a valid linear fit, the
// fallback {param: defaultParam, a:0, b:0, sse:Infinity} flows through to
// r²=-∞ and AIC=Infinity downstream.
function gridSearch(
  yy: number[],
  paramGrid: number[],
  basisFor: (param: number) => number[],
  defaultParam: number
): GridSearchResult {
  let best: GridSearchResult = { param: defaultParam, a: 0, b: 0, sse: Infinity };
  let found = false;
  for (const param of paramGrid) {
    const lin = linearFit(basisFor(param), yy);
    if (!lin) continue;
    if (!found || lin.sse < best.sse) {
      best = { param, a: lin.a, b: lin.b, sse: lin.sse };
      found = true;
    }
  }
  return best;
}

function logSpace(loLog: number, hiLog: number, step: number): number[] {
  const out: number[] = [];
  for (let l = loLog; l <= hiLog + step * 0.5; l += step) out.push(Math.exp(l));
  return out;
}

/** OLS fit y = a + b·x, returning SSE for downstream R²/AIC. */
function linearFit(xs: number[], ys: number[]): { a: number; b: number; sse: number } | null {
  const n = xs.length;
  if (n < 2) return null;
  const sx = sum(xs);
  const sy = sum(ys);
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
  const m = mean(ys);
  const sstot = ys.reduce((s, v) => s + (v - m) ** 2, 0);
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

function sum(xs: ReadonlyArray<number>): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

function mean(xs: ReadonlyArray<number>): number {
  return sum(xs) / xs.length;
}

// AIC for Gaussian residuals: n · ln(SSE/n) + 2·k. Additive constants cancel
// in model comparisons.
function computeAic(n: number, sse: number, k: number): number {
  if (sse <= 0 || !Number.isFinite(sse)) return Infinity;
  return n * Math.log(sse / n) + 2 * k;
}
