param([string]$Distribution = 'Ubuntu-24.04', [int]$Port = 18317)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskRoute = & wsl -d $Distribution --exec ip route show default
$taskAddress = & wsl -d $Distribution --exec hostname -I
if (($taskRoute -join ' ') -notmatch 'default via (\d+\.\d+\.\d+\.\d+)') { throw '无法识别 WSL 宿主地址' }
$taskGateway = $Matches[1]
if (($taskAddress -join ' ') -notmatch '(\d+\.\d+\.\d+\.\d+)') { throw '无法识别 WSL 客户端地址' }
$taskClient = $Matches[1]
$taskData = Join-Path $taskRoot '.ramune'
New-Item -ItemType Directory -Force -Path $taskData | Out-Null
$taskPidFile = Join-Path $taskData 'proxy-bridge.pid'
$taskEntry = Join-Path $taskRoot 'scripts/proxy-bridge.mjs'
$taskStateFile = Join-Path $taskData 'proxy-bridge.json'
$taskListener = Get-NetTCPConnection -LocalPort $Port -LocalAddress $taskGateway -State Listen -ErrorAction SilentlyContinue
if ($taskListener) {
  if (!(Test-Path -LiteralPath $taskPidFile)) { throw '转发端口被其他程序占用' }
  $taskExistingPid = [int](Get-Content -LiteralPath $taskPidFile)
  $taskExistingProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskExistingPid"
  if ($taskListener.OwningProcess -ne $taskExistingPid -or !$taskExistingProcess.CommandLine.Contains($taskEntry)) { throw '转发端口属于其他程序，不修改' }
  if (Test-Path -LiteralPath $taskStateFile) {
    $taskState = Get-Content -LiteralPath $taskStateFile | ConvertFrom-Json
    if ($taskState.client -eq $taskClient) { Write-Output "WSL 转发已运行：http://${taskGateway}:$Port"; exit 0 }
  }
}
if (Test-Path -LiteralPath $taskPidFile) { & (Join-Path $PSScriptRoot 'stop-proxy-bridge.ps1') }
$taskProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @(('"' + $taskEntry + '"'), $taskGateway, $taskClient, "$Port") -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskData 'proxy-bridge.stdout.log') -RedirectStandardError (Join-Path $taskData 'proxy-bridge.stderr.log') -PassThru
Set-Content -LiteralPath $taskPidFile -Value $taskProcess.Id
@{ host = $taskGateway; client = $taskClient; port = $Port } | ConvertTo-Json | Set-Content -LiteralPath $taskStateFile
Start-Sleep -Milliseconds 500
if ($taskProcess.HasExited) { throw '转发进程启动失败，请检查私有日志' }
Write-Output "已复用 Windows CLI Proxy：http://${taskGateway}:$Port（PID $($taskProcess.Id)）；没有创建另一份 CLI Proxy。"
