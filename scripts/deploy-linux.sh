#!/usr/bin/env bash
set -euo pipefail
taskSource="$(cd "$(dirname "$0")/.." && pwd)"
taskBase="${RAMUNE_INSTALL_DIR:-$HOME/.local/share/ramune-harness}"
taskPort="${PORT:-4318}"
if [[ -d "$taskBase" && ! -f "$taskBase/.ramune-managed" ]]; then
  echo '目标目录已存在且不属于 Ramune，不覆盖。' >&2; exit 1
fi
mkdir -p "$taskBase/app" "$taskBase/data" "$taskBase/logs"
touch "$taskBase/.ramune-managed"
taskNodeBin="${RAMUNE_NODE_BIN:-}"
if [[ -z "$taskNodeBin" ]]; then
  for taskCandidate in "$HOME"/.nvm/versions/node/v24*/bin; do
    if [[ -x "$taskCandidate/node" ]]; then taskNodeBin="$taskCandidate"; fi
  done
fi
if [[ -n "$taskNodeBin" ]]; then export PATH="$taskNodeBin:$PATH"; fi
command -v node >/dev/null
node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)'
if curl -fsS "http://127.0.0.1:$taskPort/api/health" >/dev/null 2>&1; then
  echo "端口 $taskPort 已有服务，请先使用已有服务或明确停止后重新部署。"; exit 1
fi
tar -C "$taskSource" --exclude=.git --exclude=node_modules --exclude=.ramune --exclude=dist --exclude=test-results --exclude=playwright-report --exclude='*.log' -cf - . | tar -C "$taskBase/app" -xf -
cd "$taskBase/app"
npm ci
npm run build
taskUnit="$HOME/.config/systemd/user/ramune-harness.service"
mkdir -p "$(dirname "$taskUnit")"
if [[ -f "$taskUnit" ]] && ! grep -q 'Ramune-managed' "$taskUnit"; then echo '已有同名服务，不覆盖。' >&2; exit 1; fi
cat >"$taskBase/start.sh" <<EOF
#!/usr/bin/env bash
export PATH="$taskNodeBin:/usr/local/bin:/usr/bin:/bin:\$HOME/.local/bin"
export PORT="$taskPort" RAMUNE_DATA_DIR="$taskBase/data"
if [[ -f "$taskBase/data/claude-settings.json" ]]; then export RAMUNE_CLAUDE_SETTINGS_FILE="$taskBase/data/claude-settings.json"; fi
cd "$taskBase/app"
exec "$taskNodeBin/node" dist/server/index.js
EOF
cat >"$taskUnit" <<EOF
# Ramune-managed
[Unit]
Description=Ramune Harness 本地编排服务
After=network.target
[Service]
Type=simple
ExecStart=/bin/bash -l "$taskBase/start.sh"
Restart=on-failure
RestartSec=3
KillMode=control-group
TimeoutStopSec=12
StandardOutput=append:$taskBase/logs/stdout.log
StandardError=append:$taskBase/logs/stderr.log
[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now ramune-harness.service
taskPid="$(systemctl --user show ramune-harness.service -p MainPID --value)"
echo "$taskPid" >"$taskBase/service.pid"
for taskAttempt in $(seq 1 40); do
  if ! systemctl --user is-active --quiet ramune-harness.service; then cat "$taskBase/logs/stderr.log"; exit 1; fi
  if curl -fsS "http://127.0.0.1:$taskPort/api/health"; then echo; echo "Ramune Harness 已部署：http://127.0.0.1:$taskPort（PID $taskPid）"; exit 0; fi
  sleep .5
done
echo '服务健康检查超时' >&2; exit 1
