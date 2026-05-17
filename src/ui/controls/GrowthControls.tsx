import { useStore } from '../../lib/store.js';
import { DraftSlider } from '../DraftSlider.js';
import { useDraftValue } from '../useDraftValue.js';
import { Term } from '../Term.js';

export function GrowthControls() {
  const growth = useStore((s) => s.growth);
  const setGrowth = useStore((s) => s.setGrowth);
  const animationMode = useStore((s) => s.animationMode);
  const setAnimationMode = useStore((s) => s.setAnimationMode);
  const animSpeed = useStore((s) => s.animSpeed);
  const setAnimSpeed = useStore((s) => s.setAnimSpeed);
  const lastNonZeroAnimSpeed = useStore((s) => s.lastNonZeroAnimSpeed);
  const [draftN, setDraftN] = useDraftValue(growth.N);
  const [draftBeta, setDraftBeta] = useDraftValue(growth.compactBeta);
  const [draftChir, setDraftChir] = useDraftValue(growth.chiralityBias);
  return (
    <div>
      <div className="panel-title">Random face-to-face growth</div>
      <label
        className="slider-row"
        title="Target Planckton count. Slider goes to 1000 to cover the asymptotic regime (η flattens near N ≈ 500-1000 for compact β=3). Type for higher; growth is ~3 s/trial at N=400, ~10 s/trial at N=1000."
      >
        <span>Plancktons (N)</span>
        <DraftSlider
          min={1}
          max={1000}
          step={1}
          value={Math.min(1000, growth.N)}
          onCommit={(v) => setGrowth({ N: v })}
          onDraftChange={setDraftN}
        />
        <input
          type="number"
          min={1}
          max={2000}
          step={1}
          value={draftN}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 1) setGrowth({ N: Math.min(2000, n) });
          }}
          style={{ width: '4.2rem' }}
          title="Slider tops at 1000; type above for N up to 2000 (slow at extreme N)."
        />
      </label>
      <label
        className="slider-row"
        title="Deterministic PRNG seed. Re-running with the same seed reproduces the exact same assembly."
      >
        <span>Seed</span>
        <input
          type="number"
          min={0}
          value={growth.seed}
          onChange={(e) => setGrowth({ seed: parseInt(e.target.value, 10) || 1 })}
          style={{ width: '5.5rem' }}
        />
        <button
          onClick={() => setGrowth({ seed: Math.floor(Math.random() * 1e6) })}
          title="Random seed (keyboard: R)"
        >
          random
        </button>
        <button
          onClick={() => setGrowth({ seed: growth.seed + 1 })}
          title="Next deterministic trial - seed + 1 (keyboard: N)"
        >
          next
        </button>
      </label>
      <label className="slider-row">
        <span>Strategy</span>
        <select
          value={growth.strategy}
          onChange={(e) => setGrowth({ strategy: e.target.value as 'uniform' | 'compact' })}
          title="How the next free face is chosen. Uniform = unbiased random; compact = prefer concave pockets toward the assembly centroid."
        >
          <option value="uniform">Uniform random</option>
          <option value="compact">Compact - fill pockets</option>
        </select>
      </label>
      {growth.strategy === 'compact' && (
        <label
          className="slider-row"
          title="Inverse temperature in p(face) ∝ exp(β·n̂·ĉ). β=0 recovers uniform; β≳15 saturates to greedy 'always fill the deepest pocket'."
        >
          <span>β (compactness)</span>
          <DraftSlider
            min={0}
            max={20}
            step={0.2}
            value={growth.compactBeta}
            onCommit={(v) => setGrowth({ compactBeta: v })}
            onDraftChange={setDraftBeta}
          />
          <span className="slider-value">{draftBeta.toFixed(1)}</span>
        </label>
      )}
      <label
        className="slider-row"
        title="Probability the next Planckton drawn is right-handed. 0 = all-L, 1 = all-R, 0.5 = balanced."
      >
        <span>Chirality (R : L)</span>
        <DraftSlider
          min={0}
          max={1}
          step={0.01}
          value={growth.chiralityBias}
          onCommit={(v) => setGrowth({ chiralityBias: v })}
          onDraftChange={setDraftChir}
        />
        <span className="slider-value">
          {(draftChir * 100).toFixed(0)} : {((1 - draftChir) * 100).toFixed(0)}
        </span>
      </label>
      <div className="panel-divider-small" />
      <label className="slider-row">
        <span>Playback</span>
        <select
          value={animationMode}
          onChange={(e) => setAnimationMode(e.target.value as 'instant' | 'animated' | 'step')}
          title="How the assembly fills in. Instant = jump to N; animated = grow at a configurable rate; step = one Planckton per click (or Space)."
        >
          <option value="instant">Instant</option>
          <option value="animated">Animated</option>
          <option value="step">Manual (step)</option>
        </select>
      </label>
      {animationMode === 'animated' && (
        <label className="slider-row">
          <span>Speed</span>
          <input
            type="range"
            min={0.5}
            max={30}
            step={0.5}
            value={animSpeed > 0 ? animSpeed : lastNonZeroAnimSpeed}
            onChange={(e) => setAnimSpeed(parseFloat(e.target.value))}
          />
          <span className="slider-value">
            {animSpeed > 0 ? `${animSpeed.toFixed(1)}/s` : 'paused'}
          </span>
        </label>
      )}
      {animationMode === 'step' && <StepButton />}
      <p className="caption">
        Each step picks a free face at random and glues a fresh <Term name="planckton" /> onto a
        congruent face. SAT-checked rejection guarantees no two Plancktons overlap. Compact mode
        biases toward concave pockets — tighter packings, but also earlier <Term name="jamming" />.
      </p>
    </div>
  );
}

function StepButton() {
  const bumpStep = useStore((s) => s.bumpStep);
  return (
    <div className="slider-row">
      <span>Step</span>
      <button
        onClick={bumpStep}
        style={{ flex: 1 }}
        title="Append one Planckton, clamped to the N target (keyboard: Space)"
      >
        Add tet
      </button>
    </div>
  );
}
