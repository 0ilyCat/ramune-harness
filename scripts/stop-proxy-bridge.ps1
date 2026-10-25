$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskPidFile = Join-Path $taskRoot '.ramune/proxy-bridge.pid'
if (!(Test-Path -LiteralPath $taskPidFile)) { Write-Output '没有本应用的转发进程'; exit 0 }
$taskPid = [int](Get-Content -LiteralPath $taskPidFile)
$taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskPid"
if (!$taskProcess) { Write-Output '转发进程已停止'; exit 0 }
if (!$taskProcess.CommandLine.Contains((Join-Path $taskRoot 'scripts/proxy-bridge.mjs'))) { throw '进程身份不匹配，不停止' }
Stop-Process -Id $taskPid
Write-Output '已停止本应用的 TCP 转发；原 CLI Proxy 保持运行。'
