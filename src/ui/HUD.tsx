import type { GrowthMetrics } from '../scenes/GrowthScene.js';
import { useStore } from '../lib/store.js';

const fmt = (n: number, d = 4) => (Number.isFinite(n) ? n.toFixed(d) : '-');
const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '-');

export function HUD({ metrics }: { metrics: GrowthMetrics | null }) {
  const scene = useStore((s) => s.scene);
  const advanced = useStore((s) => s.advanced);
  if (scene === 'single') return <SingleHUD />;
  if (scene === 'cube') return <CubeHUD />;
  if (scene === 'reptile') return <ReptileHUD />;
  if (scene !== 'growth' || !metrics) return null;
  return (
    <div className="hud">
      <div
        className="hud-row"
        title="Plancktons placed so far / target. 'stalled' = no further face-to-face placement exists."
      >
        <span className="hud-label">N</span>
        <span className="hud-value">
          {metrics.N}
          {metrics.stalled && (
            <span className="hud-stalled" title="No more valid placements">
              {' '}
              / {metrics.targetN} stalled
            </span>
          )}
        </span>
      </div>
      <div
        className="hud-row"
        title="Sum of Planckton volumes: V* = N · L³/6. Exact since face-to-face mating never overlaps."
      >
        <span className="hud-label">V*</span>
        <span className="hud-value">{fmt(metrics.Vstar)}</span>
      </div>
      <div className="hud-row" title="Volume of the convex hull enclosing all Planckton vertices.">
        <span className="hud-label">V (hull)</span>
        <span className="hud-value">{fmt(metrics.V)}</span>
      </div>
      <div
        className="hud-row hud-prominent"
        title="η_C = V*/V_hull. Convex compactness, not a true packing density - the hull shrink-wraps the aggregate so this can approach 1 even for sparse clusters. Compare values WITHIN this app; do not compare against literature sphere RCP/FCC."
      >
        <span className="hud-label">η_C = V*/V_hull</span>
        <span className="hud-value">{pct(metrics.efficiency)}</span>
      </div>
      <div
        className="hud-row hud-prominent"
        title="η_B = V*/V_bbox. Bbox packing fraction. The bbox is a fixed-orientation container, so this IS comparable to literature sphere RCP ≈ 0.636, sphere FCC ≈ 0.74, etc."
      >
        <span className="hud-label">η_B = V*/V_bbox</span>
        <span className="hud-value">{pct(metrics.bboxEfficiency)}</span>
      </div>
      <div
        className="hud-row"
        title="Total area of all free (un-mated) Planckton faces. Decreases as growth fills concave pockets."
      >
        <span className="hud-label">free surface</span>
        <span className="hud-value">{fmt(metrics.surfaceArea, 3)}</span>
      </div>
      {!metrics.hullOk && <div className="hud-warn">⚠ Hull computation failed (degenerate?)</div>}
      {advanced && (
        <>
          <div className="hud-divider" />
          <div className="hud-section">Gyration / shape</div>
          <div
            className="hud-row"
            title="Radius of gyration: R_g = √(λ₁+λ₂+λ₃). Characteristic size of the assembly."
          >
            <span className="hud-label">R_g</span>
            <span className="hud-value">{fmt(metrics.rg, 3)}</span>
          </div>
          <div
            className="hud-row"
            title="Rudnick–Gaspari asphericity b = λ₁ − ½(λ₂+λ₃), units of length²"
          >
            <span className="hud-label">b (asphericity)</span>
            <span className="hud-value">{fmt(metrics.asphericity, 3)}</span>
          </div>
          <div className="hud-row" title="c = λ₂ − λ₃, units of length²">
            <span className="hud-label">c (acylindricity)</span>
            <span className="hud-value">{fmt(metrics.acylindricity, 3)}</span>
          </div>
          <div
            className="hud-row"
            title="Relative shape anisotropy ∈ [0,1]: 0 isotropic, 1 rod-like"
          >
            <span className="hud-label">κ² (anisotropy)</span>
            <span className="hud-value">{fmt(metrics.kappaSq, 3)}</span>
          </div>
          <div className="hud-row" title="Prolateness S ∈ [−¼, 2]: > 0 rod-like, < 0 disc-like">
            <span className="hud-label">S (prolateness)</span>
            <span className="hud-value">{fmt(metrics.prolateness, 3)}</span>
          </div>
          <div className="hud-divider" />
          <div
            className="hud-section"
            title="Steinhardt bond-orientational order parameters from face-shared neighbor bond directions. Rotation-invariant, in [0, 1]."
          >
            Bond-orientational order
          </div>
          <div
            className="hud-row"
            title="Q_4: sensitive to tetrahedral / icosahedral motifs. Random ≈ 0."
          >
            <span className="hud-label">Q₄</span>
            <span className="hud-value">{fmt(metrics.q4, 3)}</span>
          </div>
          <div
            className="hud-row"
            title="Q_6: the canonical crystallinity diagnostic. FCC/HCP ≈ 0.575; BCC ≈ 0.51; hard-sphere glass ≈ 0.40; random ≈ 0."
          >
            <span className="hud-label">Q₆</span>
            <span className="hud-value">{fmt(metrics.q6, 3)}</span>
          </div>
          <div className="hud-divider" />
          <div className="hud-section">Topology / chirality</div>
          <div
            className="hud-row"
            title="Right- vs left-handed Planckton count. The chirality slider sets the bias, geometry decides the rest."
          >
            <span className="hud-label">R / L</span>
            <span className="hud-value">
              {metrics.chirR} / {metrics.chirL}
            </span>
          </div>
          <div className="hud-row" title="Free faces / (4N). Saturation indicates jamming.">
            <span className="hud-label">free faces frac.</span>
            <span className="hud-value">{pct(metrics.freeFaceFrac)}</span>
          </div>
          <div className="hud-row" title="Mean number of tets meeting at each spatial vertex">
            <span className="hud-label">⟨coord⟩ / max</span>
            <span className="hud-value">
              {fmt(metrics.meanVertexCoord, 2)} / {metrics.maxVertexCoord}
            </span>
          </div>
          <div
            className="hud-row"
            title="Free faces by shape: isoceles right triangles (L,L,L√2) vs scalene right triangles (L,L√2,L√3)."
          >
            <span className="hud-label">free iso / scalene</span>
            <span className="hud-value">
              {metrics.freeIso} / {metrics.freeScalene}
            </span>
          </div>
          <div className="hud-divider" />
          <div className="hud-section">Bounding box</div>
          <div className="hud-row" title="Volume of the axis-aligned bounding box.">
            <span className="hud-label">V_bbox</span>
            <span className="hud-value">{fmt(metrics.bboxVolume, 3)}</span>
          </div>
          <div className="hud-row" title="Axis-aligned bounding box extent (Δx × Δy × Δz).">
            <span className="hud-label">dims</span>
            <span className="hud-value">
              {metrics.bboxSize.map((n) => n.toFixed(2)).join(' × ')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function SingleHUD() {
  return (
    <div className="hud">
      <div
        className="hud-section"
        title="Hill orthoscheme T₁ - the right-tetrahedron studied here as a 'Planckton'."
      >
        Hill T₁ (Planckton)
      </div>
      <div
        className="hud-row"
        title="Exactly 1/6 of a unit cube - six Hill orthoschemes tile the cube."
      >
        <span className="hud-label">volume</span>
        <span className="hud-value">L³/6 ≈ 0.1667</span>
      </div>
      <div
        className="hud-row"
        title="Six edges: three of length L (orthogonal), two of √2L (face diagonals), one of √3L (space diagonal)."
      >
        <span className="hud-label">edges</span>
        <span className="hud-value">3·L, 2·√2L, 1·√3L</span>
      </div>
      <div
        className="hud-row"
        title="Four right-triangle faces: two isoceles (L,L,√2L) and two scalene (L,√2L,√3L)."
      >
        <span className="hud-label">faces</span>
        <span className="hud-value">2 iso right + 2 scalene right</span>
      </div>
      <div className="hud-divider" />
      <div className="hud-section">Dihedral angles (rational π)</div>
      <div className="hud-row">
        <span className="hud-label">V₀V₁, V₂V₃</span>
        <span className="hud-value">π/2</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">V₀V₂, V₁V₃</span>
        <span className="hud-value">π/4</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">V₁V₂, V₀V₃</span>
        <span className="hud-value">π/3</span>
      </div>
      <div className="hud-row" title="Dehn invariant = 0 iff scissors-congruent to a cube">
        <span className="hud-label">Dehn invariant</span>
        <span className="hud-value">0</span>
      </div>
    </div>
  );
}

function CubeHUD() {
  return (
    <div className="hud">
      <div
        className="hud-section"
        title="Hill (1896): six congruent orthoschemes tile every cube exactly."
      >
        6-piece cube tiling
      </div>
      <div className="hud-row" title="Six Plancktons per cube.">
        <span className="hud-label">N</span>
        <span className="hud-value">6</span>
      </div>
      <div
        className="hud-row"
        title="The tiling requires three right-handed and three left-handed pieces - chirality is forced by geometry."
      >
        <span className="hud-label">chirality split</span>
        <span className="hud-value">3 R + 3 L</span>
      </div>
      <div className="hud-row" title="Volume of the enclosing cube.">
        <span className="hud-label">V (cube)</span>
        <span className="hud-value">L³</span>
      </div>
      <div className="hud-row" title="Total Planckton volume = 6 × (L³/6) = L³.">
        <span className="hud-label">V★ = 6·L³/6</span>
        <span className="hud-value">L³</span>
      </div>
      <div
        className="hud-row hud-prominent"
        title="Perfect packing - the upper bound that random aggregation cannot reach."
      >
        <span className="hud-label">η = V★/V</span>
        <span className="hud-value">100.0%</span>
      </div>
      <div className="hud-row" title="Surface area of the cube">
        <span className="hud-label">surface</span>
        <span className="hud-value">6·L²</span>
      </div>
    </div>
  );
}

function ReptileHUD() {
  const depth = useStore((s) => s.reptileDepth);
  const count = 8 ** depth;
  const pieceVol = 1 / 6 / 8 ** (depth - 1);
  return (
    <div className="hud">
      <div
        className="hud-section"
        title="Self-similar dissection: each Planckton splits into 8 scaled copies of itself."
      >
        8-reptile (depth {depth})
      </div>
      <div className="hud-row" title="At depth d, the parent contains 8^d sub-Plancktons.">
        <span className="hud-label">N (sub-Plancktons)</span>
        <span className="hud-value">{count}</span>
      </div>
      <div className="hud-row" title="Each level halves linear scale, so volume drops by 8.">
        <span className="hud-label">per-piece volume</span>
        <span className="hud-value">
          L³/(6·8^{depth - 1}) ≈ {pieceVol.toFixed(6)}
        </span>
      </div>
      <div className="hud-row" title="Parent Planckton edge-length is 2L, volume (2L)³/6.">
        <span className="hud-label">V (parent)</span>
        <span className="hud-value">(2L)³/6 ≈ 1.3333</span>
      </div>
      <div
        className="hud-row hud-prominent"
        title="Self-similar dissection is exact at every depth."
      >
        <span className="hud-label">η = V★/V</span>
        <span className="hud-value">100.0%</span>
      </div>
      <div
        className="hud-row"
        title="Matoušek & Safernová 2010 proved the m³-reptile family is the only one for tets"
      >
        <span className="hud-label">k-reptile family</span>
        <span className="hud-value">k = m³ only</span>
      </div>
    </div>
  );
}
