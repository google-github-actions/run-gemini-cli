#!/bin/bash
set -exuo pipefail

# Emit a clear warning in three places without failing the step
warn() {
  local msg="$1"
  echo "WARNING: ${msg}" >&2
  echo "::warning title=Input validation::${msg}"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "### Input validation warnings"
      echo
      echo "- ${msg}"
    } >> "${GITHUB_STEP_SUMMARY}"
  fi
}

# Validate the count of authentication methods
auth_methods=0
if [[ "${INPUT_GEMINI_API_KEY_PRESENT:-false}" == "true" ]]; then ((++auth_methods)); fi
if [[ "${INPUT_GOOGLE_API_KEY_PRESENT:-false}" == "true" ]]; then ((++auth_methods)); fi
if [[ "${INPUT_GCP_WORKLOAD_IDENTITY_PROVIDER_PRESENT:-false}" == "true" ]]; then ((++auth_methods)); fi

if [[ ${auth_methods} -eq 0 ]]; then
  warn "No authentication method provided. Please provide one of 'gemini_api_key', 'google_api_key', or 'gcp_workload_identity_provider'."
fi

if [[ ${auth_methods} -gt 1 ]]; then
  warn "Multiple authentication methods provided. Please use only one of 'gemini_api_key', 'google_api_key', or 'gcp_workload_identity_provider'."
fi

# Validate Workload Identity Federation inputs
if [[ "${INPUT_GCP_WORKLOAD_IDENTITY_PROVIDER_PRESENT:-false}" == "true" ]]; then
  if [[ "${INPUT_GCP_PROJECT_ID_PRESENT:-false}" != "true" ]]; then
    warn "When using Workload Identity Federation ('gcp_workload_identity_provider'), you must also provide 'gcp_project_id'."
  fi
  # Service account is required when using token_format (default behavior)
  # Only optional when explicitly set to empty for direct WIF
  if [[ "${INPUT_GCP_TOKEN_FORMAT}" != "" && "${INPUT_GCP_SERVICE_ACCOUNT_PRESENT:-false}" != "true" ]]; then
    warn "When using Workload Identity Federation with token generation ('gcp_token_format'), you must also provide 'gcp_service_account'. To use direct WIF without a service account, explicitly set 'gcp_token_format' to an empty string."
  fi
  if [[ "${INPUT_USE_VERTEX_AI:-false}" == "${INPUT_USE_GEMINI_CODE_ASSIST:-false}" ]]; then
    warn "When using Workload Identity Federation, you must set exactly one of 'use_vertex_ai' or 'use_gemini_code_assist' to 'true'."
  fi
fi

# Validate Vertex AI API Key
if [[ "${INPUT_GOOGLE_API_KEY_PRESENT:-false}" == "true" ]]; then
  if [[ "${INPUT_USE_VERTEX_AI:-false}" != "true" ]]; then
    warn "When using 'google_api_key', you must set 'use_vertex_ai' to 'true'."
  fi
  if [[ "${INPUT_USE_GEMINI_CODE_ASSIST:-false}" == "true" ]]; then
    warn "When using 'google_api_key', 'use_gemini_code_assist' cannot be 'true'."
  fi
fi

# Validate Gemini API Key
if [[ "${INPUT_GEMINI_API_KEY_PRESENT:-false}" == "true" ]]; then
  if [[ "${INPUT_USE_VERTEX_AI:-false}" == "true" || "${INPUT_USE_GEMINI_CODE_ASSIST:-false}" == "true" ]]; then
    warn "When using 'gemini_api_key', both 'use_vertex_ai' and 'use_gemini_code_assist' must be 'false'."
  fi
fi
