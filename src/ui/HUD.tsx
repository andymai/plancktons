import type { GrowthMetrics } from '../scenes/GrowthScene.js';
import { useStore } from '../lib/store.js';

const fmt = (n: number, d = 4) => (Number.isFinite(n) ? n.toFixed(d) : '—');
const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—');

export function HUD({ metrics }: { metrics: GrowthMetrics | null }) {
  const scene = useStore((s) => s.scene);
  const advanced = useStore((s) => s.advanced);
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
          <div className="hud-row" title="Anisotropy: 0 = isotropic, 1 = rod-like">
            <span className="hud-label">κ² (anisotropy)</span>
            <span className="hud-value">{fmt(metrics.kappaSq, 3)}</span>
          </div>
          <div className="hud-row" title="Prolateness S: > 0 rod-like, < 0 disc-like">
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
