import type { GrowthMetrics } from '../scenes/GrowthScene.js';
import type { VacuumHudMetrics } from '../scenes/VacuumScene.js';
import { HUD } from './HUD.js';
import { ResizablePane } from './ResizablePane.js';
import { useUiStore } from './uiStore.js';

export function MetricsPanel({
  metrics,
  vacuum,
}: {
  metrics: GrowthMetrics | null;
  vacuum: VacuumHudMetrics | null;
}) {
  const hidden = useUiStore((s) => s.metricsHidden);
  const toggle = useUiStore((s) => s.toggleMetricsHidden);

  if (hidden) {
    return (
      <button
        type="button"
        className="metrics-tab"
        onClick={toggle}
        title="Show metrics panel"
        aria-label="Show metrics panel"
        aria-expanded={false}
      >
        »
      </button>
    );
  }

  return (
    <ResizablePane
      side="right"
      storageKey="plancktons.metrics.width"
      defaultWidth={280}
      minWidth={240}
      maxWidth={420}
      className="metrics-panel"
    >
      <div className="metrics-header">
        <span className="panel-title" style={{ margin: 0 }}>
          Metrics
        </span>
        <button
          type="button"
          className="metrics-collapse"
          onClick={toggle}
          title="Hide metrics panel"
          aria-label="Hide metrics panel"
          aria-expanded={true}
        >
          «
        </button>
      </div>
      <HUD metrics={metrics} vacuum={vacuum} />
    </ResizablePane>
  );
}
