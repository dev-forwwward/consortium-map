/**
 * Snap maths for the mobile project sheet. Offsets are the sheet's
 * translateY in px from the top of its track: `full` is 0 (covers the map),
 * `peek` leaves only the handle and title visible.
 */
export type SheetSnap = 'peek' | 'half' | 'full';
export type SnapPoints = Record<SheetSnap, number>;

/** Release speed (px/ms) above which a drag counts as a flick. */
export const FLICK_VELOCITY = 0.5;
/** Pointer travel (px) below which a press counts as a tap. */
export const TAP_THRESHOLD = 6;
/** Fallback for the `--cm-sheet-peek` CSS variable. */
export const DEFAULT_PEEK_VISIBLE = 72;

// Ascending offset: top of the screen first.
const ORDER: SheetSnap[] = ['full', 'half', 'peek'];

export function computeSnapPoints(trackHeight: number, peekVisible: number): SnapPoints {
  const height = Math.max(0, trackHeight);
  return {
    full: 0,
    half: Math.round(height / 2),
    peek: Math.max(0, height - peekVisible),
  };
}

export function clampOffset(offset: number, points: SnapPoints): number {
  return Math.min(points.peek, Math.max(points.full, offset));
}

export function resolveSnap(offset: number, velocity: number, points: SnapPoints): SheetSnap {
  if (Math.abs(velocity) >= FLICK_VELOCITY) {
    const down = velocity > 0;
    const ahead = ORDER.filter((snap) => (down ? points[snap] > offset : points[snap] < offset));
    if (ahead.length === 0) return down ? 'peek' : 'full';
    return down ? ahead[0] : ahead[ahead.length - 1];
  }
  return ORDER.reduce((best, snap) =>
    Math.abs(points[snap] - offset) < Math.abs(points[best] - offset) ? snap : best,
  );
}

export function nextSnapOnTap(current: SheetSnap): SheetSnap {
  if (current === 'peek') return 'half';
  if (current === 'half') return 'full';
  return 'peek';
}
