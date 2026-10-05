import { describe, expect, it } from 'vitest';
import {
  clampOffset,
  computeSnapPoints,
  nextSnapOnTap,
  resolveSnap,
} from './sheetSnap';

const points = computeSnapPoints(800, 72);

describe('computeSnapPoints', () => {
  it('places full at 0, half at the middle, peek showing the handle', () => {
    expect(points).toEqual({ full: 0, half: 400, peek: 728 });
  });

  it('never returns a negative peek on a tiny track', () => {
    expect(computeSnapPoints(50, 72)).toEqual({ full: 0, half: 25, peek: 0 });
  });
});

describe('resolveSnap', () => {
  it('snaps to the nearest point on a slow release', () => {
    expect(resolveSnap(380, 0, points)).toBe('half');
    expect(resolveSnap(700, 0.2, points)).toBe('peek');
    expect(resolveSnap(100, -0.2, points)).toBe('full');
  });

  it('treats a velocity just under the threshold as slow', () => {
    expect(resolveSnap(380, 0.49, points)).toBe('half');
  });

  it('follows a downward flick to the next point below', () => {
    expect(resolveSnap(390, 0.8, points)).toBe('half');
    expect(resolveSnap(410, 0.8, points)).toBe('peek');
    expect(resolveSnap(10, 0.5, points)).toBe('half');
  });

  it('follows an upward flick to the next point above', () => {
    expect(resolveSnap(390, -0.8, points)).toBe('full');
    expect(resolveSnap(700, -0.8, points)).toBe('half');
  });

  it('clamps a flick past either end', () => {
    expect(resolveSnap(728, 2, points)).toBe('peek');
    expect(resolveSnap(0, -2, points)).toBe('full');
  });
});

describe('nextSnapOnTap', () => {
  it('cycles peek → half → full → peek', () => {
    expect(nextSnapOnTap('peek')).toBe('half');
    expect(nextSnapOnTap('half')).toBe('full');
    expect(nextSnapOnTap('full')).toBe('peek');
  });
});

describe('clampOffset', () => {
  it('keeps the offset between full and peek', () => {
    expect(clampOffset(-40, points)).toBe(0);
    expect(clampOffset(900, points)).toBe(728);
    expect(clampOffset(300, points)).toBe(300);
  });
});
