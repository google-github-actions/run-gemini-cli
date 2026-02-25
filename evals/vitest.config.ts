import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['evals/**/*.eval.ts'],
    testTimeout: 600000,
    hookTimeout: 600000,
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
