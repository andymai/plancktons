# Plancktons - Theory and Background

Companion to [README.md](./README.md). This document is for readers who want
the math behind the interactive tool and the reasoning that motivates each
observable.

> **Notation.** Throughout, `L` is the unit edge length. The Hill orthoscheme
> T₁ (called "Planckton" in the UI) at canonical position has vertices
> `V₀ = (0,0,0)`, `V₁ = (L,0,0)`, `V₂ = (L,L,0)`, `V₃ = (L,L,L)`. We use
> `Vol` for tet/assembly volume, `A` for area, `r` for radius, and `Δ` for
> packing density. Two distinct "η" values appear throughout:
> `η_C = V★ / V_hull` (compactness, hull) and `η_B = V★ / V_bbox` (literature-
> comparable bbox packing fraction). See §4.2.

---

## 1. The Hill tetrahedron as a Schläfli orthoscheme

A _Schläfli orthoscheme_ in `ℝᵈ` is a simplex with a chain of `d` mutually
perpendicular edges. In 3D, the Hill tetrahedron is the orthoscheme

```
       V₀ -e₁→ V₁ -e₂→ V₂ -e₃→ V₃ ,         e₁ ⟂ e₂,   e₂ ⟂ e₃,   |eᵢ| = L
```

so its edges fall naturally into three groups:

| Edge                   | Length | Count | Why                                    |
| ---------------------- | ------ | ----- | -------------------------------------- |
| `V₀V₁`, `V₁V₂`, `V₂V₃` | `L`    | 3     | the three perpendicular `eᵢ`           |
| `V₀V₂`, `V₁V₃`         | `L√2`  | 2     | hypotenuses of right `(1,1)` triangles |
| `V₀V₃`                 | `L√3`  | 1     | space diagonal `√(1²+1²+1²)`           |

`Vol(Hill T) = L³ / 6`. (Cayley–Menger, or `|det[e₁,e₂,e₃]|/6 = 1/6`.)

**The two face types.** Of its 4 faces:

- Two are _isoceles right triangles_ with sides `(L, L, L√2)`,
- Two are _scalene right triangles_ with sides `(L, L√2, L√3)`.

Both contain a right angle and only those edge lengths appear, so face-to-face
matching of two Plancktons reduces to a small discrete enumeration.

**Dihedral angles.** All 6 dihedral angles of the Hill orthoscheme are rational
multiples of `π`:

$$
\begin{aligned}
α(V_0 V_1) &= π/2  &  α(V_1 V_2) &= π/3 \\
α(V_2 V_3) &= π/2  &  α(V_0 V_2) &= π/4 \\
α(V_1 V_3) &= π/4  &  α(V_0 V_3) &= π/3
\end{aligned}
$$

(Verify: `cos α(V₀V₂) = √2/2 → α = π/4`; the others follow from the orthoscheme
structure.) Their integer combinations satisfy `2·(π/2) + 2·(π/3) + 2·(π/4) +
… = π` modulo redistributions — this is Bricard's condition for
rectifiability.

### 1.1 Hill T₁ among tetrahedral space-fillers

Hill (1896) gave the first explicit family of space-filling tetrahedra.
Sommerville (1923) initiated the classification of tetrahedra that tile ℝ³ by
congruent copies; his list was later completed and extended by Goldberg
(1974), who exhibited three infinite families of tetrahedral space-fillers.
The Hill orthoschemes T₁, T₂, T₃ (distinguished by which axis the three
perpendicular edges chain along) are part of this larger family; the
playground uses T₁ exclusively. Senechal (1981) is the standard modern survey
of which tetrahedra tile space, with a Dehn-invariant perspective. The
k-reptile result of Matoušek-Safernová 2010 (§3) is the most recent rigidity
statement about Hill orthoschemes specifically.

**References:**

