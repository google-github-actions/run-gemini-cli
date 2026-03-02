import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['evals/**/*.eval.ts'],
    testTimeout: 900000,
    hookTimeout: 900000,
    globals: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 4,
        maxThreads: 8,
      },
    },
    sequence: {
      concurrent: true,
    },
    maxConcurrency: 10,
  },
});
