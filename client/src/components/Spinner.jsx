export default function Spinner({ label = "Loading…", fullScreen = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 text-sky-400 ${
        fullScreen ? "min-h-[60vh]" : "py-12"
      }`}
    >
      <span className="size-12 animate-spin rounded-full border-4 border-sky-500/30 border-t-sky-400" />
      <span className="font-sora text-sm text-slate-300">{label}</span>
    </div>
  );
}