- D.M.Y. Sommerville, _Space-filling tetrahedra in Euclidean space_, _Proc. Edinburgh Math. Soc._ 41:49 (1922), [doi:10.1017/S001309150007783X](https://doi.org/10.1017/S001309150007783X).
- M. Goldberg, _Three infinite families of tetrahedral space-fillers_, _J. Combin. Theory_ A 16:348 (1974), [doi:10.1016/0097-3165(74)90058-2](<https://doi.org/10.1016/0097-3165(74)90058-2>).
- M. Senechal, _Which tetrahedra fill space?_, _Math. Mag._ 54:227 (1981), [doi:10.1080/0025570X.1981.11976933](https://doi.org/10.1080/0025570X.1981.11976933).

---

## 2. Scissors-congruence and Hilbert's Third Problem

In 1900, Hilbert asked: are any two polyhedra of equal volume scissors-congruent
(decomposable into matching congruent pieces)? Dehn answered **no** the same
year. The obstruction is the **Dehn invariant**

$$
D(P) = \sum_{\text{edges}} ℓ_i \otimes (α_i \bmod π·ℚ) \;\in\; ℝ \otimes_ℚ (ℝ / π·ℚ).
$$

A polytope is scissors-congruent to a cube **iff** `D(P) = 0` (Sydler 1965). For
a Hill tetrahedron, every dihedral angle is a rational multiple of `π`, so
every `α_i mod π·ℚ = 0`, so `D = 0`. Hence:

> **The Hill T is scissors-congruent to a cube of the same volume.**

This is why 6 Plancktons exactly tile a cube (see scene 2) and why 8 unit
Plancktons exactly tile a doubled Planckton (scene 3, the m³-reptile family).
For _regular_ tetrahedra `α = arccos(1/3)` which is irrational over `π·ℚ`,
giving a nonzero Dehn invariant - so regular tets cannot tile space.

**References:**

- M.J.M. Hill, _Proc. Lond. Math. Soc._ 2:39 (1896).
- M. Dehn, _Math. Ann._ 55:465 (1901).
- J.-P. Sydler, _Conditions nécessaires et suffisantes pour l'équivalence des polyèdres de l'espace euclidien à trois dimensions_, _Comment. Math. Helv._ 40:43 (1965), [doi:10.1007/BF02564364](https://doi.org/10.1007/BF02564364).
- R. Bricard, _Sur une question de géométrie relative aux polyèdres_, _Nouv. Ann. Math._ (3) 15:331 (1896), [numdam.org/item/NAM_1896_3_15\_\_331_1](https://www.numdam.org/item/NAM_1896_3_15__331_1/).
- I. Pak, _Lectures on Discrete and Polyhedral Geometry_ (2009), §16.

---

## 3. The k-reptile family

A `d`-dimensional simplex `S` is a **k-reptile** if it can be subdivided into
`k` congruent simplices similar to `S`. The Hill simplex is an `mᵈ`-reptile for
every `m ≥ 2` (so 8, 27, 64, … in 3D), via the standard midpoint subdivision
followed by an octahedron-diagonal split.

In 2010 Matoušek and Safernová closed the converse direction in 3D:

> **Theorem (Matoušek–Safernová 2010).** _A tetrahedron is a k-reptile only if
> `k = m³` for some `m ∈ ℕ`._

So the m³-reptile family generated by the Hill orthoscheme is the _only_ family
of reptile tetrahedra known, and provably the only one for the small cases
(`k ≤ 7`). The 8-reptile dissection is the simplest case (`m = 2`) and is
visualized in scene 3 of the playground.

**Reference:** J. Matoušek, Z. Safernová, _On the nonexistence of k-reptile
tetrahedra_, [arXiv:1006.1807](https://arxiv.org/abs/1006.1807) (2010).

---

## 4. Random face-to-face growth: face-restricted cluster aggregation

The "growth" scene constructs an assembly by **face-restricted cluster
aggregation** (a variant of Eden growth where the substrate is the dual
face-graph of an evolving polyhedral aggregate):

```
   1. Place one seed Planckton at the origin.
   2. while N < target:
        # Phase 1 - random sampling, up to maxAttempts (default 80):
        pick a free face F of the assembly             (strategy)
        pick a template Planckton chirality            (chirality bias)
        find a face F' of the template congruent to F
        rigid-mate the template onto F
        if no SAT overlap with existing tets: accept and continue
        # Phase 2 - deterministic exhaustive search:
        for (free face × chirality × template face × perm):
          if accepted: continue
        # If no placement exists at all → JAMMED.
```

This is **not** standard RSA (random sequential adsorption: place objects at
random _positions_ in a continuous medium, accept if non-overlapping; see
Evans 1993 for a review). It is also **not** DLA (diffusion-limited
aggregation: particles arrive along Brownian trajectories and stick on
contact; Witten & Sander 1981). The closest published analogue is the
**Eden growth model** (Eden 1961), adapted from a flat lattice to a
face-mating polyhedral substrate. Reaction-limited cluster aggregation (RLCA;
Meakin 1983) shares the "place adjacent to existing structure" flavour but
with different rejection statistics. The two-phase structure here ensures
that "jammed" is a true statement about the geometry, not an artifact of
finite random sampling — Phase 2 finds any placement that exists.

**References for §4 framing:**

- M. Eden, _A two-dimensional growth process_, in _Proc. 4th Berkeley Symp. Math. Statistics and Probability_, Vol. IV, 223–239 (1961).
- T.A. Witten & L.M. Sander, _Diffusion-limited aggregation, a kinetic critical phenomenon_, _Phys. Rev. Lett._ 47, 1400 (1981), [doi:10.1103/PhysRevLett.47.1400](https://doi.org/10.1103/PhysRevLett.47.1400).
- P. Meakin, _Formation of fractal clusters and networks by irreversible diffusion-limited aggregation_, _Phys. Rev. Lett._ 51, 1119 (1983), [doi:10.1103/PhysRevLett.51.1119](https://doi.org/10.1103/PhysRevLett.51.1119).
- J.W. Evans, _Random and cooperative sequential adsorption_, _Rev. Mod. Phys._ 65, 1281 (1993), [doi:10.1103/RevModPhys.65.1281](https://doi.org/10.1103/RevModPhys.65.1281).

The **jamming limit** is reached when every free face has _no_ allowed
(chirality, template, perm) triple that produces a non-overlapping placement
(verified by Phase 2 exhaustive search).

### 4.1 Strategy and inverse temperature

For the **compact** strategy, free faces are selected with probability

$$
p(\text{face}_i) \propto \exp(β \cdot \hat n_i \cdot \hat c_i),
$$

where `n̂_i` is the outward normal of free face `i` and `ĉ_i` is the unit
vector from the face center to the current assembly centroid. `β` is an
inverse temperature: `β = 0` recovers uniform sampling; `β → ∞` is greedy
("always fill the deepest pocket"). The `β` slider in advanced mode lets you
sweep this directly.

### 4.2 Order parameters and observables

For an assembly of `N` Plancktons with vertex set `{r_α}`:

- **Sum of part volumes** `V★ = N · L³ / 6` (tight: equals the actual
  occupied solid volume because face-to-face never overlaps).
- **Convex-hull volume** `V_hull = Vol(conv {r_α})`.
- **Bbox volume** `V_bbox = Δx · Δy · Δz` of the axis-aligned bounding box.

Two distinct η values, both in `(0, 1]`:

- **`η_C = V★ / V_hull` (compactness).** The convex hull shrink-wraps the
  aggregate, so this can approach 1 even for sparse clusters. It measures
  _how convex_ the cluster is, not how dense it is in a fixed container.
  **Do not** compare `η_C` to literature packing densities (sphere RCP, FCC,
  etc.) - they're different quantities.
- **`η_B = V★ / V_bbox` (bbox packing fraction).** The bbox is a fixed-
  orientation container, so this **is** directly comparable to literature
  packing densities. `η_B < η_C` always (a hull fits inside its bbox).

Other observables:

- **Free surface area** `S = Σ_{free faces} A_face`. Grows ~ `N^{2/3}` for
  compact (3D bulk) piles and super-linearly for fractal piles.
- **Gyration tensor**

  $$
  Σ_{ij} = \frac{1}{N_v} \sum_α (r_α − r_{\text{cm}})_i (r_α − r_{\text{cm}})_j.
  $$

  Eigenvalues `λ₁ ≥ λ₂ ≥ λ₃` give:
  - `R_g² = tr Σ` (radius of gyration),
  - `b = λ₁ − (λ₂+λ₃)/2` (Rudnick-Gaspari asphericity, length²),
  - `c = λ₂ − λ₃` (acylindricity, length²),
  - `κ² = (b² + ¾c²) / (tr Σ)² ∈ [0,1]`: relative shape anisotropy
    (Theodorou-Suter normalization),
  - `S = (3λ₁−tr)(3λ₂−tr)(3λ₃−tr) / (tr)³ ∈ [-¼, 2]`: prolateness (sign
    distinguishes prolate `+` from oblate `−`).
  - The tool renders the **gyration ellipsoid** (semi-axes `√(5λᵢ)` along
    eigenvectors) as an overlay. NB: this is **not** the inertia ellipsoid
    of `I_ij = ⟨r²⟩δ_ij − ⟨rᵢrⱼ⟩`, which has different (orthogonal)
    principal directions.

- **Tet-tet coordination ⟨z⟩.** Mean number of face-shared neighbors per
  tet. `z = (4N − F_free) / N`. For a perfect tiling `⟨z⟩ = 4`; for any
  finite aggregate with surface `⟨z⟩ < 4`.
- **Vertex coordination histogram**: for each spatial vertex (`L·10⁻⁶`
  quantization), the number of tets meeting there. In the geometric 6-cube
  tiling (Appendix B.1) the diagonal endpoints `(0,0,0)` and `(L,L,L)` both
  have coordination 6.
- **Free-face fraction** `f_F = |free faces| / (4N) = 1 − ⟨z⟩/4`.
- **Fractal dimension `D_f`** from `R_g ∼ N^{1/D_f}`. `D_f → 3` for compact
  3D growth; `D_f < 3` for surface-dominated / fractal aggregates.
  Reported as a log-log fit of the `R_g(N)` sweep in Research mode, with
  uncertainty propagated from the slope error.
- **Pair correlation `g(r)`** between tet centroids, normalized by the
  uniform-density expectation. Crystalline order → sharp peaks; amorphous
  → broad peaks decaying to 1.

All of these are shown live in the HUD or Research panel in Explore or
Research mode.

### 4.3 Empirical findings

Compact strategy, β = 3, c_R = 0.5, 200 trials per N. Source data is
committed at `data/preliminary/q3_df_compact.csv`; reproduce with
`npm run study -- --sweep-N 10,20,40,70,100,150,200 --trials 200 --strategy
compact --beta 3 --workers auto`:

| N target | reach % | mean η_C | SEM η_C | ⟨R_g⟩ / L |
| -------- | ------- | -------- | ------- | --------- |
| 10       | 100 %   | 0.597    | 0.008   | 1.02      |
| 20       | 100 %   | 0.561    | 0.007   | 1.14      |
| 40       | 100 %   | 0.549    | 0.006   | 1.29      |
| 70       | 100 %   | 0.530    | 0.005   | 1.46      |
| 100      | 100 %   | 0.525    | 0.004   | 1.59      |
| 150      | 100 %   | 0.523    | 0.004   | 1.75      |
| 200      | 100 %   | 0.526    | 0.003   | 1.88      |

η_C falls quickly over N=10→40 and plateaus near 0.52-0.53 by N ≥ 100. The
residual 1 − η_C ≈ 0.47 "vacuum" at large N is the gap between random
one-shot aggregation and the deterministic η = 1 Hill tiling — driven by
local-pocket sticking, not by any Dehn-invariant obstruction (the Dehn
invariant of Hill T₁ vanishes; that's what makes η = 1 achievable in
principle, but only with a non-random placement order).

### 4.4 Fit models for 1 − η(N)

The Research panel fits **three** candidate models simultaneously to the
1 − η_C(N) sweep, with AIC-based model selection:

| Model                            | Form                          | k   | Interpretation                                |
| -------------------------------- | ----------------------------- | --- | --------------------------------------------- |
| **Pure power**                   | `1 − η = A · N^α`             | 2   | implies η → 0 (no asymptote)                  |
| **Asymptote + power correction** | `1 − η = y∞ + B · N^(−β)`     | 3   | physical for systems with finite bulk density |
| **Exponential approach**         | `1 − η = y∞ + B · exp(−N/N₀)` | 3   | short-range correction only                   |

AIC = `n · ln(SSE/n) + 2k` (Gaussian residuals). ΔAIC > 2 is considered
meaningful evidence. The **pure power-law** fit will _always_ return a
finite α even when the underlying truth has an asymptote - so reading α in
isolation is misleading. Always inspect which model wins AIC.

### 4.5 Preliminary results

The chirality-bias optimum, β-saturation, fractal dimension, and g(r)
first-peak location are all quantitative sweeps the tool can run today. The
parallel CLI mode (§6, `--workers`) made them tractable in seconds. The raw
data are committed under `data/preliminary/`; each CSV carries the full
provenance block (algorithm version, git short-sha, build time, parameters).

**Q1 — chirality optimum.** `η_C(c_R)` is symmetric and unimodal in `c_R`,
peaking at `c_R = 0.5` (balanced 50/50 R/L). Single-chirality assemblies
(`c_R ∈ {0, 1}`) collapse to `η_C ≈ 0.14`: face-shared Hill T₁'s require
alternating chirality at the shared face, so an all-one-chirality template
starves the placement options and the aggregate degenerates into long
chains. (`data/preliminary/q1_chir_*.csv`, N=50, compact β=3, 500 trials
each.)

| c_R  | ⟨η_C⟩ ± SEM         | ⟨η_B⟩ ± SEM         |
| ---- | ------------------- | ------------------- |
| 0    | 0.1443 ± 0.0015     | 0.0212 ± 0.0005     |
| 0.25 | 0.4873 ± 0.0035     | 0.2381 ± 0.0030     |
| 0.5  | **0.5338 ± 0.0033** | **0.2516 ± 0.0030** |
| 0.75 | 0.4863 ± 0.0035     | 0.2357 ± 0.0031     |
| 1    | 0.1442 ± 0.0015     | 0.0212 ± 0.0005     |

**Q2 — β saturation.** `η_C` is **not** monotonic in `β`. It rises from
`β = 0` (uniform) to a maximum at `β ≈ 5` (`η_C ≈ 0.609`), then falls back
as `β → ∞`. The drop is a jamming signature: extremely greedy face
selection (`p ∝ exp(β·n̂·ĉ)` strongly biased toward the deepest pocket)
over-commits to single concave sites and exhausts the local placement
options before the rest of the surface has been considered. The default
`β = 3` in the playground is conservative; `β ≈ 5` is the empirical sweet
spot. (`data/preliminary/q2_beta_*.csv`, N=50, c_R=0.5, 500 trials.)

| β   | ⟨η_C⟩ ± SEM         |
| --- | ------------------- |
| 0   | 0.3625 ± 0.0023     |
| 1   | 0.4073 ± 0.0026     |
| 2   | 0.4732 ± 0.0030     |
| 3   | 0.5338 ± 0.0033     |
| 5   | **0.6086 ± 0.0037** |
| 8   | 0.5126 ± 0.0032     |
| 12  | 0.4673 ± 0.0024     |

**Q3 — fractal / mass dimension.** Fitting `R_g ~ N^{1/D_f}` over
N ∈ {10, 20, 40, 70, 100, 150, 200} (200 trials per N, R_g over **all
vertices**, both strategies) gives

- compact β=3: **D_f = 4.87 ± 0.18** (R² = 0.993)
- uniform: **D_f = 4.43 ± 0.08** (R² = 0.999)

Both are **larger than 3**, the value expected for a uniform 3D sphere
where `R_g ∝ N^{1/3}`. The interpretation isn't "super-3D": the
vertex-cloud `R_g` is dominated at small N by the per-tet vertex spread
(`R_g ≈ 0.5 L` even for one isolated Planckton), and at large N converges
toward the bulk `N^{1/3}` scaling. The fit straddles that crossover, so the
quoted `D_f` is an effective scaling exponent, not a true Hausdorff
dimension. The qualitative finding stands: compact-strategy aggregates have
a tighter `R_g(N)` growth than uniform, consistent with `compact` producing
denser packings (cf. `η_C(β)` above and the `η_C(N)` curve in §4.3).
(`data/preliminary/q3_df_{compact,uniform}.csv`.)

**Q4 — g(r) peak positions.** The centroid-centroid g(r) at N=50, compact
β=3, 100 trials (`data/preliminary/q4_gr.csv`) has two sharp short-range
peaks: r ≈ 0.367 L (g ≈ 3.22) and r ≈ 0.633 L (g ≈ 2.23). The two peaks
correspond to the two face-shared neighbor classes — scalene-face and
isoceles-face shares respectively. The theoretical centroid-to-centroid
distance for two Hill T₁'s sharing the isoceles face is L·√(3/8) ≈
**0.612 L**; the bin at 0.633 L is within one bin width
(`rMax = 4 L, nBins = 60` → bin width ≈ 0.067 L) of that prediction.

### 4.6 Open questions

Currently unresolved:

1. **Is the random Hill-T₁ asymptote `η_∞` in the literature?** To the
   author's knowledge, the random face-to-face packing density of an
   Hill-orthoscheme aggregate (analog of sphere RCP/RLP) is not directly
   addressed in the polytope-packing literature: Conway-Torquato, Hales,
   Hoylman, Chen-Engel-Glotzer all study _crystalline_ or _lattice_ packings
   of regular tetrahedra; Scott-Kilgour, Onoda-Liniger study _random sphere_
   packing. Plancktons sit in the intersection of "Hill orthoscheme" × "random
   aggregate" that does not appear to be characterized. The §4.6 numbers
   below are the first values we are aware of.
2. **Coordination of the m³-reptile recursion.** At depth `n`, are interior
   vertex coordinations bounded, or do they grow with `n`? The geometric
   6-cube tiling has coordination 6 at the two diagonal endpoints; the
   8-reptile descends
   the recursion once; no closed-form answer is currently known.
3. **MC-refined η_∞ vs. one-shot growth.** How much of the 1 − η_C ≈ 0.47
   "vacuum" at N = 200 is true jamming versus local-minimum stickiness?
   MC refinement (§7 and `mcRefine.ts`) gives partial answers; a systematic
   sweep is open.

---

## 5. Where Plancktons sit in the packing literature

Hill T's are special because they _can_ tile space - most polytopes (including
the regular tetrahedron) cannot. For comparison:

| System                         | Δ (density)        | Source                        |
| ------------------------------ | ------------------ | ----------------------------- |
| Hill T₁ tiling (cube, reptile) | **1.000**          | Hill 1896; Matoušek 2010      |
| Sphere FCC                     | π/√18 ≈ 0.7405     | Hales 2005, Kepler conjecture |
| Regular tet (CEG dimer)        | 4000/4671 ≈ 0.8563 | Chen-Engel-Glotzer 2010       |
| Regular tet (Bravais lattice)  | 18/49 ≈ 0.367      | Hoylman 1970                  |
| Sphere random close packing    | ≈ 0.637            | Scott & Kilgour 1969          |
| Sphere random loose packing    | ≈ 0.555            | Onoda & Liniger 1990          |

**Important:** these literature values are measured against _fixed_ containers
(periodic boxes, gravity-settled beds). They are directly comparable to
**`η_B`** (bbox packing fraction) and **not** to `η_C` (hull compactness).
The Research-panel curve plots the references as horizontal lines only when
`η_B` is selected as the y-axis. The point of the playground is **not** to
"discover" `η = 1` for canonical tilings (that's a theorem) but to
characterize the _random_ and _compactified_ regimes between this app's
measured asymptote and `η = 1` - a regime that is, to the author's
knowledge, not directly addressed in the published literature even though it
is the natural Hill-T₁ analog of "random close packing" for spheres.

**References on packing densities:**

- T.C. Hales, _A proof of the Kepler conjecture_, _Ann. Math._ 162, 1065 (2005).
- E.R. Chen, M. Engel, S.C. Glotzer, _Dense crystalline dimer packings of regular tetrahedra_, _Discrete Comput. Geom._ 44, 253 (2010), [doi:10.1007/s00454-010-9273-0](https://doi.org/10.1007/s00454-010-9273-0). Supersedes the Conway-Torquato (2006) result and the Haji-Akbari et al. quasicrystal (_Nature_ 462, 773; 2009, Δ ≈ 0.8503).
- D.J. Hoylman, _Bull. Amer. Math. Soc._ 76, 135 (1970) — densest single-orientation lattice packing of regular tetrahedra.
- G.D. Scott, D.M. Kilgour, _J. Phys. D_ 2, 863 (1969) — sphere RCP.
- G.Y. Onoda, E.G. Liniger, _Phys. Rev. Lett._ 64, 2727 (1990) — sphere RLP.
- S. Torquato, F.H. Stillinger, _Rev. Mod. Phys._ 82, 2633 (2010) — survey.

---

## 6. Reproducibility

Every assembly in the tool is fully determined by:

```
  (seed, N, strategy, chirality bias c_R, compact β)
```

The "🔗 Share link" button encodes all of these into the URL hash, so an
identical assembly can be re-opened anywhere. The CLI `scripts/study.ts`
reuses the same simulation kernel, so any plot in the Research panel can be
reproduced bit-for-bit from a notebook:

```bash
npx tsx scripts/study.ts --sweep-N 10,20,30,40,50,80,120 --trials 500 \
    --strategy compact --beta 3 --out compact_b3.csv
```

The CSV columns are: `trial, N, seed, V, Vbbox, Vstar, efficiency,
bboxEfficiency, surface, rg, kappaSq, prolateness, meanCoord, maxCoord,
meanTetCoord, chirR, ms`. Here `efficiency = η_C`, `bboxEfficiency = η_B`,
`meanTetCoord = ⟨z⟩`.

Every CSV begins with a `#`-commented provenance block recording the
algorithm version, git commit short-hash (build time, injected by Vite),
build time, export time, and the full parameter set, so historical runs
remain identifiable across rebuilds. JSON exports (`exportAssemblyJSON`)
carry the same provenance object as a top-level field.

---

## 7. Conventions and caveats

- **`L = 1` throughout.** All dimensional quantities scale with the obvious
  power of `L` (volumes as `L³`, areas as `L²`, etc.).
- **Three "container" choices, three η values.** `V_hull` (convex hull) is
  an _upper_ bound on the true vacuum-bag volume. `V_α` (alpha-shape at the
  inter-tet length scale) is closer to the physical envelope but not yet
  implemented. `V_bbox` (axis-aligned bbox) is what literature packing
  densities use. Always: `V_α ≤ V_hull ≤ V_bbox`, hence
  `η_B ≤ η_C_hull ≤ η_α ≤ 1`. The tool reports `η_C` and `η_B`; α-shape is
  on the roadmap.
- **Overlap detection.** Two tets are tested via the Separating Axis Theorem
  (44 candidate axes: 4 + 4 face normals + 6 × 6 edge-edge cross products).
  Margin `L · 10⁻⁴`, ten orders of magnitude above the FP error bound. See
  `docs/PROOF.md` for the full proof. Verified by brepjs's certified
  OpenCascade intersect kernel (`scripts/brepjsOverlap.ts`): 0 overlap-pair
  volume across 1,553 pairs in 10 random assemblies.
- **Visual gap.** The default "Tet inset" of `2.5 %` shrinks rendered tets
  toward their centroids so shared faces don't z-fight on the GPU; the
  _measured_ geometry uses the original (touching) vertices. Set inset to 0
  to see the true touching configuration.
- **No Metropolis MC, no replica ensembles yet.** The current sampler is
  one-shot RSA. A simulated-annealing post-growth refinement is on the
  roadmap; it would let `η_∞` be pushed toward the true greedy upper bound.

---

## Appendix A. The 8-reptile dissection, explicitly

Let `Wᵢ` denote the vertices of the parent (size-`2L`) Hill T:
`W₀ = (0,0,0)`, `W₁ = (2L,0,0)`, `W₂ = (2L,2L,0)`, `W₃ = (2L,2L,2L)`, and let
`Mᵢⱼ = (Wᵢ + Wⱼ)/2` be the 6 edge midpoints. The 8 unit Plancktons of the
dissection are:

- **4 corner pieces** (each a translate of the unit Hill T):
  `(W₀, M₀₁, M₀₂, M₀₃)`, `(M₀₁, W₁, M₁₂, M₁₃)`,
  `(M₀₂, M₁₂, W₂, M₂₃)`, `(M₀₃, M₁₃, M₂₃, W₃)`.
- **4 octahedron pieces** sharing the diagonal `M₀₂ ↔ M₁₃` (the only
  octahedron diagonal whose length `L√2` equals a Hill T edge length). Each
  is listed below in Hill-path order — three consecutive orthogonal edges of
  length `L/2` — so the determinant trick used in `tetFromPts` recovers the
  correct geometric chirality:
  `(M₀₁, M₀₂, M₀₃, M₁₃)`, `(M₀₂, M₀₃, M₁₃, M₂₃)`,
  `(M₀₂, M₁₂, M₁₃, M₂₃)`, `(M₀₁, M₀₂, M₁₂, M₁₃)`.

Each has volume `L³/6`; their sum is `8·L³/6 = (2L)³/6` - the parent's volume.
With parent chirality `C` (the path `W₀ → W₁ → W₂ → W₃` here gives `C = R`),
the children split exactly **6C + 2(¬C)** — four corners inherit `C`, the
first two octahedron paths above have edge triples that are cyclic perms of
`(a, b, c)` and inherit `C`, the last two are transpositions and flip to
`¬C`. This 6+2 chiral balance is the load-bearing condition that
distinguishes Hill orthoschemes from generic space-filling tetrahedra.

## Appendix B. The 6-cube tilings, explicitly

A cube admits more than one dissection into 6 congruent Hill T₁ orthoschemes.
The Cube scene renders three side by side. All three have total volume
`6 · (L³/6) = L³`; they differ in chirality breakdown and in which physical
Plancktons can assemble them.

### B.1. Geometric (3R + 3L)

For each permutation `(a, b, c)` of `(0, 1, 2)`, walk one unit-step along axis
`eₐ`, then `eᵦ`, then `e_c`, starting from the origin:

```
  V₀ = 0,    V₁ = eₐ,    V₂ = eₐ + eᵦ,    V₃ = eₐ + eᵦ + e_c.
```

The 6 permutations give 3 right-handed (even permutations) and 3 left-handed
(odd permutations) Plancktons, all 6 sharing the space diagonal `(0,0,0) ↔
(L,L,L)`. This is the geometric content of Hill's 1896 paper.

### B.2. HT-realizable left (2R + 4L) and its mirror right (4R + 2L)

Cut the cube by the plane `y = z`. Each half is a triangular prism of volume
`L³/2`, tiled by 3 Hill orthoschemes:

- **Lower half** (`y < z`), in Hill-path order, chirality **1R + 2L**:
  `((0,0,0), (L,0,0), (L,0,L), (L,L,L))` — edges `(x, z, y)`, L
  `((0,0,0), (0,0,L), (L,0,L), (L,L,L))` — edges `(z, x, y)`, R
  `((0,0,0), (0,0,L), (0,L,L), (L,L,L))` — edges `(z, y, x)`, L

- **Upper half** (`y > z`) is obtained by the orientation-preserving 180°
  rotation around the line `(t, L/2, L/2)`:
  ```
  R(x, y, z) = (x, L − y, L − z),    det R = +1.
  ```
  R fixes the cube `[0,L]³` setwise but swaps the two prisms. Because R is in
  SO(3), it preserves chirality on every piece, so applying it to the lower
  half yields another 1R + 2L tiling — this time of the `y > z` prism.

Joining the two halves gives the **HT-realizable left** cube at 2R + 4L.
Reflecting through `x = L/2` (det = −1, flips every chirality) gives the
**HT-realizable right** mirror at 4R + 2L.

### Why "HT-realizable"

Appendix A shows that the 8-reptile of a single Hill T₁ tetrahedron always
produces 6 children of one handedness and 2 of the other. A 4+2 (or 2+4)
cube can be built from the 6 children of an HT decomposition (4 of the
majority handedness as corners + 2 mixed-handedness octahedron pieces re-cut
into half-prisms); a 3+3 cube cannot, because it requires 3 of each, and
no single Matoušek decomposition supplies that ratio. The B.1 cube exists as
a pure geometric scissors-congruence object; only the B.2 cubes are
assemblable from a bag of physical Plancktons drawn from one parent HT.
