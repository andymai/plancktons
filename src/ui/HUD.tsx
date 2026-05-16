import type { GrowthMetrics } from '../scenes/GrowthScene.js';
import { useStore } from '../lib/store.js';

export function HUD({ metrics }: { metrics: GrowthMetrics | null }) {
  const scene = useStore((s) => s.scene);
  const advanced = useStore((s) => s.advanced);
  if (scene !== 'growth') return null;
  if (!metrics) return null;
  return (
    <div className="hud">
      <div className="hud-row">
        <span className="hud-label">N</span>
        <span className="hud-value">{metrics.N}</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">V*</span>
        <span className="hud-value">{metrics.Vstar.toFixed(4)}</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">V (hull)</span>
        <span className="hud-value">{metrics.V.toFixed(4)}</span>
      </div>
      <div className="hud-row hud-prominent">
        <span className="hud-label">efficiency V*/V</span>
        <span className="hud-value">{(metrics.efficiency * 100).toFixed(1)}%</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">surface</span>
        <span className="hud-value">{metrics.surfaceArea.toFixed(3)}</span>
      </div>
      {advanced && (
        <>
          <div className="hud-row">
            <span className="hud-label">bbox V</span>
            <span className="hud-value">{metrics.bboxVolume.toFixed(3)}</span>
          </div>
          <div className="hud-row">
            <span className="hud-label">bbox</span>
            <span className="hud-value">
              {metrics.bboxSize.map((n) => n.toFixed(2)).join(' × ')}
            </span>
          </div>
          <div className="hud-row">
            <span className="hud-label">free iso / scalene</span>
            <span className="hud-value">
              {metrics.freeIso} / {metrics.freeScalene}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
