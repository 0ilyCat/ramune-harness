param([string]$Distribution = 'Ubuntu-24.04')
$ErrorActionPreference = 'Stop'
& wsl -d $Distribution -- systemctl --user stop ramune-harness.service
if ($LASTEXITCODE -ne 0) { throw '未能停止 Linux 应用服务' }
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskPidFile = Join-Path $taskRoot '.ramune/wsl-keeper.pid'
if (Test-Path -LiteralPath $taskPidFile) {
  $taskPid = [int](Get-Content -LiteralPath $taskPidFile)
  $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskPid"
  if ($taskProcess -and $taskProcess.Name -eq 'wsl.exe' -and $taskProcess.CommandLine.Contains('/bin/sleep infinity') -and $taskProcess.CommandLine.Contains($Distribution)) { Stop-Process -Id $taskPid }
}
Write-Output 'WSL 中的 Ramune Harness 已停止，未关闭其他 WSL 程序。'
