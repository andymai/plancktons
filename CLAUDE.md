# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Browser + headless TypeScript study of **Hill T₁ orthoscheme** ("Planckton") tetrahedra: face-to-face random aggregation, packing-fraction metrics (η_C, η_B, η_M), gyration descriptors, fractal dimension, pair correlation, Avrami kinetics, m³-reptile dissection. R3F front-end, pure-TS simulation kernel, Vite/Vitest. See `README.md` for end-user docs and `THEORY.md` for the math.

## Common commands

```bash
npm run dev              # vite dev server on :5173
npm run build            # tsc -b && vite build (production bundle in dist/)
npm run preview          # serve dist/ locally

npm run validate         # typecheck + lint + format:check + test  (canonical gate)
npm run typecheck        # tsc -b
npm run lint             # eslint .
npm run format:check     # prettier --check .
npm run format           # prettier --write .
npm run test             # vitest run (single pass)
npm run test:watch       # vitest watch mode
npm run test:coverage    # also enforces 85/80/90/85 stmt/branch/func/line on src/lib/**

# Run a single test file:
npx vitest run tests/assembly.test.ts
# Run by name pattern:
npx vitest run -t "growOne respects chirality bias"

# Headless batch CLI (same kernel as browser, bit-identical):
npm run study -- --N 50 --trials 500 --strategy compact --beta 4 --out compact_b4.csv
npm run study -- --sweep-N 10,20,30,50,80,120 --trials 200 --strategy uniform --out sweep.csv
npm run study -- --N 30 --trials 1000 --format jsonl --out trials.jsonl
```

Pre-commit hook runs `lint-staged` (prettier + eslint --fix on staged files) then `tsc -b`. Commit messages must follow Conventional Commits — `commit-msg` hook runs commitlint.

## Architecture — what requires reading multiple files to understand

### Three-tier layering (load-bearing)

```
src/lib/      pure math — no React, no THREE imports allowed
src/scenes/   R3F components — read lib, never imported by lib
src/ui/       React UI — reads lib + scenes, never imported by lib
src/worker/   Web Worker entry — uses lib only
```

`vitest.config.ts` only collects coverage from `src/lib/**/*.ts` (with hand-picked exclusions for DOM-bound modules: `store.ts`, `exports.ts`, `mesh.ts`, `references.ts`). Scenes and UI are covered via integration, not units. **Keep `src/lib/*` pure** — adding a React or THREE import there will violate the layering invariant the test setup encodes.

### Two stores: shared (`src/lib/store.ts`) vs UI-only (`src/ui/uiStore.ts`)

`src/lib/store.ts` is the documented exception to the "no React in lib" rule (it imports `zustand` and is coverage-excluded). It holds **share-linkable** state: `scene`, `growth`, `mode` (Learn → Explore → Research), color settings, animation mode, the `*Trigger` counters GrowthScene watches. Anything encoded into the URL hash via `exports.ts` lives here.

`src/ui/uiStore.ts` holds **ephemeral** UI state that should _not_ round-trip through share links: `helpOpen`, `metricsHidden`, `firstVisitDismissed`. Put new UI-only state here, not in `lib/store`. The boundary keeps share links stable as the UI evolves.

`isAtLeast(mode, level)` is the single gate every component uses to decide what to render (`mode !== 'learn'` for Display + advanced HUD, `mode === 'research'` for Research panels + Analyses). Don't read `mode` directly with `===` in components — use the helper so the ladder stays in one place.

### The simulation kernel is shared by browser, worker, and CLI

`scripts/study.ts` (CLI), `src/worker/study.worker.ts` (off-main-thread), and `src/scenes/GrowthScene.tsx` (interactive) all call into `src/lib/study.ts` / `src/lib/assembly.ts`. Results are bit-identical across the three because the RNG (`src/lib/rng.ts`) is a deterministic LCG seeded with `seed_t = startSeed + t·9973`. If you change anything in the lib that touches simulation output, all three call sites are affected simultaneously — that's intentional.

### Worker pool fan-out

`src/lib/workerPool.ts` splits `study` and `curve` jobs across up to `navigator.hardwareConcurrency − 1` short-lived Web Workers (`runStudyPooled`, `runCurvePooled`). Determinism is preserved by adjusting each slice's `startSeed`: slice `{start, count}` runs with `startSeed' = startSeed + start·9973`, so a worker's local trial `t'` carries the same seed the single-worker run would have used for global trial `start + t'`. After the slices return, `mergeTrialSlices` remaps local trial indices to global ones — output is bit-identical (mod `ms` timing) to single-worker.

The fan-out functions accept an injectable `runner` parameter; default = `runOnWorker` from `studyClient.ts`. Tests use a synchronous in-process runner so the pool's orchestration logic gets coverage without spinning up real Workers (happy-dom has no Worker support).

`useWorkerRun` (in `src/ui/`) dispatches `study`/`curve` jobs through the pool and all other kinds through the single-worker `runOnWorker`. Call sites in `Research.tsx` are unchanged.

The curve pool depends on a contract in `study.worker.ts`: the curve handler must emit a cumulative `(doneTrials, Ns·trialsPerN)` progress bar, not per-N events. If you change that emission, also update the pool's progress aggregation.

### `ALGORITHM_VERSION` is load-bearing

`src/lib/provenance.ts` exports `ALGORITHM_VERSION` (currently `'2'`). It is stamped into every CSV/JSON export's `#`-commented provenance block alongside the git short-hash. **Bump it whenever you change anything that affects simulation output**: SAT margin/tolerance, free-face ordering, growth strategy logic, RNG arithmetic, mating/perm enumeration, etc. Downstream consumers rely on this to detect when archived data and live code diverge. Not bumping it on a behavior change is a silent correctness bug.

