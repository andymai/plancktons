# Plancktons

Interactive 3D study of **Hill tetrahedra** ("Plancktons") — the only known
family of space-filling tetrahedra in 3D, made famous by Matoušek &
Safernová's proof that the only k-reptile tetrahedra are the
m³-reptile Hill simplices.

**Live: <https://andymai.github.io/plancktons/>**

## What is a Planckton?

A Planckton is a Hill tetrahedron — the convex hull of `0`, `b₁`, `b₁+b₂`,
`b₁+b₂+b₃` for three equal-length vectors at equal pairwise angles in
`(0, 2π/3)`. The simplest standard form is the orthonormal version:

```
V₀ = (0, 0, 0)
V₁ = (L, 0, 0)
V₂ = (L, L, 0)
V₃ = (L, L, L)
```

It has exactly two triangle-face shapes:
- 2 isoceles right triangles with edges `(1, 1, √2)`
- 2 scalene right triangles with edges `(1, √2, √3)`

Its volume is exactly `L³ / 6`. Plancktons come in two chiral forms (mirror
images), shown in red (right-handed) and white (left-handed) by convention.

## The four scenes

1. **Single Planckton** — toggle chirality, see the chiral pair side by side.
2. **6-piece cube tiling** — six Plancktons (3 R + 3 L, one per permutation of
   `(x, y, z)`) tile a cube exactly.
3. **8-reptile dissection** — eight unit Plancktons tile a doubled Planckton;
   recurse to 64 sub-Plancktons. Exactly the `m³` family Matoušek proved.
4. **Random face-to-face growth** — the research scene. Grow an assembly by
   gluing random Plancktons face-to-face. Live readout of:
   - `V*` = `N · L³ / 6` (sum of part volumes — the ideal)
   - `V` = convex hull volume (vacuum-bag shrink-wrap upper bound)
   - efficiency `V*/V` (1.0 = perfect tiling, <1 = voids)

## Research mode

Toggle **Advanced** to unlock:
- **Trial histogram**: run 100–500 random trials at fixed `N`, see the
  distribution of efficiencies.
- **V*/V vs N curve**: sweep `N` and plot the mean ± std band.
- **CSV export** for offline analysis.

Two growth strategies are available:
- **Uniform random** — picks any free face with equal probability. Asymptotes
  to efficiency ≈ 0.25 (`V ≈ 4 V*`) for large `N`.
- **Compact (fill pockets)** — biases toward concave free faces. Asymptotes to
  efficiency ≈ 0.34 — a ~35 % packing improvement over uniform.

## Export and share

- **🔗 Share link** — encodes scene/seed/N/strategy/params in the URL hash.
  Click to copy; share with anyone (e.g. send to your father-in-law).
- **📸 PNG** — high-res screenshot of the canvas.
- **🧊 STL** — download the assembly as a watertight STL for 3D printing.
- **💾 JSON** — full assembly state (vertices, chirality) for archival.

## Local dev

```bash
npm install
npm run dev      # open http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production bundle locally
```

Run the math sanity tests:
```bash
npx tsx src/lib/__sanity__.ts
```

## Project layout

```
src/
  lib/                Pure math (no React, no THREE)
    vec.ts            Vec3 helpers
    rng.ts            Seeded LCG RNG
    planckton.ts      Hill tet vertices, face mating, overlap test
    assembly.ts       Free-face tracking, growth strategies
    hull.ts           quickhull3d wrapper + volume + bbox
    canonicalScenes.ts  6-cube + 8-reptile constructions
    mesh.ts           Planckton → THREE.BufferGeometry
    exports.ts        STL / JSON / PNG / URL-share
    study.ts          Multi-trial batch runner
    store.ts          Zustand UI state
    __sanity__.ts     Math regression tests (run with tsx)
  scenes/             R3F scene components
    SceneCanvas.tsx
    SingleScene.tsx
    CubeScene.tsx
    ReptileScene.tsx
    GrowthScene.tsx
    PlancktonMesh.tsx
    HullMesh.tsx
  ui/                 React UI panels
    Controls.tsx
    HUD.tsx
    Actions.tsx
    Research.tsx
```

## References

- J. Matoušek & Z. Safernová, *On the nonexistence of k-reptile tetrahedra*
  (2010), [arXiv:1006.1807](https://arxiv.org/abs/1006.1807) — proves the
  k=m³ result.
- J. H. Conway & S. Torquato, *Packing, tiling, and covering with tetrahedra*,
  PNAS 103(28), 2006 — context on regular-tet packing.
- M. J. M. Hill, *Determination of the volumes of certain species of
  tetrahedra without employment of the method of limits*, Proc. Lond. Math.
  Soc., 1896 — the original construction.

## License

MIT — see [LICENSE](./LICENSE).
