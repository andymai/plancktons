// Shared numerical constants used across the simulation kernel. Bumping any
// of these changes simulation output, so ALGORITHM_VERSION in provenance.ts
// must be bumped in lockstep. Keep this file dependency-free.

/**
 * SAT separating-axis test margin, expressed as a fraction of edge length L.
 * Two projected intervals are deemed disjoint iff `aMax + L·SAT_MARGIN_FRAC < bMin`
 * (or vice versa). Justified in `docs/PROOF.md`: ~10 orders of magnitude
 * above the floating-point error bound, ~10⁴× smaller than legitimate
 * face/edge/vertex contact.
 */
export const SAT_MARGIN_FRAC = 1e-4;

/**
 * Per-trial seed stride. Trial `t` runs with `seed = startSeed + t · SEED_STRIDE`.
 * Picked as a prime number far from the LCG modulus to decorrelate trials.
 * The worker-pool slice/merge logic and the CLI both depend on this exact
 * value to reproduce single-worker output bit-identically.
 */
export const SEED_STRIDE = 9973;

/**
 * Default ceiling on Phase-1 random placement attempts before falling back
 * to Phase-2 exhaustive search. See `growOne` in assembly.ts.
 */
export const MAX_ATTEMPTS_PER_STEP = 80;

/**
 * Spatial-hash cell side, as a multiple of L. Hill T₁'s bounding-sphere
 * radius is √3·L/2 ≈ 0.87L, so any pair of centroids more than 2L apart
 * cannot overlap. A 3×3×3 stencil over cells of side 2L covers √3·2L ≈ 3.46L,
 * comfortably larger than the 2·0.87L = 1.73L cutoff.
 */
export const SPATIAL_HASH_CELL_FACTOR = 2;

/**
 * Absolute tolerance for edge-length and triangle-signature comparisons.
 * Used by `sigEq` and `matchPerms` in planckton.ts.
 */
export const EDGE_LENGTH_EPS = 1e-6;
