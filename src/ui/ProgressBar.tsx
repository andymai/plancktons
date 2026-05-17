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
  return (
    <div className="progress-bar" title={label}>
      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      <span className="progress-bar-label">
        {label ? `${label} ` : ''}
        {done} / {total}
      </span>
    </div>
  );
}
