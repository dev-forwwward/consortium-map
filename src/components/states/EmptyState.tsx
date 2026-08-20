export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center"
    >
      <span className="font-display text-lg text-paper">{title}</span>
      <p className="max-w-[26ch] text-sm text-fog">{message}</p>
    </div>
  );
}
