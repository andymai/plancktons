export function ProgressBar({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label?: string;
}) {
  const pct = total > 0 ? (100 * done) / total : 0;
  const accessibleLabel = label ? `${label}: ${done} of ${total}` : `${done} of ${total}`;
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={accessibleLabel}
      title={label}
    >
      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      <span className="progress-bar-label" aria-hidden="true">
        {label ? `${label} ` : ''}
        {done} / {total}
      </span>
    </div>
  );
}
