#!/bin/bash
set -euo pipefail

# Auth inputs (as boolean presence flags)
gemini_api_key_present="${INPUT_GEMINI_API_KEY_PRESENT:-false}"
google_api_key_present="${INPUT_GOOGLE_API_KEY_PRESENT:-false}"
gcp_workload_identity_provider_present="${INPUT_GCP_WORKLOAD_IDENTITY_PROVIDER_PRESENT:-false}"
gcp_project_id_present="${INPUT_GCP_PROJECT_ID_PRESENT:-false}"
gcp_service_account_present="${INPUT_GCP_SERVICE_ACCOUNT_PRESENT:-false}"

# Other inputs (values needed)
use_vertex_ai="${INPUT_USE_VERTEX_AI:-false}"
use_gemini_code_assist="${INPUT_USE_GEMINI_CODE_ASSIST:-false}"

# Count number of auth methods
auth_methods=0
if [[ "${gemini_api_key_present}" == "true" ]]; then ((auth_methods++)); fi
if [[ "${google_api_key_present}" == "true" ]]; then ((auth_methods++)); fi
if [[ "${gcp_workload_identity_provider_present}" == "true" ]]; then ((auth_methods++)); fi

if [[ ${auth_methods} -eq 0 ]]; then
  echo "::error::No authentication method provided. Please provide one of 'gemini_api_key', 'google_api_key', or 'gcp_workload_identity_provider'."
  exit 1
fi

if [[ ${auth_methods} -gt 1 ]]; then
  echo "::error::Multiple authentication methods provided. Please use only one of 'gemini_api_key', 'google_api_key', or 'gcp_workload_identity_provider'."
  exit 1
fi

# WIF validation
if [[ "${gcp_workload_identity_provider_present}" == "true" ]]; then
  if [[ "${gcp_project_id_present}" != "true" || "${gcp_service_account_present}" != "true" ]]; then
    echo "::error::When using Workload Identity Federation ('gcp_workload_identity_provider'), you must also provide 'gcp_project_id' and 'gcp_service_account'."
    exit 1
  fi
  if [[ "${use_vertex_ai}" != "true" && "${use_gemini_code_assist}" != "true" ]]; then
    echo "::error::When using Workload Identity Federation, you must set either 'use_vertex_ai' or 'use_gemini_code_assist' to 'true'. Both are set to 'false', please choose one."
    exit 1
  fi
  if [[ "${use_vertex_ai}" == "true" && "${use_gemini_code_assist}" == "true" ]]; then
    echo "::error::When using Workload Identity Federation, 'use_vertex_ai' and 'use_gemini_code_assist' cannot both be 'true'. Both are set to 'true', please choose one."
    exit 1
  fi
fi

# Vertex AI API Key validation
if [[ "${google_api_key_present}" == "true" ]]; then
  if [[ "${use_vertex_ai}" != "true" ]]; then
    echo "::error::When using 'google_api_key', you must set 'use_vertex_ai' to 'true'."
    exit 1
  fi
  if [[ "${use_gemini_code_assist}" == "true" ]]; then
    echo "::error::When using 'google_api_key', 'use_gemini_code_assist' cannot be 'true'."
    exit 1
  fi
fi

# Gemini API Key validation
if [[ "${gemini_api_key_present}" == "true" ]]; then
  if [[ "${use_vertex_ai}" == "true" || "${use_gemini_code_assist}" == "true" ]]; then
    echo "::error::When using 'gemini_api_key', both 'use_vertex_ai' and 'use_gemini_code_assist' must be 'false'."
    exit 1
  fi
fi
