# Plancktons

Interactive 3D study of **Hill T₁ orthoschemes** ("Plancktons") and their
random face-to-face assemblies. Browser playground plus a headless CLI for
batch runs.

**Live:** <https://andymai.github.io/plancktons/>

**Deep dive:** [THEORY.md](./THEORY.md) - Schläfli orthoschemes, Hilbert's
third problem, Matoušek-Safernová's m³-reptile theorem, jamming, gyration-
tensor descriptors, fractal dimension, pair correlation, and where Plancktons
sit relative to sphere FCC, regular-tet packing, and random close packing in
the literature.

**Proof of zero overlap:** [docs/PROOF.md](./docs/PROOF.md) - separating-
axis test correctness + numerical margin analysis.

## What's a Planckton?

The Hill orthoscheme T₁ (Hill 1896): the right tetrahedron with vertices

```
V₀ = (0, 0, 0)   V₁ = (L, 0, 0)   V₂ = (L, L, 0)   V₃ = (L, L, L)
```

Volume `L³ / 6`. Six edges of three distinct lengths `(L, L√2, L√3)`. Four
right-triangle faces:

- `(L, L, L√2)` isoceles right (×2)
- `(L, L√2, L√3)` scalene right (×2)

All 6 dihedral angles are rational multiples of π - i.e. the Dehn invariant
is zero - which is exactly the condition that makes T₁ scissors-congruent to
a cube. So 6 Plancktons tile a cube, 8 tile a doubled Planckton (the m³
reptile), 64 tile it recursively, etc. By Matoušek-Safernová (2010) this is
the **only** k-reptile family for tetrahedra (k = m³).

The chiral mirror is its other handedness (red = right-handed, white =
left-handed in the default color scheme).

## Scenes

1. **Single Planckton inspector** - chiral pair side by side, toggle
   handedness, dihedral angles in rational π form.
2. **6-piece cube tiling** - six Plancktons (3 R + 3 L) tile a unit cube
   exactly. Explode slider. η = 1.
3. **8-reptile dissection** - eight unit Plancktons tile a doubled
   Planckton; recurse to 64 sub-Plancktons. η = 1 at every depth.
4. **Random face-to-face growth** - face-restricted cluster aggregation
   (Eden-like growth on the face graph) with SAT overlap rejection. Live
   readout of two distinct η values, gyration descriptors, free-face shape
   counts, vertex / tet coordination, bbox.

## The two η values

The HUD reports **both**:

| Metric  | Formula     | Meaning                                                                                                                                                                      |
| ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **η_C** | V★ / V_hull | Convex compactness - the hull shrink-wraps the aggregate, so this can approach 1 even for sparse clusters. Compare within this app, **not** to literature packing densities. |
| **η_B** | V★ / V_bbox | Bbox packing fraction. Bbox is a fixed-orientation container, so this **is** comparable to literature sphere RCP ≈ 0.636, FCC ≈ 0.74, etc.                                   |

V★ = N · L³/6 (exact sum of part volumes; face-to-face mating never overlaps).

## Two growth strategies

- **Uniform** - pick any free face with equal probability.
- **Compact** - Boltzmann weight `p(face) ∝ exp(β · n̂ · ĉ)` biases toward
  concave pockets (n̂ = outward face normal, ĉ = direction to assembly
  centroid). Slider over β: 0 recovers uniform, β ≈ 3 is the default sweet
  spot, β → ∞ is greedy.

Chirality bias slider `c_R ∈ [0, 1]` controls the per-attempt probability of
drawing a right-handed template. The resulting R:L ratio in the assembly
depends on which chiralities geometrically fit, not purely on the bias.

Both strategies use a two-phase placement:

1. **Phase 1** - random sampling, ≤ 80 attempts.
2. **Phase 2** - deterministic exhaustive search over every (free face ×
   chirality × template face × perm) before declaring "jammed". If any valid
   placement exists, it is found.

## Disclosure modes

A three-position switch in the topbar (**Learn / Explore / Research**) controls how much UI is exposed:

