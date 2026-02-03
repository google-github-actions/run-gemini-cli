/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import { validateInputs } from './validate-inputs';

vi.mock('@actions/core', () => {
  return {
    getInput: vi.fn(),
    getBooleanInput: vi.fn(),
    warning: vi.fn(),
    setFailed: vi.fn(),
    summary: {
      addHeading: vi.fn().mockReturnThis(),
      addList: vi.fn().mockReturnThis(),
      write: vi.fn().mockReturnThis(),
    },
  };
});

describe('validateInputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockInputs = (inputs: Record<string, string | undefined>) => {
    vi.mocked(core.getInput).mockImplementation((name) => inputs[name] || '');
    vi.mocked(core.getBooleanInput).mockImplementation(
      (name) => inputs[name] === 'true',
    );
  };

  describe('Invalid Inputs', () => {
    it.each([
      [
        'no authentication method is provided',
        {},
        'No authentication method provided',
      ],
      [
        'multiple authentication methods are provided',
        { gemini_api_key: 'key', google_api_key: 'key' },
        'Multiple authentication methods provided',
      ],
      [
        'WIF is used without project ID',
        { gcp_workload_identity_provider: 'provider' },
        "must also provide 'gcp_project_id'",
      ],
      [
        'WIF is used with token format but no service account',
        {
          gcp_workload_identity_provider: 'provider',
          gcp_project_id: 'project',
          gcp_token_format: 'access_token',
        },
        "must also provide 'gcp_service_account'",
      ],
      [
        'WIF is used with both Vertex AI and Code Assist',
        {
          gcp_workload_identity_provider: 'provider',
          gcp_project_id: 'project',
          use_vertex_ai: 'true',
          use_gemini_code_assist: 'true',
        },
        "must set exactly one of 'use_vertex_ai' or 'use_gemini_code_assist'",
      ],
      [
        'Google API Key is used without Vertex AI',
        { google_api_key: 'key' },
        "must set 'use_vertex_ai' to 'true'",
      ],
      [
        'Google API Key is used with Code Assist',
        {
          google_api_key: 'key',
          use_vertex_ai: 'true',
          use_gemini_code_assist: 'true',
        },
        "'use_gemini_code_assist' cannot be 'true'",
      ],
      [
        'Gemini API Key is used with Vertex AI',
        { gemini_api_key: 'key', use_vertex_ai: 'true' },
        "must be 'false'",
      ],
    ])('should warn if %s', (_, inputs, expectedWarning) => {
      mockInputs(inputs);
      validateInputs();

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining(expectedWarning),
        {
          title: 'Input validation',
        },
      );
      expect(core.summary.addHeading).toHaveBeenCalledWith(
        'Input validation warnings',
        3,
      );
      expect(core.summary.addList).toHaveBeenCalledWith([
        expect.stringContaining(expectedWarning),
      ]);
      expect(core.summary.write).toHaveBeenCalled();
    });
  });

  describe('Valid Inputs', () => {
    it.each([
      ['valid Gemini API Key inputs', { gemini_api_key: 'key' }],
      [
        'valid Google API Key inputs',
        { google_api_key: 'key', use_vertex_ai: 'true' },
      ],
      [
        'valid WIF inputs',
        {
          gcp_workload_identity_provider: 'provider',
          gcp_project_id: 'project',
          use_vertex_ai: 'true',
        },
      ],
    ])('should pass with %s', (_, inputs) => {
      mockInputs(inputs);
      validateInputs();
      expect(core.warning).not.toHaveBeenCalled();
      expect(core.setFailed).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should set failed on unexpected error', () => {
      vi.mocked(core.getInput).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      validateInputs();

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining(
          'Input validation failed: Error: Unexpected error',
        ),
      );
    });
  });
});
