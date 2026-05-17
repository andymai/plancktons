import { useStore } from '../../lib/store.js';
import { Term } from '../Term.js';
import { useRadioGroup } from '../useRadioGroup.js';

const CHIRALITY_IDS = ['R', 'L'] as const;

export function SingleControls() {
  const chir = useStore((s) => s.singleChirality);
  const set = useStore((s) => s.setSingleChirality);
  const showAngles = useStore((s) => s.singleShowAngles);
  const setShowAngles = useStore((s) => s.setSingleShowAngles);
  const getRadioProps = useRadioGroup(CHIRALITY_IDS, chir, set);
  return (
    <div>
      <div className="panel-title">Chirality</div>
      <div className="chirality-toggle" role="radiogroup" aria-label="Chirality">
        <button
          type="button"
          role="radio"
          aria-checked={chir === 'R'}
          className={`chir-btn ${chir === 'R' ? 'active' : ''}`}
          onClick={() => set('R')}
          {...getRadioProps('R')}
        >
          Right (red)
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={chir === 'L'}
          className={`chir-btn ${chir === 'L' ? 'active' : ''}`}
          onClick={() => set('L')}
          {...getRadioProps('L')}
        >
          Left (white)
        </button>
      </div>
      <label
        className="checkbox-row"
        title="Float text labels at each edge midpoint showing the dihedral angle in rational-π form (π/2, π/3, π/4). Visual proof that the Dehn invariant collapses to zero."
      >
        <input
          type="checkbox"
          checked={showAngles}
          onChange={(e) => setShowAngles(e.target.checked)}
        />
        Show dihedral angles
      </label>
      <p className="caption">
        A <Term name="planckton" /> (<Term name="hillT1" /> orthoscheme). Four faces, two shapes:
        isoceles-right (1, 1, √2) and scalene-right (1, √2, √3). The two{' '}
        <Term name="chirality">chiralities</Term> are mirror images. All 6 dihedral angles are
        rational multiples of π — the <Term name="dehnInvariant" /> property.
      </p>
    </div>
  );
}
