// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { LEAVING_CLASS } from './viewSwitch';

// The page stylesheet (webflow/view-modes.css), checked through jsdom's cascade. Read from disk:
// Vitest stubs CSS imports (even ?raw), and the project has no Node types, hence the local type.
type ReadFileSync = (path: string, encoding: 'utf8') => string;
const FS = 'node:fs';
beforeAll(async () => {
  const { readFileSync } = (await import(/* @vite-ignore */ FS)) as { readFileSync: ReadFileSync };
  const css = readFileSync('webflow/view-modes.css', 'utf8') // relative to the repo root, where vitest runs;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
});

describe('view-modes.css: view switch', () => {
  it('a faded-out explorer takes no clicks', () => {
    // Its cards are still links: a click on the invisible explorer would open a project.
    document.body.innerHTML = `<div class="map-explorer ${LEAVING_CLASS}"></div>`;
    const explorer = document.querySelector('.map-explorer')!;
    expect(getComputedStyle(explorer).opacity).toBe('0');
    expect(getComputedStyle(explorer).pointerEvents).toBe('none');
  });
});
