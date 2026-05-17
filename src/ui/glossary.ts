export interface GlossaryEntry {
  shortLabel: string;
  short: string;
  body: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  planckton: {
    shortLabel: 'Planckton',
    short: 'A Hill T₁ orthoscheme — the right-tetrahedron studied in this app.',
    body: 'A "Planckton" is the project nickname for the Hill T₁ orthoscheme: the right-tetrahedron whose six congruent copies tile a cube. Edges (3·L, 2·√2L, 1·√3L) and four right-triangle faces (2 iso + 2 scalene). All six dihedral angles are rational multiples of π — the Dehn invariant is zero, so the orthoscheme is scissors-congruent to a cube.',
  },
  hillT1: {
    shortLabel: 'Hill T₁',
    short: "Hill's 1896 orthoscheme: 6 tile a cube exactly; all dihedrals are rational π.",
    body: 'M. J. M. Hill (1896) gave three families of tetrahedra that tile space, of which T₁ is the simplest: six congruent copies tile a unit cube exactly (3 right-handed + 3 left-handed). Hill T₁ is the canonical tetrahedron with the Dehn invariant equal to zero.',
  },
  etaC: {
    shortLabel: 'η_C',
    short: 'η_C = V*/V_hull. Convex compactness — NOT a real packing density.',
    body: 'η_C is the convex-hull packing fraction: the sum of Planckton volumes divided by the volume of the convex hull enclosing all their vertices. Because the hull shrink-wraps the aggregate, η_C can approach 1 even for sparse clusters — use it to compare runs **within** this app, not against literature RCP/FCC numbers.',
  },
  etaB: {
    shortLabel: 'η_B',
    short: 'η_B = V*/V_bbox. Bbox packing fraction — comparable to RCP/FCC literature.',
    body: 'η_B uses the axis-aligned bounding box (a fixed-orientation container), making it directly comparable to the canonical sphere RCP (≈0.636) and sphere FCC (≈0.7405) literature values. This is the metric to cite when comparing Planckton aggregation to other random-packing studies.',
  },
  etaM: {
    shortLabel: 'η_M',
    short: 'η_M = V*/V_morph (closure by an α-radius ball).',
    body: 'Morphological packing fraction: the aggregate is closed by a ball of radius α, filling pockets smaller than 2α. Always V★ ≤ V_morph ≤ V_hull ≤ V_bbox; setting α = L is the natural choice for an L-sized Hill orthoscheme.',
  },
  etaV: {
    shortLabel: 'η_V',
    short: 'η_V = V*/⟨V_voronoi⟩ over interior cells. The literature-standard metric.',
    body: 'Per-tet Voronoi cell volumes, averaged over the interior cells only (boundary cells are clipped by the simulation box and discarded). η_V is the canonical metric for random packings (Scott-Kilgour, Onoda-Liniger).',
  },
  dehnInvariant: {
    shortLabel: 'Dehn invariant',
    short:
      'A wedge-product of edge length and dihedral angle; cube and Planckton both have Dehn = 0.',
    body: 'The Dehn invariant of a polyhedron is the formal sum, over each edge, of (edge length) ⊗ (dihedral angle mod π), as an element of ℝ ⊗_ℤ (ℝ/πℚ). Sydler (1965): two polyhedra are scissors-congruent iff they have the same volume AND the same Dehn invariant. Hill T₁ has Dehn invariant 0 because every dihedral is a rational multiple of π — so it can be dissected into a cube.',
  },
  scissorsCongruence: {
    shortLabel: 'scissors-congruence',
    short: 'Two polyhedra are scissors-congruent iff equal volume + equal Dehn invariant.',
    body: "Two polyhedra are scissors-congruent if one can be cut into finitely many pieces that reassemble to the other. In 2D, Bolyai-Gerwien (1833) says equal area is sufficient. In 3D, Hilbert's 3rd problem asked whether equal volume sufficed for tetrahedra; Dehn (1900) answered no, by exhibiting his invariant. Hill T₁ is one of the few tetrahedra whose Dehn invariant vanishes — the cube tiling exhibits the dissection.",
  },
  chirality: {
    shortLabel: 'chirality',
    short: 'Right (R) and Left (L) Plancktons are mirror images. The cube tiling forces 3 R + 3 L.',
    body: 'A Planckton and its mirror image are not congruent under rotation alone — they are enantiomers. The 6-piece cube tiling requires exactly 3 R + 3 L (one per permutation of the (x,y,z) axes). The chirality bias slider sets the probability of drawing R vs L during growth.',
  },
  avrami: {
    shortLabel: 'Avrami',
    short: 'KJMA kinetics: η(t) = η∞·(1 − exp(−K·t^n)). n indicates the growth mechanism.',
    body: 'The Avrami / Kolmogorov-Johnson-Mehl-Avrami equation models nucleation-and-growth: the fraction transformed follows η(t) = η∞·(1 − exp(−K·t^n)). The exponent n distinguishes growth mechanisms: n≈1 surface-limited, n≈2 2D growth, n≈3 3D bulk, n≈4 increasing-rate nucleation.',
  },
  reptile: {
    shortLabel: 'm³-reptile',
    short: 'Self-similar dissection: each Planckton splits into 8 unit copies of itself.',
    body: 'A k-reptile is a polyhedron that dissects into k congruent scaled copies of itself. Matoušek & Safernová (2010) proved that for tetrahedra the only k-reptiles are k = m³ for some integer m, and Hill T₁ realizes the m=2 (k=8) case. Each depth-d recursion gives 8^d sub-Plancktons.',
  },
  gyrationTensor: {
    shortLabel: 'gyration tensor',
    short: 'G_ij = ⟨r_i r_j⟩ over centroids; eigenvalues describe the assembly shape.',
    body: 'The gyration tensor is the symmetric matrix G_ij = ⟨r_i r_j⟩ averaged over Planckton centroids relative to the assembly center of mass. Its three eigenvalues λ₁ ≥ λ₂ ≥ λ₃ give the squared principal radii. R_g = √(λ₁+λ₂+λ₃), asphericity b = λ₁ − ½(λ₂+λ₃), acylindricity c = λ₂ − λ₃. NOT the inertia tensor — that involves a different mass-weighting.',
  },
  bondOrder: {
    shortLabel: 'Q_l',
    short: 'Steinhardt bond-orientational order parameters from face-shared neighbor bonds.',
    body: 'Steinhardt Q_l parameters measure local rotational symmetry of the bond-direction distribution. Q_6 is the canonical crystallinity diagnostic: FCC/HCP ≈ 0.575, BCC ≈ 0.51, hard-sphere glass ≈ 0.40, random ≈ 0. Q_4 is sensitive to tetrahedral and icosahedral motifs.',
  },
  pairCorrelation: {
    shortLabel: 'g(r)',
    short: 'g(r) = local density at distance r normalized by bulk density.',
    body: 'The radial pair-correlation function g(r) measures how density varies with distance. Random uniform → 1 everywhere; periodic crystal → sharp peaks; amorphous solid → broad peaks decaying to 1. The anisotropic split g∥(r), g⊥(r) reveals nematic-like ordering aligned with the gyration axis.',
  },
  jamming: {
    shortLabel: 'jamming',
    short: 'No further face-to-face placement is geometrically possible.',
    body: 'A growth run is "jammed" or "stalled" when no valid placement exists on any free face — the two-phase placer (≤80 random tries, then deterministic exhaustive search) has eliminated every candidate via the SAT overlap test. Jamming is a strong statement, not a sampling artifact.',
  },
};
