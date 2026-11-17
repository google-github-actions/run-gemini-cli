/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['evals/**/*.security.test.ts'],
    globals: true,
    pool: 'forks',
  },
});
