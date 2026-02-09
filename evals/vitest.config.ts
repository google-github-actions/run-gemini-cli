import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['evals/**/*.eval.ts'],
    testTimeout: 600000,
    hookTimeout: 600000,
    globals: true,
    sequence: {
      concurrent: true,
    },
    maxConcurrency: 2,
  },
});
