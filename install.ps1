<#
.SYNOPSIS
  Install dsh-project-groups plugin into a dsh profile.
.DESCRIPTION
  1. Copy plugin files to $DSH_HOME/profiles/<profile>/plugins/dsh-project-groups/
  2. Create two directory junctions: profile side (client module table)
     and install side (host loader bare-name resolution)
  3. Idempotently append the plugin row to cordis.patch.yml
  4. Print restart and verification steps
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install.ps1
  powershell -ExecutionPolicy Bypass -File install.ps1 -DshHome D:\mydsh -ProfileName web
#>
param(
  [string]$DshHome = "$env:USERPROFILE\.dsh",
  [string]$ProfileName = "web"
)

$ErrorActionPreference = 'Stop'
$pluginName = 'dsh-project-groups'
$profileDir = Join-Path $DshHome (Join-Path 'profiles' $ProfileName)
$pluginTarget = Join-Path $profileDir (Join-Path 'plugins' $pluginName)
$patchFile = Join-Path $profileDir 'cordis.patch.yml'
$profileModules = Join-Path $DshHome (Join-Path 'profiles' 'node_modules')

Write-Host "==> profile: $profileDir"
if (-not (Test-Path $profileDir)) { throw "profile directory not found: $profileDir (run 'dsh --profile $ProfileName' once first)" }

# ---- 1. copy plugin files -------------------------------------------------
Write-Host '==> [1/4] copying plugin files...'
New-Item -ItemType Directory -Force -Path (Join-Path $pluginTarget 'lib') | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'package.json') $pluginTarget -Force
Copy-Item (Join-Path $PSScriptRoot 'lib') $pluginTarget -Recurse -Force

# ---- 2. directory junctions ----------------------------------------------
Write-Host '==> [2/4] creating directory junctions...'
New-Item -ItemType Directory -Force -Path $profileModules | Out-Null
$link1 = Join-Path $profileModules $pluginName
if (Test-Path $link1) { Remove-Item $link1 -Force -Recurse }
New-Item -ItemType Junction -Path $link1 -Target $pluginTarget | Out-Null
Write-Host "    profile-side link created: $link1"

# Resolve the dsh install root from the profile (bundles resolve there)
$profileCwd = $profileDir -replace '\\', '/'
$installRoot = (& node -e "const {createRequire}=require('module');const r=createRequire('$profileCwd/cordis.yml');try{const p=r.resolve('@deepseek-ai/dsh-base/package.json');const i=p.indexOf('node_modules');console.log(i>0?p.substring(0,i+12):'')}catch(e){console.log('')}") | Out-String
$installRoot = $installRoot.Trim()
if ($installRoot -and (Test-Path $installRoot)) {
  $link2 = Join-Path $installRoot $pluginName
  if (Test-Path $link2) { Remove-Item $link2 -Force -Recurse }
  try {
    New-Item -ItemType Junction -Path $link2 -Target $pluginTarget | Out-Null
    Write-Host "    install-side link created: $link2"
  } catch {
    Write-Warning "install-side junction failed (may need an elevated shell): $link2"
    Write-Warning "Run manually as administrator: New-Item -ItemType Junction -Path '$link2' -Target '$pluginTarget'"
  }
} else {
  Write-Warning 'Could not locate the dsh install (node_modules). The host half (API/tool) will NOT load without the install-side link.'
  Write-Warning 'Find the install root from the profile dir with: node -e "const {createRequire}=require(\"module\");console.log(createRequire(process.cwd()+\"/cordis.yml\").resolve(\"@deepseek-ai/dsh-base/package.json\"))"'
}

# ---- 3. register the plugin row -------------------------------------------
Write-Host '==> [3/4] registering plugin row in cordis.patch.yml...'
$content = if (Test-Path $patchFile) { Get-Content $patchFile -Raw -Encoding UTF8 } else { '' }
if ($content -match 'project-groups') {
  Write-Host '    cordis.patch.yml already contains the plugin row; skipped.'
} else {
  $addition = @'

# ---- user-installed: dsh-project-groups ----
- insert:
    - id: project-groups
      name: dsh-project-groups
'@
  Add-Content -Path $patchFile -Value $addition -Encoding UTF8
  Write-Host '    plugin row appended.'
}

# ---- 4. next steps ---------------------------------------------------------
Write-Host '==> [4/4] install finished. Next steps:'
Write-Host '  1. Restart dsh (Ctrl+C in the dsh terminal, then run "dsh web" again; or run restart.ps1 from this repo)'
Write-Host '  2. Refresh the browser page (Ctrl+F5)'
Write-Host '  3. Verify: open http://127.0.0.1:3080/api/project-groups - it should return JSON; the Settings page gains a "project-groups" section'
