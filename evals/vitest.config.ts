import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['evals/**/*.eval.ts'],
    testTimeout: 900000,
    hookTimeout: 900000,
    globals: true,
    pool: 'threads',
    threads: {
      minThreads: 2,
      maxThreads: 4,
    },
    sequence: {
      concurrent: true,
    },
    maxConcurrency: 4,
  },
});
