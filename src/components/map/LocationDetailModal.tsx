import { useEffect, useRef } from 'react';
import { useMapExplorer } from '../../hooks/useMapExplorer';
import { formatPlace } from '../../lib/mapUtils';

export function LocationDetailModal() {
  const { isDetailOpen, selectedLocation, closeDetail } = useMapExplorer();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isDetailOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isDetailOpen && dialog.open) {
      dialog.close();
    }
  }, [isDetailOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Fires on Escape, .close(), and our own backdrop click below — keep
    // context state in sync regardless of how the dialog was dismissed.
    const handleClose = () => closeDetail();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [closeDetail]);

  const handleBackdropClick: React.MouseEventHandler<HTMLDialogElement> = (event) => {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="location-detail-title"
      className="m-auto max-w-lg rounded-none border border-surface-line bg-surface p-0 text-paper backdrop:bg-ink/80"
    >
      {selectedLocation ? (
        <div className="flex flex-col">
          {selectedLocation.image ? (
            <img src={selectedLocation.image} alt="" className="h-56 w-full object-cover" />
          ) : null}
          <div className="flex flex-col gap-3 p-6">
            <span className="w-fit border border-brand px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-brand">
              {selectedLocation.category}
            </span>
            <h2 id="location-detail-title" className="font-display text-2xl leading-tight text-paper">
              {selectedLocation.name}
            </h2>
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-fog">
              {formatPlace(selectedLocation)}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {selectedLocation.url ? (
                <a
                  href={selectedLocation.url}
                  className="border border-brand bg-brand px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-transparent hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  View project
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="self-start border border-surface-line px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] text-paper transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
