// Published packing densities and tiling efficiencies for reference comparison.
//
// All values are "packing density" Δ ∈ [0, 1] = (occupied volume) / (container
// volume). For convex-body packings this is the standard quantity. For Hill T
// assemblies the analogous quantity is V*/V (sum of part volumes / shrink-wrap),
// so values are directly comparable when V is the convex hull.

export interface PackingReference {
  /** Short label for plot legends. */
  label: string;
  /** Δ ∈ (0, 1]. */
  density: number;
  /** Color hint for plotting. */
  color: string;
  /** One-line explanation. */
  note: string;
  /** Bibliographic source. */
  citation: string;
}

export const PACKING_REFERENCES: ReadonlyArray<PackingReference> = [
  {
    label: 'Perfect tiling',
    density: 1.0,
    color: '#5cd99b',
    note: 'Hill T tilings (6 in cube, 8-reptile) achieve zero void.',
    citation: 'Hill (1896); Matoušek & Safernová (2010, arXiv:1006.1807)',
  },
  {
    label: 'Sphere FCC',
    density: Math.PI / Math.sqrt(18), // 0.74048...
    color: '#e7a44a',
    note: 'Densest possible packing of congruent spheres in ℝ³.',
    citation: 'Hales (2005), Ann. Math. 162, 1065. Kepler conjecture, proved.',
  },
  {
    label: 'Regular tet (Welsh, displaced)',
    density: 0.717455,
    color: '#c46cd9',
    note: 'Best known packing density for regular tetrahedra (not tiling).',
    citation: 'Conway & Torquato (2006), PNAS 103, 10612.',
  },
  {
    label: 'Regular tet (Bravais lattice)',
    density: 18 / 49, // 0.36734
    color: '#9d6ad9',
    note: 'Densest single-orientation lattice packing of regular tets.',
    citation: 'Hoylman (1970), Bull. Amer. Math. Soc. 76, 135.',
  },
  {
    label: 'Sphere random close packing',
    density: 0.6366,
    color: '#5fa8e3',
    note: 'Maximum density for random (jammed) sphere packings.',
    citation: 'Scott & Kilgour (1969), J. Phys. D 2, 863.',
  },
  {
    label: 'Sphere random loose packing',
    density: 0.555,
    color: '#3a83bf',
    note: 'Loosest mechanically stable random sphere packing.',
    citation: 'Onoda & Liniger (1990), Phys. Rev. Lett. 64, 2727.',
  },
];

/** Filter the references to display, by label. */
export function refsByLabel(labels: ReadonlyArray<string>): PackingReference[] {
  return PACKING_REFERENCES.filter((r) => labels.includes(r.label));
}