### Share-link hash format

`src/lib/exports.ts` encodes the snapshot as base64-of-JSON in `location.hash`. Validated unions: `s` (scene) and `m` (mode) are checked against `SHARE_SCENES` / `SHARE_MODES` before any cast; unknown values are dropped, not silently accepted. Decoder precedence for the disclosure mode: `m` wins if valid, otherwise legacy `a:true → research` / `a:false → learn`, otherwise leave the store default. When adding a new share-linkable field, extend `SnapshotState`, the encoder payload, **and** the decoder's validation — and add a round-trip test in `tests/exports.test.ts`.

### Overlap correctness — SAT, not heuristics

`src/lib/planckton.ts:tetsOverlap` is the separating-axis test that gates every placement. Its correctness proof (separating axes enumerated, numerical margin justified) is in `docs/PROOF.md`. The face-to-face mating in `matePlanckton` is exact (rational rotations on aligned faces), so the SAT test is the safety net for floating-point drift — not the primary placement logic. If you touch tolerances or axes, update `docs/PROOF.md` and bump `ALGORITHM_VERSION`.

### Two-phase placement

`assembly.ts:growOne` runs Phase 1 (random sampling, ≤ `maxAttemptsPerStep` ≈ 80) then Phase 2 (deterministic exhaustive search over every free-face × chirality × template-face × perm) before declaring "jammed". If any valid placement exists, Phase 2 finds it — so "jammed" is a strong statement, not a sampling artifact.

### Spatial hash speeds the SAT path

`src/lib/spatialHash.ts` indexes tet centroids on a `2L`-side grid. Hill T₁'s bounding-sphere radius is √3·L/2 ≈ 0.87L, so any centroid pair >2L apart cannot overlap — the hash returns the neighbor candidates SAT actually needs to check. The 3×3×3 stencil is hard-coded; if you change `L` semantics or the cell side, recompute the radius bound.

### Two η values mean two different things

`η_C = V★ / V_hull` (convex compactness) is **not** comparable to literature packing densities — the hull shrink-wraps the aggregate, so it can approach 1 for sparse clusters. `η_B = V★ / V_bbox` (bbox fraction) **is** comparable to RCP/FCC literature. CSV columns `efficiency` = η_C, `bboxEfficiency` = η_B. There's also `η_M` (morphological hull via `morphology.ts`) and `η_V` (Voronoi via `voronoi.ts`) for advanced research views. Don't conflate them in plots, fits, or commit messages.

### Scenes are ref-cached, not re-rendered

`GrowthScene.tsx` keeps the `Assembly` in a `useRef` and mutates it via `growOne` per step — React state holds only N and metrics, not the geometry. This is why scaling sliders feel snappy at N=200; it's also why naïvely lifting growth state into the Zustand store would tank perf. The pattern: lib is immutable-input / functional, scenes wrap mutable refs around it.

### ESM with `.js` import specifiers

TypeScript files import sibling modules with `.js` extensions (`import { foo } from './bar.js'`) — this is correct NodeNext ESM, not a bug. Both `tsc -b` and the Vite dev server resolve `.js` → `.ts` source. Don't "fix" these to `.ts`; both build paths will break.

## Coding conventions

- **Conventional Commits required** — `type(scope): subject` (e.g. `feat(growth): …`, `fix(sat): …`). `commitlint` enforces this; header max 100 chars.
- **No comments by default.** Add one only when the WHY is non-obvious (hidden constraint, subtle invariant, workaround for a specific bug). Never write change-narration, PR refs, or signature restatements. TODOs must have a concrete trigger condition.
- **Prettier + ESLint are the format authority.** `format:check` is part of `validate`; just run `npm run format` if it fails.
- **Coverage thresholds (85/80/90/85)** apply to `src/lib/**`. Adding a new lib module without tests will fail CI even if existing modules are over-covered.

## Lockfile gotcha

On npm < 11.11, `npm install` can drop `@emnapi/core` and `@emnapi/runtime` entries from `package-lock.json`. CI uses `npm install --no-audit --no-fund` (not `npm ci`) to tolerate this. For a strict `npm ci`-clean lockfile, upgrade to npm ≥ 11.11 or manually re-add the two `@emnapi` entries at version `1.10.0` before committing. See `CONTRIBUTING.md` for details.

## GitHub Pages base path

`vite.config.ts` switches `base` between `/` (local) and `/plancktons/` (Pages) via the `GITHUB_PAGES` env var. The deploy workflow sets it; local `npm run build` does not. The PWA `start_url` / `scope` follow the same switch.

## Where to look

- `README.md` — user-facing scenes, HUD, CLI flags, two-η explanation.
- `CONTRIBUTING.md` — quality gate, algorithm-version policy, lockfile workaround.
- `THEORY.md` — orthoscheme math, Dehn invariant, reptile theorem, gyration tensor.
- `docs/PROOF.md` — SAT overlap-test correctness + numerical margin analysis.
