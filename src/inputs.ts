/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as core from '@actions/core';

/**
 * Safely retrieves a boolean input.
 * If the input is missing or empty, returns false.
 * This avoids "Input does not meet YAML 1.2 specification" errors when
 * the environment variable is not set (typical in composite actions where
 * we only map specific inputs).
 */
const getOptionalBooleanInput = (name: string) =>
  core.getInput(name) ? core.getBooleanInput(name) : false;

/**
 * Retrieves all inputs for the Gemini CLI action.
 *
 * NOTE: For these inputs to be available in a composite action, they must be explicitly
 * passed as environment variables with the `INPUT_` prefix in `action.yml`.
 *
 * Example `action.yml` configuration:
 * ```yaml
 * run:
 *  path/to/file.ts
 * env:
 *   INPUT_GEMINI_API_KEY: '${{ inputs.gemini_api_key }}'
 *   INPUT_GOOGLE_API_KEY: '${{ inputs.google_api_key }}'
 * ```
 *
 * @returns An object containing all action inputs.
 */
export const geminiCliActionsInputs = () => {
  return {
    gcpLocation: core.getInput('gcp_location'),
    gcpProjectId: core.getInput('gcp_project_id'),
    gcpServiceAccount: core.getInput('gcp_service_account'),
    gcpWorkloadIdentityProvider: core.getInput(
      'gcp_workload_identity_provider',
    ),
    gcpTokenFormat: core.getInput('gcp_token_format'),
    gcpAccessTokenScopes: core.getInput('gcp_access_token_scopes'),
    geminiApiKey: core.getInput('gemini_api_key'),
    geminiCliVersion: core.getInput('gemini_cli_version'),
    geminiDebug: core.getInput('gemini_debug'),
    geminiModel: core.getInput('gemini_model'),
    googleApiKey: core.getInput('google_api_key'),
    prompt: core.getInput('prompt'),
    settings: core.getInput('settings'),
    useGeminiCodeAssist: getOptionalBooleanInput('use_gemini_code_assist'),
    useVertexAi: getOptionalBooleanInput('use_vertex_ai'),
    extensions: core.getInput('extensions'),
    uploadArtifacts: getOptionalBooleanInput('upload_artifacts'),
    usePnpm: getOptionalBooleanInput('use_pnpm'),
    workflowName: core.getInput('workflow_name'),
  };
};
