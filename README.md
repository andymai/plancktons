# Plancktons

Interactive 3D study of **Hill tetrahedra** ("Plancktons") and their random
face-to-face assemblies. A research-grade playground in the browser, plus a
headless CLI for batch runs.

**Live:** <https://andymai.github.io/plancktons/>

**Deep dive:** [THEORY.md](./THEORY.md) - Schläfli orthoschemes, Hilbert's
third problem, Matoušek's m³-reptile theorem, RSA jamming, gyration-tensor
descriptors, and where Plancktons sit relative to sphere FCC, regular-tet
packing, and random close packing in the literature.

## What's a Planckton?

The convex hull of `0, b₁, b₁+b₂, b₁+b₂+b₃` for three equal-length vectors at
equal pairwise angles in `(0, 2π/3)`. The standard orthonormal form has
vertices `(0,0,0), (L,0,0), (L,L,0), (L,L,L)` and volume `L³ / 6`.

Two face types, both right triangles:

- `(L, L, L√2)` isoceles right (×2)
- `(L, L√2, L√3)` scalene right (×2)

All 6 dihedral angles are _rational_ multiples of π - which is exactly the
condition (Dehn invariant = 0) making the Hill T scissors-congruent to a
cube. So 6 Plancktons tile a cube, 8 tile a doubled Planckton, 64 tile it
recursively, etc. - the **only** known reptile family of tetrahedra.

The chiral mirror is its other handedness (red = right-handed, white =
left-handed in the default color scheme).

## Scenes

1. **Single Planckton inspector** - chiral pair side by side, toggle
   handedness.
2. **6-piece cube tiling** - six Plancktons (3 R + 3 L, one per permutation
   of `(x, y, z)`) tile a cube exactly. Explode slider.
3. **8-reptile dissection** - eight unit Plancktons tile a doubled Planckton;
   recurse to 64 sub-Plancktons. Per Matoušek & Safernová 2010, this is
   provably the _only_ k-reptile family for tetrahedra (`k = m³`).
4. **Random face-to-face growth** - RSA-style assembly. Live readout of:
   - `V★ = N L³/6` (sum of part volumes)
   - `V` = convex-hull volume (vacuum-bag shrink-wrap upper bound)
   - `η = V★/V` - packing efficiency
   - Free surface area, vertex coordination, free-face fraction
   - Gyration tensor: `R_g`, anisotropy `κ²`, prolateness `S`
   - Optional **inertia ellipsoid** overlay

## Two growth strategies

- **Uniform** - pick any free face with equal probability. Asymptotic
  efficiency `η_∞ ≈ 0.25` (branchy fractal-like pile).
- **Compact** - Boltzmann weight `p(face) ∝ exp(β · n̂ · ĉ)` biases toward
  concave pockets. Slider over `β`: `β = 0` recovers uniform; `β → ∞` is
  greedy. `β = 3` gives `η_∞ ≈ 0.34` - measurably tighter packing.

Chirality bias slider (`c_R ∈ [0, 1]`) controls the fraction of
right-handed templates drawn during growth.

## Research mode

Toggle **Advanced** in the sidebar to expose:

- **Trial histogram** at fixed `N` - distribution of `η`, mean ± std, CSV
  export.
- **`η` vs `N` curve** with confidence band, plus reference packing
  densities (sphere FCC `0.7405`, regular tet `0.717`, RCP `0.637`, …)
  drawn as horizontal lines.
- **Reference table** with full citations and source links.
- **Detailed HUD** showing gyration descriptors, vertex coordination,
  free-face shape counts, chirality counts, bbox.
- **Visual options**: color by chirality vs. by placement order; toggle hull
  / inertia ellipsoid; tweak tet inset, edge opacity.

## CLI - `scripts/study.ts`

For real ensemble averages, fit-grade statistics, and offline pipelines:

