import { isAtLeast, useStore } from '../../lib/store.js';
import { DraftSlider } from '../DraftSlider.js';
import { useDraftValue } from '../useDraftValue.js';
import { Term } from '../Term.js';

export function VacuumControls() {
  const vacuum = useStore((s) => s.vacuum);
  const setVacuum = useStore((s) => s.setVacuum);
  const bumpVacuumRun = useStore((s) => s.bumpVacuumRun);
  const mode = useStore((s) => s.mode);
  const [draftN, setDraftN] = useDraftValue(vacuum.N);
  const [draftChir, setDraftChir] = useDraftValue(vacuum.chiralityBias);
  const [draftRate, setDraftRate] = useDraftValue(vacuum.contractionRate);
  const [draftRest, setDraftRest] = useDraftValue(vacuum.restitution);

  return (
    <div>
      <div className="panel-title">Vacuum-bag compaction</div>
      <label
        className="slider-row"
        title="Number of loose tetrahedra dropped into the bag. Larger N takes longer to settle (precompute runs off the main thread with a progress bar)."
      >
        <span>Plancktons (N)</span>
        <DraftSlider
          min={2}
          max={150}
          step={1}
          value={Math.min(150, vacuum.N)}
          onCommit={(v) => setVacuum({ N: v })}
          onDraftChange={setDraftN}
        />
        <input
          type="number"
          min={2}
          max={150}
          step={1}
          value={draftN}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 2) setVacuum({ N: Math.min(150, n) });
          }}
          style={{ width: '4.2rem' }}
        />
      </label>
      <label
        className="slider-row"
        title="Deterministic seed. The same seed reproduces the exact same packing."
      >
        <span>Seed</span>
        <input
          type="number"
          min={0}
          value={vacuum.seed}
          onChange={(e) => setVacuum({ seed: parseInt(e.target.value, 10) || 1 })}
          style={{ width: '5.5rem' }}
        />
        <button
          onClick={() => setVacuum({ seed: Math.floor(Math.random() * 1e6) })}
          title="Random seed (keyboard: R)"
        >
          random
        </button>
        <button
          onClick={() => setVacuum({ seed: vacuum.seed + 1 })}
          title="Next seed (keyboard: N)"
        >
          next
        </button>
      </label>
      <label
        className="slider-row"
        title="Probability the next tet is right-handed. 0.5 = balanced."
      >
        <span>Chirality (R : L)</span>
        <DraftSlider
          min={0}
          max={1}
          step={0.01}
          value={vacuum.chiralityBias}
          onCommit={(v) => setVacuum({ chiralityBias: v })}
          onDraftChange={setDraftChir}
        />
        <span className="slider-value">
          {(draftChir * 100).toFixed(0)} : {((1 - draftChir) * 100).toFixed(0)}
        </span>
      </label>

      {isAtLeast(mode, 'research') && (
        <>
          <div className="panel-divider-small" />
          <label
            className="slider-row"
            title="How fast the bag wall contracts. Faster suction settles sooner but can leave a looser pack."
          >
            <span>Contraction rate</span>
            <DraftSlider
              min={0.2}
              max={4}
              step={0.1}
              value={vacuum.contractionRate}
              onCommit={(v) => setVacuum({ contractionRate: v })}
              onDraftChange={setDraftRate}
            />
            <span className="slider-value">{draftRate.toFixed(1)}</span>
          </label>
          <label
            className="slider-row"
            title="Contact restitution. 0 = fully damped settling; higher values make tets bounce, loosening the pack."
          >
            <span>Restitution</span>
            <DraftSlider
              min={0}
              max={0.6}
              step={0.05}
              value={vacuum.restitution}
              onCommit={(v) => setVacuum({ restitution: v })}
              onDraftChange={setDraftRest}
            />
            <span className="slider-value">{draftRest.toFixed(2)}</span>
          </label>
        </>
      )}

      <div className="panel-divider-small" />
      <div className="slider-row">
        <span>Run</span>
        <button
          onClick={bumpVacuumRun}
          style={{ flex: 1 }}
          title="Drop N tets in and suck the air out (recomputes the deterministic settle)."
        >
          Pack it
        </button>
      </div>
      <p className="caption">
        N loose <Term name="planckton" /> tetrahedra are squeezed into a jammed packing by a
        contracting bag — a deterministic, frictionless rigid-body settle. The wrinkled skin is the{' '}
        <Term name="etaM">morphological hull</Term> of the sealed pack. Scrub the timeline to replay
        the air being drawn out.
      </p>
    </div>
  );
}
