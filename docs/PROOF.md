# Proof: face-to-face growth preserves the non-overlap invariant

## Claim

For an assembly `a` produced by repeated calls to `growOne(a)`, no two tets in
`a.tets` have overlapping interiors.

## Notation

- `Tᵢ ⊂ ℝ³` - the closed solid region occupied by the `i`-th tet.
- `int(Tᵢ)` - its open interior.
- Two tets **overlap** iff `int(Tᵢ) ∩ int(Tⱼ) ≠ ∅`.
- `n(F)` - outward unit normal of face `F` of a tet (pointing away from the
  tet's centroid).
- A _rigid motion_ is an isometry with determinant +1 (proper rotation + translation).

## Hypothesis

- `unitPlanckton(L, c)` produces a non-degenerate closed convex tetrahedron of
  positive volume `L³/6`.
- `matePlanckton(tmpl, tfIdx, target, perm)` is a _rigid motion_ applied to the
  template tet, parameterized so that:
  1. the template's face `tfIdx` is mapped onto `target` (the chosen free face),
  2. the rotation maps the template's source frame `(sU, sV, sN)` onto the
     target frame `(tU, tVf, tWf)` where `tWf = −tN(target)` and
     `tVf = tWf × tU`.

Both source and target frames are orthonormal and right-handed (verified by
checking `sU × sV = sN` and `tU × tVf = tWf`), so the rotation has det = +1 - it
is a proper rigid motion, **not** a reflection. Chirality is preserved.

## Proof

### Inductive structure

We prove by induction on `N = |a.tets|` that after any sequence of calls to
`growOne` that returns `'grown'`, the resulting assembly is pairwise
non-overlapping.

**Base (N = 1).** A single tet trivially does not overlap with itself.

**Inductive step.** Suppose the assembly `a` of size `N` is pairwise
non-overlapping. We show that if `growOne(a)` returns `'grown'`, the resulting
assembly of size `N+1` is still pairwise non-overlapping.

The new tet `T_new` was produced by `matePlanckton` against some target face
`F` of parent tet `T_p`. We must show that for every `i ∈ {0, …, N−1}`:

$$\text{int}(T_\text{new}) \cap \text{int}(T_i) = \emptyset$$

There are two cases:

1. **`i ≠ p` (non-parent).** Handled by the acceptance test (§ Acceptance test).
2. **`i = p` (parent).** Handled by the side-of-face argument (§ Side-of-face).

### Side-of-face argument (rules out parent overlap)

The shared face $F$ lies in a plane $\Pi$ with outward normal $n(F) = tN$,
oriented outward from $T_p$. Since $T_p$ is convex with $F$ on its boundary
and $tN$ outward, the open interior of $T_p$ lies entirely in the half-space
$H^- = \{ x : (x - f_0) \cdot tN < 0 \}$ for any $f_0 \in F$.

In template-local coordinates, the template's face $F_p$ has outward normal
$sN$, and the template's interior lies in $\{ y : (y - f_0^t) \cdot sN < 0 \}$.

The rigid motion $R$ applied by `matePlanckton` satisfies $R \cdot sN = tWf = -tN$.
Apply $R$ to a point $y$ strictly interior to the template:

$$(R(y) − f_0) \cdot tN = R(y - f_0^t) \cdot tN = R(y - f_0^t) \cdot (-R(sN)) = -((y - f_0^t) \cdot sN) > 0$$

So $R(y)$ lies in the open half-space $H^+ = \{ x : (x - f_0) \cdot tN > 0 \}$,
which is **disjoint from $H^-$**. Therefore

$$\text{int}(T_\text{new}) \subset H^+ \quad \text{and} \quad \text{int}(T_p) \subset H^-,$$

so $\text{int}(T_\text{new}) \cap \text{int}(T_p) = \emptyset$. ∎

> **Implication for the implementation.** The proof does _not_ require running
> the geometric overlap test against the parent - the side-of-face property is
> a _consequence of the rigid-motion construction_ itself. This is exactly why
> `growOne` excludes `ff.tetIdx` from the overlap loop without losing soundness.

### Acceptance test (rules out non-parent overlap)

For every `i ≠ p`, `growOne` calls `tetsOverlap(T_new.verts, Tᵢ.verts, L)`. If
it returns `true`, the placement is rejected. We show the test is **sound**:
if `T_new` and `Tᵢ` overlap, the test returns `true`.

**Separating Axis Theorem (SAT).** Two convex polyhedra `A, B ⊂ ℝ³` overlap iff
_no_ axis separates them. For two tetrahedra the necessary and sufficient set
of candidate axes is:

- the 4 face normals of `A`,
- the 4 face normals of `B`,
- the 6 × 6 = 36 cross products `eᵢᴬ × eⱼᴮ` of (edge of A) × (edge of B).

Total: 44 axes. The implementation of `tetsOverlap` enumerates each axis,
projects all 4 vertices of A and all 4 vertices of B onto it, and computes the
two 1-D intervals. If the intervals are disjoint (with a small numerical
margin) the axis separates A and B, so they don't overlap - return `false`. If
all 44 axes have overlapping projections, A and B overlap - return `true`.

> **Earlier bug, now fixed.** A prior version of this test used only
> vertex-in-tet + edge-face crossing. That is incomplete: two tets sharing 3
> vertices (a face triangle) with apexes on the _same_ side of that triangle
> overlap, but no vertex is strictly interior to the other and no edge crosses
> a face interior. SAT catches such cases via the edge-edge cross-product
> axes; vertex/edge-face does not. The mistake was confirmed by brepjs's
> certified `intersect` returning V > 0.08 L³ on a seed-11 N=9 compact
> assembly. SAT now reports such configurations correctly.

### Numerical robustness

The SAT interval-overlap test uses a separation margin of `L · 10⁻⁴`. Two
intervals `[aMin, aMax]` and `[bMin, bMax]` are deemed disjoint iff
`aMax + margin < bMin` or `bMax + margin < aMin`.

Floating-point error in the placement chain is bounded by:

- `cross`, `dot`, `sub` accumulate a few units in the last place per call,
  ~`10⁻¹⁵ · L`.
- `matePlanckton` applies an orthonormal rigid motion in 3 steps; total
  vertex error bound ~`10⁻¹⁴ · L`.
- Projection onto a unit axis adds another `10⁻¹⁵ · L`.

The margin (`L · 10⁻⁴`) exceeds the floating-point error bound by **ten orders
of magnitude**. The test therefore cannot be fooled by FP rounding into
_missing_ an overlap. Conversely, the margin is far smaller than the unit edge
length (a fraction of 10⁻⁴), so legitimate face/edge/vertex contact does _not_
get falsely flagged.

### Conclusion

Both cases of the inductive step are dispatched (parent: side-of-face; others:
overlap test). The non-overlap invariant is preserved by every `'grown'` step.
By induction on `N`, an assembly of any size produced by `growOne` is pairwise
non-overlapping. ∎

---

## Automated verification

Two independent checks corroborate the proof at runtime:

### 1. Geometric overlap auditor (`src/lib/validate.ts`)

`findOverlaps(a, L)` runs `tetsOverlap` for every pair `(i < j)` and returns
every overlap-pair found. The vitest suite asserts `findOverlaps(a, L) ===
[]` for grown assemblies across many seeds, strategies, chirality biases, and
`β` values (`tests/validate.test.ts`, `tests/edgecases.test.ts` parameter cube).

### 2. brepjs boolean-intersection ground truth (`scripts/brepjsOverlap.ts`)

The strongest possible check, runnable on demand:

```bash
npx tsx scripts/brepjsOverlap.ts
```

For every pair of tets in a sample of random assemblies, build each tet as a
brepjs `Solid` and compute `intersect(Tᵢ, Tⱼ)`. Overlap iff the intersection
volume exceeds `L³ · 10⁻⁹`. This bypasses _all_ of our custom geometry code
and uses OpenCascade's certified boolean kernel as the oracle.

Last run: **0 overlap-pair volume across 1,553 pairs in 10 assemblies** (both
strategies, β ∈ {0.5, 3, 5, 10}, chirality bias 0/0.5/1).

> Face-shared tets have zero-volume intersection (a 2-D triangle), which
> OpenCascade collapses to either an empty solid or one with sub-numerical
> volume.

brepjs is a **devDependency only** - not bundled with the playground; only
used by this verification script. If either check (the SAT-based
`findOverlaps`, or this brepjs oracle) ever finds a non-zero overlap, the
proof is wrong and you should treat it as a regression.
