export function MapErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-4 bg-ink px-6 text-center"
    >
      <span className="font-display text-xl text-paper">Map unavailable</span>
      <p className="max-w-[34ch] text-sm text-fog">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-none border border-brand px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] text-brand transition-colors hover:bg-brand hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
      >
        Retry
      </button>
    </div>
  );
}
