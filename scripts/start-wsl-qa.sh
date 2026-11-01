#!/usr/bin/env bash
set -euo pipefail
taskBase="$HOME/.local/share/ramune-harness-final-qa-20261101"
test -f "$taskBase/.ramune-managed"
test -f "$taskBase/claude-settings.json"
for taskCandidate in "$HOME"/.nvm/versions/node/v24*/bin; do
  if [[ -x "$taskCandidate/node" ]]; then export PATH="$taskCandidate:$PATH"; fi
done
echo "$$" >"$taskBase/server.pid"
export PORT=4323 RAMUNE_DATA_DIR="$taskBase/data" NO_PROXY=localhost,127.0.0.1,::1
export RAMUNE_CLAUDE_SETTINGS_FILE="$taskBase/claude-settings.json"
exec "$(command -v node)" "$taskBase/app/dist/server/index.js"
