param([int]$Port = 4317)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskPidFile = Join-Path $taskRoot ".ramune/windows-$Port.pid"
if (!(Test-Path -LiteralPath $taskPidFile)) { throw '没有此应用记录的 PID，不停止其他服务' }
$taskPid = [int](Get-Content -LiteralPath $taskPidFile)
$taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskPid"
$taskEntry = Join-Path $taskRoot 'dist/server/index.js'
if (!$taskProcess) { Write-Output '服务已停止'; exit 0 }
if (!$taskProcess.CommandLine.Contains($taskEntry)) { throw 'PID 对应的程序不匹配此工作区，不停止' }
Stop-Process -Id $taskPid
Write-Output "Ramune Harness 已停止（PID $taskPid）。未完成的调用将在下次启动时标记为结果未知。"
