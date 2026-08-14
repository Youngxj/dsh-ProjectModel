<#
.SYNOPSIS
  Restart the DeepSeek Harness web service (activate plugins after install/update).
.DESCRIPTION
  Locates the node process listening on the given port, stops it, waits for the
  port to release, starts "dsh web" in the background (logs written to
  dsh-restart.out.log / dsh-restart.err.log), then verifies the endpoint.
.PARAMETER Port
  Listening port; defaults to 3080.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File restart.ps1
#>
param(
  [int]$Port = 3080
)

$ErrorActionPreference = 'Stop'
$logOut = Join-Path $PSScriptRoot 'dsh-restart.out.log'
$logErr = Join-Path $PSScriptRoot 'dsh-restart.err.log'
$nodeExe = (Get-Command node).Source
if (-not $nodeExe) { throw 'node.exe not found on PATH' }

# Locate the dsh install: resolve a bundle from the web profile
$profileDir = Join-Path $env:USERPROFILE (Join-Path '.dsh' (Join-Path 'profiles' 'web'))
$profileCwd = $profileDir -replace '\\', '/'
$dshBin = (& node -e "const {createRequire}=require('module');const r=createRequire('$profileCwd/cordis.yml');try{const p=r.resolve('@deepseek-ai/dsh/package.json');console.log(require('path').join(require('path').dirname(p),'lib','bin.js'))}catch(e){console.log('')}") | Out-String
$dshBin = $dshBin.Trim()
if (-not $dshBin -or -not (Test-Path $dshBin)) { throw "cannot locate the dsh install (resolved: $dshBin)" }

Write-Host "==> locating the process listening on port $Port..."
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  $listenerPid = $conn.OwningProcess
  $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -eq 'node') {
    Write-Host "  found node PID $listenerPid; stopping in 3 seconds (let the session settle)..."
    Start-Sleep -Seconds 3
    Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    if (-not $proc.HasExited) { taskkill /PID $listenerPid /T /F | Out-Null }
  } else {
    throw "port $Port is held by a non-node process (PID=$listenerPid); refusing to kill it."
  }
} else {
  Write-Host "  no listener on port $Port; starting directly."
}

Write-Host '==> waiting for the port to release...'
$deadline = (Get-Date).AddSeconds(30)
while ((Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw 'port did not release; aborting.' }

Write-Host '==> starting dsh web (background)...'
if (Test-Path $logOut) { Remove-Item $logOut -Force -ErrorAction SilentlyContinue }
if (Test-Path $logErr) { Remove-Item $logErr -Force -ErrorAction SilentlyContinue }
$new = Start-Process -FilePath $nodeExe `
  -ArgumentList @($dshBin, 'web') `
  -WorkingDirectory $HOME `
  -WindowStyle Hidden `
  -RedirectStandardOutput $logOut `
  -RedirectStandardError $logErr `
  -PassThru
Write-Host "  started, new PID: $($new.Id)"

Write-Host '==> waiting for the service and verifying the project-groups endpoint...'
$ready = $false
$deadline = (Get-Date).AddSeconds(60)
while (-not $ready -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/project-groups" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $ready = $true }
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode -eq 404) { $ready = $true }
  }
}
if ($ready) {
  Write-Host "OK: dsh web restarted; /api/project-groups is reachable. Refresh the browser page (Ctrl+F5)."
} else {
  Write-Host "WARN: service not ready within 60s. Check $logErr, or start manually:"
  Write-Host "  & '$nodeExe' '$dshBin' web"
}
