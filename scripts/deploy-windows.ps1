param([int]$Port = 4317)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $taskRoot
$taskData = Join-Path $taskRoot '.ramune'
New-Item -ItemType Directory -Force -Path $taskData | Out-Null
$taskPidFile = Join-Path $taskData "windows-$Port.pid"
$taskConnection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($taskConnection) {
    try {
        $taskHealth = Invoke-RestMethod "http://127.0.0.1:$Port/api/health"
        if ($taskHealth.name -eq 'Ramune Harness') { Write-Output "Ramune Harness 已运行：http://127.0.0.1:$Port"; exit 0 }
    } catch {}
    throw "端口 $Port 已被占用；不停止其他进程。"
}
if (!(Test-Path -LiteralPath (Join-Path $taskRoot 'dist/server/index.js'))) { throw '请先执行 npm run build' }
$env:PORT = "$Port"
$env:RAMUNE_DATA_DIR = $taskData
$taskEntry = Join-Path $taskRoot 'dist/server/index.js'
$taskProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList ('"' + $taskEntry + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskData "windows-$Port.stdout.log") -RedirectStandardError (Join-Path $taskData "windows-$Port.stderr.log") -PassThru
Set-Content -LiteralPath $taskPidFile -Value $taskProcess.Id
for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
    Start-Sleep -Milliseconds 500
    if ($taskProcess.HasExited) { throw '服务启动失败，请检查 .ramune 中的日志' }
    try { $taskHealth = Invoke-RestMethod "http://127.0.0.1:$Port/api/health"; if ($taskHealth.status -eq 'ok') { Write-Output "Ramune Harness 已部署：http://127.0.0.1:$Port（PID $($taskProcess.Id)）"; exit 0 } } catch {}
}
throw '服务健康检查超时'