- **Learn** (default) — scene picker, essential growth parameters (N, seed, strategy), basic metrics tile (N, η_C, η_B, free surface). Inline dotted-underlined terms open a glossary popover; the `?` button opens a full help overlay with scene-aware primer + concepts + glossary tabs.
- **Explore** — adds the Display panel (colors, hull, gyration ellipsoid, edge outlines, render gap) and the advanced metrics sections (gyration / shape, bond-orientational order, topology / chirality, bounding box).
- **Research** — adds histograms, η-vs-N sweeps, pair correlation, kinetics, autocorrelation, MC refinement, and the morphological / Voronoi η variants. Reference packing densities overlay onto the plots.

Press `?` to cycle modes. The state round-trips through the share link as `m: learn|explore|research`; legacy links with `a: true/false` still decode (`true → research`, `false → learn`).

## Research mode features

- **Trial histogram** at fixed N - distribution of η_C, A/B overlay, mean ±
  SEM, CSV export with build provenance.
- **η vs N curve** - error band defaults to SEM (toggle to ±σ for trial
  spread). Choose **η_C** or **η_B** on the y axis. Fits three candidate
  models simultaneously:
  - `1 − η ∝ N^α` (pure power law) - reports `α ± Δα`
  - `1 − η = y∞ + B·N^(−β)` (asymptote + power correction)
  - `1 − η = y∞ + B·exp(−N/N₀)` (exponential approach)
  - Model selection by AIC; ΔAIC > 2 is meaningful.
- **Fractal dimension D_f** - fit from R_g ∼ N^(1/D_f). D_f → 3 for compact
  3D growth; lower values indicate fractal / surface-dominated aggregation.
- **Pair correlation g(r)** - averaged over an ensemble of seeds. Random
  uniform → 1; crystalline order → sharp peaks; amorphous → broad peaks
  decaying to 1.
- **Reference packing densities** table with full citations (Hales / Kepler
  conjecture, Conway-Torquato, Hoylman, Scott-Kilgour, Onoda-Liniger).

## Detailed HUD (growth scene)

| Section              | Quantities                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Bulk                 | N (with stalled marker), V★, V_hull, **η_C**, **η_B**, free surface                                               |
| Gyration / shape     | R_g, asphericity b, acylindricity c, anisotropy κ², prolateness S                                                 |
| Topology / chirality | R / L counts, free-face fraction, ⟨z⟩ tet-tet coordination, ⟨coord⟩ / max vertex coordination, free iso / scalene |
| Bounding box         | V_bbox, dims                                                                                                      |

Toggle the **gyration ellipsoid** overlay to see the principal axes of the
gyration tensor. NB: this is NOT the inertia ellipsoid - the inertia tensor
`I_ij = ⟨r²⟩δ_ij − ⟨rᵢrⱼ⟩` has different (orthogonal) principal directions.

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

# Parallel: fan trials out across N node:worker_threads. 'auto' picks
# max(1, min(8, cpus()-1)). Output is bit-identical to single-worker.
npm run study -- --N 50 --trials 500 --workers auto --out compact_par.csv
```

CSV columns:

```
trial, N, seed, V, Vbbox, Vstar, efficiency, bboxEfficiency, surface,
rg, kappaSq, prolateness, meanCoord, maxCoord, meanTetCoord, chirR, ms
```

(efficiency = η_C, bboxEfficiency = η_B, meanTetCoord = ⟨z⟩.)

Every CSV is prefixed with a `#`-commented provenance block:

```
# plancktons export
# algorithm_version=2
# commit=<short-sha>
# build_time=<iso>
# export_time=<iso>
# n_trials=200
# startSeed=1
# chiralityBias=0.5
# strategy=compact
# compactBeta=3
```

so re-runs months later can identify the exact code that produced the data.
JSON exports (`exportAssemblyJSON`) carry the same provenance object.

The CLI uses the same kernel as the browser, so results are bit-identical
and `seed_t = startSeed + t·9973` is fully reproducible.

## Export and share

