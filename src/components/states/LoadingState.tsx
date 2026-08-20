export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-fog"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-surface-line border-t-brand" />
      <span className="font-mono text-xs uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}