```bash
# 500 trials at N=50, compact β=4 → CSV
npm run study -- --N 50 --trials 500 --strategy compact --beta 4 \
    --out compact_b4.csv

# Sweep N at constant trials → one CSV
npm run study -- --sweep-N 10,20,30,50,80,120 --trials 200 \
    --strategy uniform --out uniform_sweep.csv

# JSON Lines, for streaming into a notebook
npm run study -- --N 30 --trials 1000 --format jsonl --out trials.jsonl
```

CSV columns: `trial, N, seed, V, Vstar, efficiency, surface, rg, kappaSq,
prolateness, meanCoord, maxCoord, chirR, ms`. The CLI uses the same kernel as
the browser, so results are bit-identical and `seed` is fully reproducible
(`seed_t = startSeed + t·9973`).

## Export and share

- **🔗 Share link** - encodes scene/seed/N/strategy/β/chirality in the URL
  hash. Click, paste, identical view.
- **📸 PNG** - high-res canvas screenshot.
- **🧊 STL** - watertight STL of the current assembly (for 3D printing).
- **💾 JSON** - full state dump (vertices, chirality).

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle in dist/
npm run preview      # serve the bundle locally

# Validation
npm run sanity       # 12 unit-style checks of the core math
npm run test:overlap # 150 random assemblies, asserts no tet–tet overlap
```

## Source layout

```
src/
  lib/                  Pure math (no React, no THREE)
    vec.ts              Vec3 helpers
    rng.ts              Seeded LCG (reproducible)
    planckton.ts        Hill T construction, face mating, overlap test
    assembly.ts         Free-face tracking, growth strategies, coordination
    hull.ts             quickhull3d wrapper + volume + bbox
    shape.ts            Gyration tensor, Jacobi eigensolve, κ², S
    scaling.ts          Log-log OLS fit (R²)
    references.ts       Published packing densities + citations
    canonicalScenes.ts  6-cube + 8-reptile constructions
    mesh.ts             Planckton → THREE.BufferGeometry
    exports.ts          STL / JSON / PNG / URL-share
    study.ts            Multi-trial batch runner
    store.ts            Zustand UI state
    validate.ts         Pairwise overlap auditor (used in tests)
    __sanity__.ts       12 math regression tests (npm run sanity)
    __overlap_test__.ts Stress test (npm run test:overlap)
  scenes/               R3F scene components
    SceneCanvas.tsx
    SingleScene.tsx
    CubeScene.tsx
    ReptileScene.tsx
    GrowthScene.tsx     ref-cached incremental growth
    PlancktonMesh.tsx   tet inset for z-fight avoidance
    HullMesh.tsx
    InertiaEllipsoid.tsx
  ui/
    Controls.tsx
    HUD.tsx
    Actions.tsx
    Research.tsx        histograms, sweep curves, CSV download
scripts/
  study.ts              Headless batch CLI (npm run study)
```

## Status / known gaps

- **Voronoi / alpha-shape `V_α`** - planned. Convex hull `V` is an
  _upper_ bound on the true vacuum-bag volume; assemblies with deep
  concavities have `V_α < V`.
- **Worker pool** - heavy Research-mode sweeps (e.g. 500 trials × 12 N
  values) currently block the main thread. CLI is the workaround.
- **Metropolis MC post-growth refinement** - would let `η_∞` approach the
  true greedy maximum.

## References

The full bibliographic list is in [THEORY.md §5–§6](./THEORY.md). The big two:

- M.J.M. Hill, _Determination of the volumes of certain species of
  tetrahedra without employment of the method of limits_, _Proc. Lond. Math.
  Soc._ 2:39 (1896).
- J. Matoušek & Z. Safernová, _On the nonexistence of k-reptile tetrahedra_,
  [arXiv:1006.1807](https://arxiv.org/abs/1006.1807) (2010).
- J.H. Conway & S. Torquato, _Packing, tiling, and covering with tetrahedra_,
  PNAS 103:10612 (2006).

## License

MIT - see [LICENSE](./LICENSE).
