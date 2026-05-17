import type { GrowthMetrics } from '../scenes/GrowthScene.js';
import { useStore } from '../lib/store.js';

const fmt = (n: number, d = 4) => (Number.isFinite(n) ? n.toFixed(d) : '—');
const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—');

export function HUD({ metrics }: { metrics: GrowthMetrics | null }) {
  const scene = useStore((s) => s.scene);
  const advanced = useStore((s) => s.advanced);
  if (scene === 'single') return <SingleHUD />;
  if (scene === 'cube') return <CubeHUD />;
  if (scene === 'reptile') return <ReptileHUD />;
  if (scene !== 'growth' || !metrics) return null;
  return (
    <div className="hud">
      <div className="hud-row">
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
      <div className="hud-row">
        <span className="hud-label">V*</span>
        <span className="hud-value">{fmt(metrics.Vstar)}</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">V (hull)</span>
        <span className="hud-value">{fmt(metrics.V)}</span>
      </div>
      <div className="hud-row hud-prominent">
        <span className="hud-label">η = V*/V</span>
        <span className="hud-value">{pct(metrics.efficiency)}</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">free surface</span>
        <span className="hud-value">{fmt(metrics.surfaceArea, 3)}</span>
      </div>
      {!metrics.hullOk && (
        <div className="hud-warn">⚠ Hull computation failed (degenerate?)</div>
      )}
      {advanced && (
        <>
          <div className="hud-divider" />
          <div className="hud-section">Gyration / shape</div>
          <div className="hud-row">
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
          <div className="hud-row" title="Relative shape anisotropy ∈ [0,1]: 0 isotropic, 1 rod-like">
            <span className="hud-label">κ² (anisotropy)</span>
            <span className="hud-value">{fmt(metrics.kappaSq, 3)}</span>
          </div>
          <div className="hud-row" title="Prolateness S ∈ [−¼, 2]: > 0 rod-like, < 0 disc-like">
            <span className="hud-label">S (prolateness)</span>
            <span className="hud-value">{fmt(metrics.prolateness, 3)}</span>
          </div>
          <div className="hud-divider" />
          <div className="hud-section">Topology / chirality</div>
          <div className="hud-row">
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
          <div className="hud-row">
            <span className="hud-label">free iso / scalene</span>
            <span className="hud-value">
              {metrics.freeIso} / {metrics.freeScalene}
            </span>
          </div>
          <div className="hud-divider" />
          <div className="hud-section">Bounding box</div>
          <div className="hud-row">
            <span className="hud-label">V_bbox</span>
            <span className="hud-value">{fmt(metrics.bboxVolume, 3)}</span>
          </div>
          <div className="hud-row">
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
      <div className="hud-section">Hill T (Planckton)</div>
      <div className="hud-row"><span className="hud-label">volume</span><span className="hud-value">L³/6 ≈ 0.1667</span></div>
      <div className="hud-row"><span className="hud-label">edges</span><span className="hud-value">3·L, 2·√2L, 1·√3L</span></div>
      <div className="hud-row"><span className="hud-label">faces</span><span className="hud-value">2 iso right + 2 scalene right</span></div>
      <div className="hud-divider" />
      <div className="hud-section">Dihedral angles (rational π)</div>
      <div className="hud-row"><span className="hud-label">V₀V₁, V₂V₃</span><span className="hud-value">π/2</span></div>
      <div className="hud-row"><span className="hud-label">V₀V₂, V₁V₃</span><span className="hud-value">π/4</span></div>
      <div className="hud-row"><span className="hud-label">V₁V₂, V₀V₃</span><span className="hud-value">π/3</span></div>
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
      <div className="hud-section">6-piece cube tiling</div>
      <div className="hud-row"><span className="hud-label">N</span><span className="hud-value">6</span></div>
      <div className="hud-row"><span className="hud-label">chirality split</span><span className="hud-value">3 R + 3 L</span></div>
      <div className="hud-row"><span className="hud-label">V (cube)</span><span className="hud-value">L³</span></div>
      <div className="hud-row"><span className="hud-label">V★ = 6·L³/6</span><span className="hud-value">L³</span></div>
      <div className="hud-row hud-prominent"><span className="hud-label">η = V★/V</span><span className="hud-value">100.0%</span></div>
      <div className="hud-row" title="Surface area of the cube"><span className="hud-label">surface</span><span className="hud-value">6·L²</span></div>
    </div>
  );
}

function ReptileHUD() {
  const depth = useStore((s) => s.reptileDepth);
  const count = 8 ** depth;
  const pieceVol = 1 / 6 / 8 ** (depth - 1);
  return (
    <div className="hud">
      <div className="hud-section">8-reptile (depth {depth})</div>
      <div className="hud-row"><span className="hud-label">N (sub-Plancktons)</span><span className="hud-value">{count}</span></div>
      <div className="hud-row"><span className="hud-label">per-piece volume</span><span className="hud-value">L³/(6·8^{depth - 1}) ≈ {pieceVol.toFixed(6)}</span></div>
      <div className="hud-row"><span className="hud-label">V (parent)</span><span className="hud-value">(2L)³/6 ≈ 1.3333</span></div>
      <div className="hud-row hud-prominent"><span className="hud-label">η = V★/V</span><span className="hud-value">100.0%</span></div>
      <div className="hud-row" title="Matoušek & Safernová 2010 proved the m³-reptile family is the only one for tets">
        <span className="hud-label">k-reptile family</span>
        <span className="hud-value">k = m³ only</span>
      </div>
    </div>
  );
}
