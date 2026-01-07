#!/bin/bash
set -euo pipefail

VERSION_INPUT="${GEMINI_CLI_VERSION:-latest}"

if [[ "${VERSION_INPUT}" == "latest" || "${VERSION_INPUT}" == "preview" || "${VERSION_INPUT}" == "nightly" || "${VERSION_INPUT}" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9\.-]+)?(\+[a-zA-Z0-9\.-]+)?$ ]]; then
  echo "Installing Gemini CLI from npm: @google/gemini-cli@${VERSION_INPUT}"
  if [[ "${USE_PNPM}" == "true" ]]; then
    pnpm add --silent --global @google/gemini-cli@"${VERSION_INPUT}"
  else
    npm install --silent --no-audit --prefer-offline --global @google/gemini-cli@"${VERSION_INPUT}"
  fi
else
  echo "Installing Gemini CLI from GitHub: github:google-gemini/gemini-cli#${VERSION_INPUT}"
  git clone https://github.com/google-gemini/gemini-cli.git
  cd gemini-cli
  git checkout "${VERSION_INPUT}"
  npm install
  npm run bundle
  npm install --silent --no-audit --prefer-offline --global .
fi
echo "Verifying installation:"
if command -v gemini >/dev/null 2>&1; then
  gemini --version || echo "Gemini CLI installed successfully (version command not available)"
else
  echo "Error: Gemini CLI not found in PATH"
  exit 1
fi
if [[ -n "${EXTENSIONS}" ]]; then
  echo "Installing Gemini CLI extensions:"
  echo "${EXTENSIONS}" | jq -r '.[]' | while IFS= read -r extension; do
    extension=$(echo "${extension}" | xargs)
    if [[ -n "${extension}" ]]; then
      echo "Installing ${extension}..."
      echo "Y" | gemini extensions install "${extension}"
    fi
  done
fi
