import { defineConfig } from 'vitest/config';

// Tests only. The SPA and embed builds have their own configs.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    environmentOptions: {
      // Gives jsdom-environment tests a requestAnimationFrame.
      jsdom: { pretendToBeVisual: true },
    },
  },
});
