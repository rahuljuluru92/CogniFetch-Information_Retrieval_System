export default function ProgressBar({ done, total, label = "Progress" }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} topics done`}
        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700"
      >
        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-12 text-right text-xs text-slate-400 tabular-nums">{percent}%</span>
    </div>
  );
}