- **Share link** - encodes scene/seed/N/strategy/β/chirality in the URL hash.
- **PNG** - canvas screenshot.
- **STL** - watertight STL of the current assembly.
- **JSON** - full state dump with provenance.

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle in dist/
npm run preview      # serve the bundle locally

npm run validate     # typecheck + lint + format:check + test
npm run test         # vitest
npm run test:coverage
```

Pre-commit hook (husky) runs `validate` automatically.

## Source layout

```
src/
  lib/                  Pure math (no React, no THREE imports allowed)
    Geometry kernel:    planckton, assembly, hull, mesh, canonicalScenes,
                        spatialHash, vertexHash, kdtree, validate
    Strategies & RNG:   rng, vec, constants
    Statistics:         study, studyClient, workerPool, scaling, shape,
                        paircorr, autocorr, kinetics, steinhardt,
                        embeddedCubes, mcRefine, morphology, voronoi
    I/O:                exports, svgExport, provenance, references, store
  scenes/               R3F components (read lib, never imported by lib)
    SceneCanvas, SingleScene, CubeScene, ReptileScene, GrowthScene,
    PlancktonMesh, HullMesh, GyrationEllipsoid, DihedralLabels, CameraFit
  ui/                   React UI (reads lib + scenes, never imported by lib)
    Chrome:             Controls, HUD, Actions, ModeSwitch, MetricsPanel,
                        ProgressBar, Transport, HelpOverlay, Term, glossary,
                        FirstVisitToast, icons, SvgPlot
    Layout:             ResizableSidebar, ResizablePane, ErrorBoundary
    State & hooks:      uiStore, useDraftValue, useKeyboard, useRadioGroup,
                        useWorkerRun, DraftSlider
    controls/           Per-scene control panels (Single, Cube, Reptile,
                        Growth, Display, Analyses)
    research/           Research-mode panels (Histogram, Curve, Kinetics,
                        Autocorr, PairCorrelation, Steinhardt, References)
  worker/
    study.worker.ts     Browser Web Worker entry (uses lib only)
scripts/
  study.ts              Headless batch CLI (npm run study)
  _studyWorker.ts       node:worker_threads worker used by --workers
  brepjsOverlap.ts      Independent OpenCascade overlap oracle (devDep)
  preliminary-analyze.ts, preliminary-q4.ts    Offline analysis helpers
tests/                  Vitest suites
docs/
  PROOF.md              SAT overlap-test correctness proof
data/preliminary/       CSVs backing THEORY.md §4.5
```

## Known gaps

- **No two-level Ns × trials fan-out for curve sweeps.** The browser pool
  partitions Ns across workers; if Ns is shorter than the pool size, some
  cores idle. A two-level partition would help short-Ns / many-trials
  sweeps but adds CurvePoint-merge complexity. The CLI sidesteps this by
  fanning trials within a single N across `node:worker_threads` (see
  `scripts/study.ts --workers`).

## References

The full bibliographic list is in [THEORY.md §5-§6](./THEORY.md). Key entries:

- M. J. M. Hill, _Determination of the volumes of certain species of
  tetrahedra without employment of the method of limits_, Proc. Lond. Math.
  Soc. 2:39 (1896).
- J. Matoušek & Z. Safernová, _On the nonexistence of k-reptile tetrahedra_,
  [arXiv:1006.1807](https://arxiv.org/abs/1006.1807) (2010).
- E. R. Chen, M. Engel & S. C. Glotzer, _Dense crystalline dimer packings of
  regular tetrahedra_, Discrete Comput. Geom. 44:253 (2010),
  [doi:10.1007/s00454-010-9273-0](https://doi.org/10.1007/s00454-010-9273-0).
- D. N. Theodorou & U. W. Suter, _Shape of unperturbed linear polymers:
  polypropylene_, Macromolecules 18:1206 (1985) - gyration descriptors.
- J. Rudnick & G. Gaspari, _The asphericity of random walks_, J. Phys. A
  19:L191 (1986) - κ² normalization.

## License

MIT - see [LICENSE](./LICENSE).
