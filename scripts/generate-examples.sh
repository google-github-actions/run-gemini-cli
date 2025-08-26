#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

WORKFLOWS_DIR="${REPO_ROOT}/.github/workflows"
EXAMPLES_DIR="${REPO_ROOT}/examples/workflows"

for workflow_file in "${WORKFLOWS_DIR}"/*.yml; do
  workflow_name="$(basename "${workflow_file}")"
  example_dir=""
  example_filename=""

  # Add case for each file that should exist in /examples/
  case "${workflow_name}" in
    "gemini-invoke.yml")
      example_dir="${EXAMPLES_DIR}/gemini-assistant"
      example_filename="gemini-invoke.yml"
      ;; 
    "gemini-triage.yml")
      example_dir="${EXAMPLES_DIR}/issue-triage"
      example_filename="gemini-triage.yml"
      ;; 
    "gemini-scheduled-triage.yml")
      example_dir="${EXAMPLES_DIR}/issue-triage"
      example_filename="gemini-scheduled-triage.yml"
      ;; 
    "gemini-review.yml")
      example_dir="${EXAMPLES_DIR}/pr-review"
      example_filename="gemini-review.yml"
      ;; 
    *)
      echo "Skipping ${workflow_name}"
      continue
      ;; 
  esac

  example_file="${example_dir}/${example_filename}"
  echo "Generating ${example_file}"

  # Update lines that are different in the /examples/, such as the version of the action
  sed \
    -e "s|uses: 'google-github-actions/run-gemini-cli@main'|uses: 'google-github-actions/run-gemini-cli@v0'|g" \
    "${workflow_file}" > "${example_file}"
done