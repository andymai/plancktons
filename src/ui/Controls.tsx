import { isAtLeast, useStore } from '../lib/store.js';
import type { SceneId } from '../lib/store.js';
import { useRadioGroup } from './useRadioGroup.js';
import { SingleControls } from './controls/SingleControls.js';
import { CubeControls } from './controls/CubeControls.js';
import { ReptileControls } from './controls/ReptileControls.js';
import { GrowthControls } from './controls/GrowthControls.js';
import { VacuumControls } from './controls/VacuumControls.js';
import { DisplayControls } from './controls/DisplayControls.js';
import { AnalysesControls } from './controls/AnalysesControls.js';

const SCENES = [
  {
    id: 'single' as const,
    label: 'Single Planckton',
    tip: 'One Hill orthoscheme - inspect its edges, faces, and rational-π dihedral angles.',
  },
  {
    id: 'cube' as const,
    label: 'Cube tiling (6 pieces)',
    tip: 'Six Plancktons (3 R + 3 L) tile a unit cube exactly. The η = 1 reference case.',
  },
  {
    id: 'reptile' as const,
    label: '8-reptile dissection',
    tip: 'Matoušek-Safernová m³ self-similar dissection: every Planckton splits into 8 copies of itself.',
  },
  {
    id: 'growth' as const,
    label: 'Random face-to-face growth',
    tip: 'Face-restricted cluster aggregation (Eden-like growth on the face graph) with SAT overlap rejection. Not standard RSA (no spatial randomness) and not DLA (no diffusion). Aggregate density study this app is built around.',
  },
  {
    id: 'vacuum' as const,
    label: 'Vacuum-bag compaction',
    tip: 'Loose tetrahedra are squeezed into a jammed random packing by a contracting bag — a deterministic, frictionless rigid-body settle. Press "Pack it" to run, then scrub the air-removal timeline.',
  },
];

const SCENE_IDS = SCENES.map((s) => s.id) as readonly SceneId[];

export function Controls() {
  const scene = useStore((s) => s.scene);
  const setScene = useStore((s) => s.setScene);
  const mode = useStore((s) => s.mode);
  const getSceneRadioProps = useRadioGroup(SCENE_IDS, scene, setScene);
  return (
    <div className="controls">
      <div className="panel-header">
        <span className="panel-title">Scene</span>
      </div>
      <div className="scene-list" role="radiogroup" aria-label="Scene">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={scene === s.id}
            className={`scene-button ${scene === s.id ? 'active' : ''}`}
            onClick={() => setScene(s.id)}
            title={`${s.tip}  (Keyboard: ${i + 1})`}
            {...getSceneRadioProps(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="panel-divider" />
      <SceneControls />
      {isAtLeast(mode, 'explore') && (
        <>
          <div className="panel-divider" />
          <DisplayControls />
        </>
      )}
      {isAtLeast(mode, 'research') && (
        <>
          <div className="panel-divider" />
          <AnalysesControls />
        </>
      )}
      <ShortcutsHint />
    </div>
  );
}

function SceneControls() {
  const scene = useStore((s) => s.scene);
  if (scene === 'single') return <SingleControls />;
  if (scene === 'cube') return <CubeControls />;
  if (scene === 'reptile') return <ReptileControls />;
  if (scene === 'growth') return <GrowthControls />;
  if (scene === 'vacuum') return <VacuumControls />;
  return null;
}

function ShortcutsHint() {
  return (
    <details className="shortcuts-details">
      <summary>Keyboard shortcuts</summary>
      <table className="shortcuts-table">
        <tbody>
          <tr>
            <td>1 – 5</td>
            <td>jump to scene</td>
          </tr>
          <tr>
            <td>← / →</td>
            <td>cycle scenes</td>
          </tr>
          <tr>
            <td>R</td>
            <td>random seed</td>
          </tr>
          <tr>
            <td>N</td>
            <td>next seed (seed + 1)</td>
          </tr>
          <tr>
            <td>A</td>
            <td>cycle animation mode</td>
          </tr>
          <tr>
            <td>Space</td>
            <td>play/pause (animated) or step</td>
          </tr>
          <tr>
            <td>?</td>
            <td>cycle mode (learn / explore / research)</td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}
