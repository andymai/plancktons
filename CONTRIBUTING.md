# Contributing

Thanks for the interest. This is a small research/demo project; PRs welcome.

## Development setup

```bash
npm install              # installs deps + sets up husky hooks
npm run dev              # http://localhost:5173
```

## Quality gate

All of these are run by the `validate` script and by CI on every push / PR:

```bash
npm run typecheck        # tsc -b
npm run lint             # eslint
npm run format:check     # prettier --check
npm run test             # vitest run (168 tests, ~700 ms)
npm run test:coverage    # also enforces ≥ 85/80/90/85 % stmt/branch/func/line
npm run build            # tsc + vite build
npm run validate         # all of the above in order
```

Pre-commit hook runs `lint-staged` (prettier + eslint --fix on staged files)
plus `tsc -b` before the commit lands.

Commit messages must follow Conventional Commits (`type(scope): subject`);
the `commit-msg` hook runs `commitlint` against them.

## Lockfile gotcha (npm < 11.11)

On older npm, `npm install` may drop top-level `@emnapi/core` and
`@emnapi/runtime` entries from `package-lock.json`. CI used to fail
`npm ci` with `Missing: @emnapi/...`; we now run `npm install --no-audit
--no-fund` in CI so the lockfile is self-healing.

For local development, if you want a strict `npm ci`-clean lockfile,
manually re-add the two `node_modules/@emnapi/core` and
`node_modules/@emnapi/runtime` entries (version `1.10.0`, mirroring the
adjacent `node_modules/@emnapi/wasi-threads` block) before committing.
Or upgrade to npm ≥ 11.11 and the issue goes away.

## Layout

```
src/
  lib/           Pure math (no React, no THREE) - fully unit-tested
  scenes/        R3F components - coverage via integration only
  ui/            React UI - coverage via integration only
tests/           Vitest tests for src/lib/*
scripts/         Standalone tsx-runnable CLIs (study.ts batch runner,
                 brepjsOverlap.ts overlap oracle)
docs/            PROOF.md - SAT overlap test correctness
```

## Algorithm version

`src/lib/provenance.ts` exposes a single `ALGORITHM_VERSION` string. **Bump
it** whenever you change anything that affects the simulation output: the
SAT margin, free-face ordering, growth strategy logic, RNG arithmetic, etc.
Every CSV / JSON export stamps this version (plus a git short-hash) so
downstream consumers can detect when archived data and live code diverge.

See [THEORY.md](./THEORY.md) for the mathematical background.
