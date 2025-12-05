/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporters: ['default', 'junit'],
    silent: true,
    outputFile: {
      junit: 'junit.xml',
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', '**/*.d.ts'],
      reporter: [
        ['text', { file: 'full-text-summary.txt' }],
        'text',
        'html',
        ['json-summary', { outputFile: 'coverage-summary.json' }],
      ],
    },
  },
});
