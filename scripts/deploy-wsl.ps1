param([string]$Distribution = 'Ubuntu-24.04')
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskLinuxPath = (& wsl -d $Distribution -- wslpath -a ($taskRoot.Replace('\','/'))).Trim()
if ($LASTEXITCODE -ne 0) { throw '无法转换 WSL 路径' }
$taskLinuxHome = (& wsl -d $Distribution --exec printenv HOME).Trim()
& wsl -d $Distribution --exec test -f "$taskLinuxHome/.local/share/ramune-harness/data/claude-settings.json"
if ($LASTEXITCODE -eq 0) {
  & (Join-Path $PSScriptRoot 'start-proxy-bridge.ps1') -Distribution $Distribution
  $taskBridge = Get-Content -LiteralPath (Join-Path $taskRoot '.ramune/proxy-bridge.json') | ConvertFrom-Json
  $taskProxyUrl = "http://$($taskBridge.host):$($taskBridge.port)"
  & wsl -d $Distribution --exec /bin/bash "$taskLinuxPath/scripts/refresh-wsl-proxy.sh" $taskProxyUrl
  if ($LASTEXITCODE -ne 0) { throw '更新本应用代理地址失败' }
}
& wsl -d $Distribution -- bash "$taskLinuxPath/scripts/deploy-linux.sh"
if ($LASTEXITCODE -ne 0) { throw 'WSL 部署失败，查看上面的 Linux 输出' }
$taskData = Join-Path $taskRoot '.ramune'
New-Item -ItemType Directory -Force -Path $taskData | Out-Null
# WSL 可能在最后一个调用退出后终止；复用此应用已有的隐藏保活会话。
$taskPidFile = Join-Path $taskData 'wsl-keeper.pid'
if (Test-Path -LiteralPath $taskPidFile) {
  $taskKeeperPid = [int](Get-Content -LiteralPath $taskPidFile)
  $taskExisting = Get-CimInstance Win32_Process -Filter "ProcessId=$taskKeeperPid"
  if ($taskExisting -and $taskExisting.Name -eq 'wsl.exe' -and $taskExisting.CommandLine.Contains('/bin/sleep infinity') -and $taskExisting.CommandLine.Contains($Distribution)) { Write-Output "WSL 保活会话已存在（PID $taskKeeperPid）。"; exit 0 }
}
$taskKeeper = Start-Process -FilePath (Get-Command wsl).Source -ArgumentList @('-d', $Distribution, '--exec', '/bin/sleep', 'infinity') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskData 'wsl-keeper.stdout.log') -RedirectStandardError (Join-Path $taskData 'wsl-keeper.stderr.log') -PassThru
Set-Content -LiteralPath $taskPidFile -Value $taskKeeper.Id
Write-Output "WSL 保活会话已启动（PID $($taskKeeper.Id)）。"
