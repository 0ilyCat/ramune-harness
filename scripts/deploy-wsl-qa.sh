#!/usr/bin/env bash
set -euo pipefail
taskSource="$1"
taskBase="$HOME/.local/share/ramune-harness-final-qa-20261101"
if [[ -d "$taskBase" && ! -f "$taskBase/.ramune-managed" ]]; then echo '已有其他目录，不覆盖' >&2; exit 1; fi
mkdir -p "$taskBase/app" "$taskBase/data"
touch "$taskBase/.ramune-managed"
for taskCandidate in "$HOME"/.nvm/versions/node/v24*/bin; do
  if [[ -x "$taskCandidate/node" ]]; then export PATH="$taskCandidate:$PATH"; fi
done
tar -C "$taskSource" --exclude=.git --exclude=node_modules --exclude=.ramune --exclude=dist --exclude=test-results --exclude=playwright-report --exclude='*.log' -cf - . | tar -C "$taskBase/app" -xf -
cd "$taskBase/app"
npm ci
npm run build
if [[ -f "$HOME/.local/share/ramune-harness/data/claude-settings.json" ]]; then
  node scripts/copy-proxy-profile.mjs "$HOME/.local/share/ramune-harness/data/claude-settings.json" "$taskBase/claude-settings.json" "$2" gemini-3.8-flash-high
  export RAMUNE_CLAUDE_SETTINGS_FILE="$taskBase/claude-settings.json"
fi
echo "$$" >"$taskBase/server.pid"
export PORT=4323 RAMUNE_DATA_DIR="$taskBase/data" NO_PROXY=localhost,127.0.0.1,::1
exec "$(command -v node)" "$taskBase/app/dist/server/index.js"
