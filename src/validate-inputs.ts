/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as core from '@actions/core';
import { geminiCliActionsInputs } from './inputs';

export const validateInputs = () => {
  try {
    const {
      geminiApiKey,
      googleApiKey,
      gcpWorkloadIdentityProvider,
      gcpProjectId,
      gcpServiceAccount,
      gcpTokenFormat,
      useVertexAi,
      useGeminiCodeAssist,
    } = geminiCliActionsInputs();

    const warn = (msg: string) => {
      core.warning(msg, { title: 'Input validation' });
      core.summary
        .addHeading('Input validation warnings', 3)
        .addList([msg])
        .write();
    };

    let authMethods = 0;
    if (geminiApiKey) authMethods++;
    if (googleApiKey) authMethods++;
    if (gcpWorkloadIdentityProvider) authMethods++;

    if (authMethods === 0) {
      warn(
        "No authentication method provided. Please provide one of 'gemini_api_key', 'google_api_key', or 'gcp_workload_identity_provider'.",
      );
    }

    if (authMethods > 1) {
      warn(
        "Multiple authentication methods provided. Please use only one of 'gemini_api_key', 'google_api_key', or 'gcp_workload_identity_provider'.",
      );
    }

    if (gcpWorkloadIdentityProvider) {
      if (!gcpProjectId) {
        warn(
          "When using Workload Identity Federation ('gcp_workload_identity_provider'), you must also provide 'gcp_project_id'.",
        );
      }

      if (gcpTokenFormat && !gcpServiceAccount) {
        warn(
          "When using Workload Identity Federation with token generation ('gcp_token_format'), you must also provide 'gcp_service_account'. To use direct WIF without a service account, explicitly set 'gcp_token_format' to an empty string.",
        );
      }

      if (useVertexAi === useGeminiCodeAssist) {
        warn(
          "When using Workload Identity Federation, you must set exactly one of 'use_vertex_ai' or 'use_gemini_code_assist' to 'true'.",
        );
      }
    }

    if (googleApiKey) {
      if (!useVertexAi) {
        warn(
          "When using 'google_api_key', you must set 'use_vertex_ai' to 'true'.",
        );
      }
      if (useGeminiCodeAssist) {
        warn(
          "When using 'google_api_key', 'use_gemini_code_assist' cannot be 'true'.",
        );
      }
    }

    if (geminiApiKey) {
      if (useVertexAi || useGeminiCodeAssist) {
        warn(
          "When using 'gemini_api_key', both 'use_vertex_ai' and 'use_gemini_code_assist' must be 'false'.",
        );
      }
    }
  } catch (error) {
    core.setFailed(`Input validation failed: ${error}`);
  }
};

/* v8 ignore if -- @preserve */
if (require.main === module) {
  validateInputs();
}
