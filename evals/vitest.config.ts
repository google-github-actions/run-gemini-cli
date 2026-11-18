import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['evals/**/*.eval.ts'],
    testTimeout: 900000,
    hookTimeout: 900000,
    globals: true,
    pool: 'forks',
    maxWorkers: 2,
    sequence: {
      concurrent: true,
    },
    maxConcurrency: 2,
  },
});
