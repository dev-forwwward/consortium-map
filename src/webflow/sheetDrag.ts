import {
  DEFAULT_PEEK_VISIBLE,
  TAP_THRESHOLD,
  clampOffset,
  computeSnapPoints,
  nextSnapOnTap,
  resolveSnap,
  type SheetSnap,
  type SnapPoints,
} from './sheetSnap';

export interface SheetDragOptions {
  sheet: HTMLElement;
  handle: HTMLElement;
  /** False on desktop: the handle is hidden there, but guard anyway. */
  isEnabled(): boolean;
  getSnap(): SheetSnap;
  onSnap(snap: SheetSnap): void;
}

export interface SheetDrag {
  cancel(): void;
  destroy(): void;
}

const DRAGGING_CLASS = 'is-sheet-dragging';
// Velocity is measured over the last stretch of the drag, not the whole of it.
const VELOCITY_WINDOW_MS = 100;

interface Sample {
  y: number;
  t: number;
}

function readPeekVisible(sheet: HTMLElement): number {
  const value = parseFloat(getComputedStyle(sheet).getPropertyValue('--cm-sheet-peek'));
  return Number.isFinite(value) ? value : DEFAULT_PEEK_VISIBLE;
}

/**
 * Drags the mobile sheet by its handle. While dragging, the sheet follows the
 * pointer through an inline transform (CSS transitions off via
 * `is-sheet-dragging`); on release it hands the chosen snap to `onSnap`, which
 * sets the class, and drops the inline transform so CSS animates to the snap.
 */
export function attachSheetDrag(options: SheetDragOptions): SheetDrag {
  const { sheet, handle } = options;

  let pointerId: number | null = null;
  let startY = 0;
  let startOffset = 0;
  let offset = 0;
  let points: SnapPoints = { full: 0, half: 0, peek: 0 };
  let samples: Sample[] = [];

  const reset = () => {
    if (pointerId !== null && handle.hasPointerCapture?.(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
    pointerId = null;
    samples = [];
    sheet.style.transform = '';
    sheet.classList.remove(DRAGGING_CLASS);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || !options.isEnabled() || pointerId !== null) return;
    pointerId = event.pointerId;
    handle.setPointerCapture?.(event.pointerId);
    points = computeSnapPoints(sheet.offsetHeight, readPeekVisible(sheet));
    startY = event.clientY;
    startOffset = points[options.getSnap()];
    offset = startOffset;
    samples = [{ y: event.clientY, t: event.timeStamp }];
    sheet.classList.add(DRAGGING_CLASS);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    offset = clampOffset(startOffset + (event.clientY - startY), points);
    sheet.style.transform = `translateY(${offset}px)`;
    samples.push({ y: event.clientY, t: event.timeStamp });
    while (samples.length > 2 && event.timeStamp - samples[0].t > VELOCITY_WINDOW_MS) {
      samples.shift();
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const travel = Math.abs(event.clientY - startY);
    const first = samples[0];
    const elapsed = event.timeStamp - first.t;
    const velocity = elapsed > 0 ? (event.clientY - first.y) / elapsed : 0;
    const current = options.getSnap();

    const target =
      travel < TAP_THRESHOLD ? nextSnapOnTap(current) : resolveSnap(offset, velocity, points);
    // Set the target class first, then drop the inline transform in the same
    // frame, so the transition runs from where the finger let go.
    options.onSnap(target);
    reset();
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId === pointerId) reset();
  };

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', onPointerCancel);

  return {
    cancel: reset,
    destroy() {
      reset();
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerCancel);
    },
  };
}
