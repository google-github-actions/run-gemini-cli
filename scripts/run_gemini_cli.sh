#!/bin/bash
set -euo pipefail

# Create a temporary directory for storing the output, and ensure it's
# cleaned up later
TEMP_STDOUT="$(mktemp -p "${RUNNER_TEMP}" gemini-out.XXXXXXXXXX)"
TEMP_STDERR="$(mktemp -p "${RUNNER_TEMP}" gemini-err.XXXXXXXXXX)"
function cleanup {
  rm -f "${TEMP_STDOUT}" "${TEMP_STDERR}"
}
trap cleanup EXIT

# Keep track of whether we've failed
FAILED=false

# Run Gemini CLI with the provided prompt, using JSON output format
# We capture stdout (JSON) to TEMP_STDOUT and stderr to TEMP_STDERR
if [[ "${GEMINI_DEBUG}" = true ]]; then
  echo "::warning::Gemini CLI debug logging is enabled. This will stream responses, which could reveal sensitive information if processed with untrusted inputs."
  echo "::: Start Gemini CLI STDOUT :::"
  if ! gemini --debug --yolo --prompt "${PROMPT}" --output-format json 2> >(tee "${TEMP_STDERR}" >&2) | tee "${TEMP_STDOUT}"; then
    FAILED=true
  fi
  # Wait for async stderr logging to complete. This is because process substitution in Bash is async so let tee finish writing to ${TEMP_STDERR}
  sleep 1
  echo "::: End Gemini CLI STDOUT :::"
else
  if ! gemini --yolo --prompt "${PROMPT}" --output-format json 2> "${TEMP_STDERR}" 1> "${TEMP_STDOUT}"; then
    FAILED=true
  fi
fi

# Create the artifacts directory and copy full logs
mkdir -p gemini-artifacts
cp "${TEMP_STDOUT}" gemini-artifacts/stdout.log
cp "${TEMP_STDERR}" gemini-artifacts/stderr.log
if [[ -f .gemini/telemetry.log ]]; then
  cp .gemini/telemetry.log gemini-artifacts/telemetry.log
else
  # Create an empty file so the artifact upload doesn't fail if telemetry is missing
  touch gemini-artifacts/telemetry.log
fi

# Parse JSON output to extract response and errors
# If output is not valid JSON, RESPONSE will be empty and we'll rely on stderr for errors
RESPONSE=""
ERROR_JSON=""
if jq -e . "${TEMP_STDOUT}" >/dev/null 2>&1; then
   RESPONSE=$(jq -r '.response // ""' "${TEMP_STDOUT}")
fi
if jq -e . "${TEMP_STDERR}" >/dev/null 2>&1; then
   ERROR_JSON=$(jq -c '.error // empty' "${TEMP_STDERR}")
fi

if { [[ -s "${TEMP_STDERR}" ]] && ! jq -e . "${TEMP_STDERR}" >/dev/null 2>&1; }; then
  echo "::warning::Gemini CLI stderr was not valid JSON"
fi

if { [[ -s "${TEMP_STDOUT}" ]] && ! jq -e . "${TEMP_STDOUT}" >/dev/null 2>&1; }; then
  echo "::warning::Gemini CLI stdout was not valid JSON"
fi


# Set the captured response and errors as step outputs
{
  echo "gemini_response<<EOF"
  if [[ -n "${RESPONSE}" ]]; then
    echo "${RESPONSE}"
  else
    cat "${TEMP_STDOUT}"
  fi
  echo "EOF"
  echo "gemini_errors<<EOF"
  if [[ -n "${ERROR_JSON}" ]]; then
    echo "${ERROR_JSON}"
  else
    cat "${TEMP_STDERR}"
  fi
  echo "EOF"
} >> "${GITHUB_OUTPUT}"

# Generate Job Summary
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### Gemini CLI Execution"
    echo
    echo "#### Prompt"
    echo
    echo "\`\`\`"
    echo "${PROMPT}"
    echo "\`\`\`"
    echo
    if [[ -n "${RESPONSE}" ]]; then
       echo "#### Response"
       echo
       echo "${RESPONSE}"
       echo
    fi
    if [[ -n "${ERROR_JSON}" ]]; then
       echo "#### Error"
       echo
       echo "\`\`\`json"
       echo "${ERROR_JSON}"
       echo "\`\`\`"
       echo
    elif [[ "${FAILED}" == "true" ]]; then
       echo "#### Error Output"
       echo
       echo "\`\`\`"
       cat "${TEMP_STDERR}"
       echo "\`\`\`"
       echo
    fi
  } >> "${GITHUB_STEP_SUMMARY}"
fi

if [[ "${FAILED}" = true ]]; then
  # If we have a structured error from JSON, use it for the error message
  if [[ -n "${ERROR_JSON}" ]]; then
     ERROR_MSG=$(jq -r '.message // .' <<< "${ERROR_JSON}")
     echo "::error title=Gemini CLI execution failed::${ERROR_MSG}"
  fi
  echo "::: Start Gemini CLI STDERR :::"
  cat "${TEMP_STDERR}"
  echo "::: End Gemini CLI STDERR :::"
  exit 1
fi
