#!/usr/bin/env -S npx tsx
// Aggregates the data/preliminary/*.csv outputs into mean ± SEM tables for
// the §4.5 prose in THEORY.md. Run after the four sweeps complete.

import { readFileSync } from 'node:fs';
import { fitLogLog } from '../src/lib/scaling.js';

function readTrialsCsv(path: string): Array<Record<string, number>> {
  const raw = readFileSync(path, 'utf-8');
  const lines = raw.split('\n').filter((l) => l && !l.startsWith('#'));
  const header = lines.shift()!.split(',');
  return lines.map((l) => {
    const cols = l.split(',');
    const o: Record<string, number> = {};
    for (let i = 0; i < header.length; i++) {
      o[header[i]!] = parseFloat(cols[i]!);
    }
    return o;
  });
}

function stats(xs: number[]): { mean: number; sem: number; n: number } {
  const n = xs.length;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : NaN;
  const sem = Math.sqrt(variance) / Math.sqrt(n);
  return { mean, sem, n };
}

function field(rows: Array<Record<string, number>>, key: string): number[] {
  return rows.map((r) => r[key]!).filter((v) => Number.isFinite(v));
}

console.log('# §4.6 Preliminary results — aggregation\n');

// ---------------------------------------------------------------------------
// Q1: chirality optimum
// ---------------------------------------------------------------------------
console.log('## Q1: chirality bias optimum (N=50, compact β=3, 500 trials)');
console.log('| c_R | ⟨η_C⟩ | SEM | ⟨η_B⟩ | SEM | nReached |');
console.log('| --- | ----- | --- | ----- | --- | -------- |');
for (const cr of ['0', '0_25', '0_5', '0_75', '1']) {
  const rows = readTrialsCsv(`data/preliminary/q1_chir_${cr}.csv`);
  const eC = stats(field(rows, 'efficiency'));
  const eB = stats(field(rows, 'bboxEfficiency'));
  const reached = rows.filter((r) => r.N >= 50).length;
  const crNum = cr.replace('_', '.');
  console.log(
    `| ${crNum} | ${eC.mean.toFixed(4)} | ${eC.sem.toFixed(4)} | ${eB.mean.toFixed(4)} | ${eB.sem.toFixed(4)} | ${reached}/${rows.length} |`
  );
}

// ---------------------------------------------------------------------------
// Q2: β saturation
// ---------------------------------------------------------------------------
console.log('\n## Q2: β saturation (N=50, c_R=0.5 compact, 500 trials)');
console.log('| β | ⟨η_C⟩ | SEM | ⟨η_B⟩ | SEM | nReached |');
console.log('| - | ----- | --- | ----- | --- | -------- |');
for (const b of ['0', '1', '2', '3', '5', '8', '12']) {
  const rows = readTrialsCsv(`data/preliminary/q2_beta_${b}.csv`);
  const eC = stats(field(rows, 'efficiency'));
  const eB = stats(field(rows, 'bboxEfficiency'));
  const reached = rows.filter((r) => r.N >= 50).length;
  console.log(
    `| ${b} | ${eC.mean.toFixed(4)} | ${eC.sem.toFixed(4)} | ${eB.mean.toFixed(4)} | ${eB.sem.toFixed(4)} | ${reached}/${rows.length} |`
  );
}

// ---------------------------------------------------------------------------
// Q3: fractal dimension
// ---------------------------------------------------------------------------
console.log('\n## Q3: fractal dimension D_f (sweep N, 200 trials, both strategies)');
for (const strat of ['compact', 'uniform']) {
  const rows = readTrialsCsv(`data/preliminary/q3_df_${strat}.csv`);
  const Ns: number[] = [];
  const rgs: number[] = [];
  const byN = new Map<number, number[]>();
  for (const r of rows) {
    if (!Number.isFinite(r.rg)) continue;
    if (!byN.has(r.N!)) byN.set(r.N!, []);
    byN.get(r.N!)!.push(r.rg!);
  }
  const sortedN = [...byN.keys()].sort((a, b) => a - b);
  console.log(`\n### ${strat} strategy`);
  console.log('| N | ⟨R_g⟩ | SEM | n |');
  console.log('| - | ----- | --- | - |');
  for (const N of sortedN) {
    const sN = stats(byN.get(N)!);
    Ns.push(N);
    rgs.push(sN.mean);
    console.log(`| ${N} | ${sN.mean.toFixed(4)} | ${sN.sem.toFixed(4)} | ${sN.n} |`);
  }
  const fit = fitLogLog(Ns, rgs);
  if (fit) {
    const Df = 1 / fit.alpha;
    const DfErr = fit.alphaErr / (fit.alpha * fit.alpha);
    console.log(
      `**D_f (${strat})** = 1 / slope[ln(R_g) vs ln(N)] = ${Df.toFixed(2)} ± ${DfErr.toFixed(2)} (R² = ${fit.r2.toFixed(3)})`
    );
  }
}

// ---------------------------------------------------------------------------
// Q4: g(r) first peak
// ---------------------------------------------------------------------------
console.log('\n## Q4: g(r) first-peak location (N=50, compact β=3, 100 trials)');
const grRaw = readFileSync('data/preliminary/q4_gr.csv', 'utf-8');
const grLines = grRaw.split('\n').filter((l) => l && !l.startsWith('#') && !l.startsWith('r,'));
const grPts = grLines.map((l) => {
  const [r, g] = l.split(',').map(Number);
  return { r: r!, g: g! };
});
// First-peak: argmax of g within r ∈ [0.4, 1.5] L (physical face-share regime).
const candidates = grPts.filter((p) => p.r > 0.4 && p.r < 1.5);
candidates.sort((a, b) => b.g - a.g);
const peak = candidates[0];
if (peak) {
  console.log(`First peak: r = ${peak.r.toFixed(3)} L, g(r) = ${peak.g.toFixed(2)}`);
  console.log(`Expected for face-shared centroids ≈ L·√(3/8) = ${Math.sqrt(3 / 8).toFixed(3)} L`);
}
