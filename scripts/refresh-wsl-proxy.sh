#!/usr/bin/env bash
set -euo pipefail
taskScriptDir="$(cd "$(dirname "$0")" && pwd)"
taskSettings="$HOME/.local/share/ramune-harness/data/claude-settings.json"
for taskCandidate in "$HOME"/.nvm/versions/node/v24*/bin; do
  if [[ -x "$taskCandidate/node" ]]; then export PATH="$taskCandidate:$PATH"; fi
done
node "$taskScriptDir/refresh-proxy-address.mjs" "$taskSettings" "$1"
