// Ordinary least-squares fit to a log-log relation: y = A · x^α.
//   ln y = α ln x + ln A
// Returns {alpha, lnA, r2}.  Useful for fitting V ~ N^α, S ~ N^β.

export interface LogLogFit {
  alpha: number;
  intercept: number; // ln A
  r2: number;
  n: number;
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
  let mx = 0,
    my = 0;
  for (let i = 0; i < n; i++) {
    mx += lx[i]!;
    my += ly[i]!;
  }
  mx /= n;
  my /= n;
  let sxx = 0,
    sxy = 0,
    syy = 0;
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
  return { alpha, intercept, r2, n };
}
