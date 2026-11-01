#!/usr/bin/env bash
set -euo pipefail
taskRoot="$HOME/.local/share/ramune-harness-qa-20261101"
test -f "$taskRoot/openclaw-qa.json"
mkdir -p "$taskRoot/app" "$taskRoot/data" "$taskRoot/evidence" "$HOME/.config/systemd/user"
touch "$taskRoot/.ramune-managed"
tar -C "$taskRoot/app" -xf /tmp/ramune-harness-qa-20261101.tar
cd "$taskRoot/app"
export NO_PROXY=localhost,127.0.0.1,::1
export HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890
npm ci
npm run build
taskNode="$(command -v node)"
cat >"$HOME/.config/systemd/user/ramune-harness-qa-20261101.service" <<EOF
[Unit]
Description=Ramune Harness 五轮验收隔离服务
[Service]
Type=simple
WorkingDirectory=$taskRoot/app
Environment=PORT=4321
Environment=RAMUNE_DATA_DIR=$taskRoot/data
Environment=RAMUNE_OPENCLAW_CONFIG_FILE=$taskRoot/openclaw-qa.json
Environment=NO_PROXY=localhost,127.0.0.1,::1
Environment=HTTP_PROXY=http://127.0.0.1:7890
Environment=HTTPS_PROXY=http://127.0.0.1:7890
ExecStart=$taskNode $taskRoot/app/dist/server/index.js
Restart=on-failure
KillMode=control-group
TimeoutStopSec=15
StandardOutput=append:$taskRoot/evidence/server.stdout.log
StandardError=append:$taskRoot/evidence/server.stderr.log
EOF
systemctl --user daemon-reload
systemctl --user restart ramune-harness-qa-20261101.service
for taskAttempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4321/api/health; then echo; break; fi
  sleep 1
done
RAMUNE_URL=http://127.0.0.1:4321 RAMUNE_EVIDENCE_DIR="$taskRoot/evidence" node scripts/openclaw-five-rounds.mjs
