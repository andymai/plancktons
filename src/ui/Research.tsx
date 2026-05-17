import { isAtLeast, useStore } from '../lib/store.js';
import { Histogram } from './research/Histogram.js';
import { Curve } from './research/Curve.js';
import { PairCorrelationPlot } from './research/PairCorrelationPlot.js';
import { KineticsPanel } from './research/KineticsPanel.js';
import { AutocorrPanel } from './research/AutocorrPanel.js';
import { ReferencesTable } from './research/ReferencesTable.js';

export function Research() {
  const mode = useStore((s) => s.mode);
  if (!isAtLeast(mode, 'research')) return null;
  return (
    <div className="research">
      <div className="panel-title">Research mode</div>
      <Histogram />
      <Curve />
      <PairCorrelationPlot />
      <KineticsPanel />
      <AutocorrPanel />
      <ReferencesTable />
    </div>
  );
}
