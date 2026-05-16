// Deterministic Linear Congruential Generator. Same seed → same sequence,
// reproducible across machines. Numerical-Recipes constants.
export class Rng {
  private state: number;
  readonly seed: number;
  constructor(seed: number) {
    this.seed = seed >>> 0 || 1;
    this.state = this.seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array');
    return arr[this.int(arr.length)] as T;
  }
  reset(): void {
    this.state = this.seed;
  }
}
