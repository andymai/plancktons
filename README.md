<div align="center">

# Plancktons

[![CI](https://github.com/andymai/plancktons/actions/workflows/ci.yml/badge.svg)](https://github.com/andymai/plancktons/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/andymai/plancktons)](./LICENSE)

An interactive 3D study of how Hill T₁ tetrahedra pack together at random. Use it in the browser, or run batch studies with the headless CLI.

[Live](https://andymai.github.io/plancktons/) · [Theory](./THEORY.md) · [Proof](./docs/PROOF.md)

</div>

A Planckton is this project's name for the Hill T₁ orthoscheme. It is a tetrahedron (a solid with four triangular faces) with a chain of three edges, each at right angles to the other two. Six Plancktons fill a cube with no gaps. This project joins Plancktons face to face at random, measures how densely they pack, and shows each assembly in 3D. The browser playground runs the scenes live, and a headless CLI (a command-line tool with no browser) runs batch studies.

**Theory:** [THEORY.md](./THEORY.md) explains the mathematics and the literature behind the tool:

- Schläfli orthoschemes: simplices with a chain of perpendicular edges, the family of T₁
- Hilbert's third problem: can you always cut a polyhedron into pieces that form any other polyhedron of the same volume?
- Matoušek-Safernová's m³-reptile theorem: the numbers of smaller copies of itself that a tetrahedron can split into
- jamming: the point where no new Planckton fits
- gyration-tensor descriptors: numbers for the shape of an assembly
- fractal dimension: how the size of an assembly grows with the number of Plancktons
- pair correlation: how the density changes with distance
- where Plancktons sit relative to sphere FCC, regular-tetrahedron packing, and random close packing in the literature

**Proof of zero overlap:** [docs/PROOF.md](./docs/PROOF.md) proves that the separating-axis test (SAT) is correct, and it gives a numerical margin analysis. The SAT finds out if two convex solids overlap. If an axis exists where the projections of the two solids do not overlap, the solids do not overlap.

## What's a Planckton?

The Hill orthoscheme T₁ (Hill 1896) is the right tetrahedron with these vertices:

```
V₀ = (0, 0, 0)   V₁ = (L, 0, 0)   V₂ = (L, L, 0)   V₃ = (L, L, L)
```

Its volume is `L³ / 6`. Its six edges have three different lengths, `(L, L√2, L√3)`. Its four faces are right triangles:

- `(L, L, L√2)` isosceles right (×2)
- `(L, L√2, L√3)` scalene right (×2)

A dihedral angle is the angle between the two faces at an edge. All 6 dihedral angles of T₁ are rational multiples of π, so the Dehn invariant of T₁ is zero. The Dehn invariant combines each edge length with the dihedral angle at that edge. A zero Dehn invariant is exactly the condition that makes T₁ scissors-congruent to a cube. Thus you can cut T₁ into a finite number of pieces and put the pieces together again as a cube of the same volume.

So 6 Plancktons tile a cube, and 8 tile a doubled Planckton (a Planckton with edges twice as long). Each of the 8 pieces splits again in the same way, so 64 tile it at the next depth, and so on. This makes T₁ an m³-reptile: a solid that you can cut into m³ smaller copies of itself. By Matoušek-Safernová (2010), a tetrahedron can be a k-reptile **only** when k = m³.

T₁ is chiral: no rotation turns it into its mirror image. The mirror image has the other handedness. This README writes right-handed as R and left-handed as L. The default color scheme shows R Plancktons in red and L Plancktons in white.

## Scenes

Some scenes report η, the packing fraction. η is the part of a volume that the Plancktons fill, from 0 to 1.

1. **Single Planckton inspector:** the chiral pair side by side, with the dihedral angles as rational multiples of π. A toggle changes the handedness.
2. **Cube triptych:** three 6-piece cube dissections side by side. One is the classical geometric cube (3R+3L), cut along the main diagonal. The other two are the HT-realizable mirrors (4R+2L, 2R+4L): you can build them from the pieces of one Matoušek decomposition. One explode slider moves the pieces of all three cubes apart at the same time. η = 1 for each cube.
3. **8-reptile dissection:** eight unit Plancktons tile a doubled Planckton. Split each piece again to get 64 sub-Plancktons. η = 1 at every depth.
4. **Random face-to-face growth:** face-restricted cluster aggregation, an Eden-like growth on the face graph. Each step attaches a new Planckton to a free face (a face that touches no other Planckton). The SAT rejects each placement that overlaps a Planckton in the assembly.

   A live readout shows the two η values and the gyration descriptors (numbers that describe the shape of the assembly). It also shows the count of free faces of each shape, vertex and tet coordination, and the bounding box (bbox). Vertex coordination is the number of Plancktons that meet at a vertex. Tet coordination is the number of neighbors that share a face with each Planckton ("tet" is short for tetrahedron).

5. **Vacuum-bag compaction:** N loose Plancktons, each with a free orientation, go into a "bag" that contracts. The bag squeezes them into a jammed random packing, which the bag cannot squeeze further.

   The squeeze is a deterministic rigid-body settle with no friction. Each Planckton moves as a rigid body with six degrees of freedom (6-DOF). It uses the same seeded LCG (linear congruential generator) as growth, so the same seed reproduces the same packing. Press **Pack it** to run the settle off the main thread. Then drag the "% air removed" timeline to replay the air as it goes out of the bag.

   The wrinkled vacuum-seal skin is the morphological hull of the sealed pack: its outline with the small pockets filled. On the final jammed frame, the scene computes η (η_C, η_B, η_M, η_V), R_g (the radius of gyration), and a contact-coordination number. The contact-coordination number is the mean number of contacts for each Planckton.

   Unlike in growth, the Plancktons here do _not_ mate face to face. They touch only where the physics pushes them together. Thus this is a different kind of packing: looser, with no friction.

## The two η values

The HUD (the on-screen panel of live metrics) reports **both** values:

| Metric  | Formula     | Meaning                                                                                                                                                                                                         |
| ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **η_C** | V★ / V_hull | Convex compactness. The hull shrink-wraps the assembly, so this value can approach 1 even for sparse assemblies. Compare it only within this app, **not** with literature packing densities.                    |
| **η_B** | V★ / V_bbox | Bounding-box packing fraction. The bounding box is a container with a fixed orientation, so this value **is** comparable to literature values such as sphere random close packing (RCP) ≈ 0.636 and FCC ≈ 0.74. |

V★ = N · L³/6 is the exact sum of the part volumes, because face-to-face mating never overlaps. V_hull is the volume of the convex hull, the smallest convex shape that holds all the vertices. V_bbox is the volume of the axis-aligned bounding box.

## Two growth strategies

- **Uniform:** each free face has equal probability.
- **Compact:** the Boltzmann weight `p(face) ∝ exp(β · n̂ · ĉ)` biases the choice toward concave pockets (n̂ = outward face normal, ĉ = direction to the assembly centroid). A slider sets β. β = 0 gives the uniform strategy, the default is β = 3, and β → ∞ is greedy. A larger β gives more weight to the faces that point toward the centroid. This weight applies only to Phase 1 (see below).

The chirality bias slider `c_R ∈ [0, 1]` sets the probability that each attempt draws a right-handed template. The R:L ratio of the assembly also depends on which handedness fits the geometry, not only on the bias.

Both strategies place each Planckton in two phases:

1. **Phase 1:** random sampling, ≤ 80 attempts.
2. **Phase 2:** a deterministic exhaustive search over every (free face × chirality × template face × perm) combination. A perm is one order in which the vertices of two faces match. Phase 2 runs before the growth declares the assembly "jammed" (no valid placement on any free face). If any valid placement exists, Phase 2 finds it.

## Disclosure modes

A three-position switch in the top bar (**Learn / Explore / Research**) sets how much of the UI you see:

- **Learn** (default): the scene picker, the essential growth parameters (N, seed, strategy), and a basic metrics tile (N, η_C, η_B, free surface). Dotted-underlined terms in the text open a glossary popover. The `?` button opens a full help overlay with three tabs: a primer for the current scene, concepts, and a glossary.
- **Explore:** adds the Display panel (colors, hull, gyration ellipsoid, edge outlines, render gap). It also adds the advanced metrics sections (gyration / shape, bond-orientational order, topology / chirality, bounding box).
- **Research:** adds histograms, η-vs-N sweeps, pair correlation, kinetics, autocorrelation, Monte Carlo (MC) refinement, and the morphological and Voronoi η variants. The plots also show reference packing densities as an overlay.

Press the `?` key to cycle through the modes. The share link stores the mode as `m: learn|explore|research`. Older links with `a: true/false` still decode (`true → research`, `false → learn`).

## Research mode features

- **Trial histogram** at fixed N: the distribution of η_C, with an A/B overlay, the mean ± SEM, and CSV export with build provenance. SEM is the uncertainty in the sample mean.
- **η vs N curve:** the error band shows SEM by default. A toggle changes it to ±σ, the spread of the trials. You choose **η_C** or **η_B** for the y axis. The panel fits three candidate models at the same time:
  - `1 − η ∝ N^α` (pure power law), which reports `α ± Δα`
  - `1 − η = y∞ + B·N^(−β)` (asymptote + power correction)
  - `1 − η = y∞ + B·exp(−N/N₀)` (exponential approach)

  The panel selects a model by AIC (Akaike information criterion). A ΔAIC above 2 is meaningful.

- **Fractal dimension D_f:** a fit of R_g ∼ N^(1/D_f), which shows how the size of the assembly grows with N. D_f → 3 for compact 3D growth. Lower values show fractal or surface-dominated aggregation.
- **Pair correlation g(r):** the local density at distance r, divided by the bulk density, as an average over an ensemble of seeds. A random uniform arrangement gives 1. Crystalline order gives sharp peaks. An amorphous arrangement gives broad peaks that decay to 1.
- **Reference packing densities:** a table with full citations (Hales / Kepler conjecture, Chen-Engel-Glotzer, Hoylman, Scott-Kilgour, Onoda-Liniger).

## Detailed HUD (growth scene)

| Section              | Quantities                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Bulk                 | N (with stalled marker), V★, V_hull, **η_C**, **η_B**, free surface                                               |
| Gyration / shape     | R_g, asphericity b, acylindricity c, anisotropy κ², prolateness S                                                 |
| Topology / chirality | R / L counts, free-face fraction, ⟨z⟩ tet-tet coordination, ⟨coord⟩ / max vertex coordination, free iso / scalene |
| Bounding box         | V_bbox, dims                                                                                                      |

Turn on the **gyration ellipsoid** overlay to see the principal axes of the gyration tensor. The gyration tensor is a 3 × 3 matrix whose eigenvalues describe the shape of the assembly. Note: this ellipsoid is **not** the inertia ellipsoid. The inertia tensor `I_ij = ⟨r²⟩δ_ij − ⟨rᵢrⱼ⟩` has different (orthogonal) principal directions.

## CLI: `scripts/study.ts`

Use the CLI for real ensemble averages, fit-grade statistics, and offline pipelines:

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

In these columns, `efficiency` is η_C, `bboxEfficiency` is η_B, and `meanTetCoord` is ⟨z⟩.

Each CSV starts with a provenance block (a record of the code and the settings) in `#` comments:

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

With this block, a re-run months later can identify the exact code that produced the data. JSON exports (`exportAssemblyJSON`) carry the same provenance object.

The CLI uses the same kernel as the browser, so the results are bit-identical. Each trial `t` uses the seed `seed_t = startSeed + t·9973`, so each run is fully reproducible.

## Export and share

- **Share link:** encodes scene/seed/N/strategy/β/chirality in the URL hash.
- **PNG:** a screenshot of the canvas.
- **STL:** a watertight STL of the current assembly.
- **JSON:** a full state dump with provenance.

## Scope

By design, this project does not:

- **Simulate general tetrahedral shapes.** It models only the Hill T₁ orthoscheme and its chiral mirror. It supports no other tetrahedra, polyhedra, or particle types.
- **Produce tetrahedral meshes for FEA (finite element analysis) or CAD.** The geometry kernel drives the interactive study. It is not a mesh-generation library for engineering workflows.
- **Model physical forces or dynamics in the growth study.** The growth kernel is combinatorial (adjacency + SAT overlap rejection). It has no energy minimization or fluid simulation. The separate **vacuum-bag scene** _is_ a frictionless rigid-body settle. But it is a browser-only visualization, not part of the CSV/CLI study pipeline.
- **Optimize packing density.** The tool studies random face-to-face assemblies. It does not search for maximum-density configurations or compete with dedicated sphere or polyhedron packing solvers.
- **Run large-scale statistical campaigns in the browser.** Web Worker throughput limits the browser UI. Use the headless CLI (`scripts/study.ts`) for fit-grade ensemble runs.

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

The husky pre-commit hook runs `lint-staged` (prettier and `eslint --fix` on the staged files), then `tsc -b`. The `commit-msg` hook runs `commitlint`.

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

- **Curve sweeps split the work by N only.** The browser pool gives each worker a share of the Ns. When the list of Ns is shorter than the pool, some cores stay idle. A two-level split (Ns × trials) would help sweeps with few Ns and many trials, but it adds complexity to the CurvePoint merge. The CLI avoids this problem: it spreads the trials of one N across `node:worker_threads` (see `scripts/study.ts --workers`).

## References

[THEORY.md](./THEORY.md) gives a reference list at the end of §1.1, §2, §3, §4, and §5. These are the main entries:

| Topic                       | Reference                                                                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hill T₁ orthoscheme         | M. J. M. Hill, _Determination of the volumes of certain species of tetrahedra without employment of the method of limits_, Proc. Lond. Math. Soc. 2:39 (1896).                                                    |
| m³-reptile theorem          | J. Matoušek & Z. Safernová, _On the nonexistence of k-reptile tetrahedra_, [arXiv:1006.1807](https://arxiv.org/abs/1006.1807) (2010).                                                                             |
| Regular-tetrahedron packing | E. R. Chen, M. Engel & S. C. Glotzer, _Dense crystalline dimer packings of regular tetrahedra_, Discrete Comput. Geom. 44:253 (2010), [doi:10.1007/s00454-010-9273-0](https://doi.org/10.1007/s00454-010-9273-0). |
| Gyration descriptors        | D. N. Theodorou & U. W. Suter, _Shape of unperturbed linear polymers: polypropylene_, Macromolecules 18:1206 (1985).                                                                                              |
| κ² normalization            | J. Rudnick & G. Gaspari, _The asphericity of random walks_, J. Phys. A 19:L191 (1986).                                                                                                                            |

## License

MIT. See [LICENSE](./LICENSE).
