param([switch]$Debug)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot 'build-native.ps1')
Push-Location $projectRoot
try {
    & node --use-system-ca scripts/prepare-runtime.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar runtime.' }
    if ($Debug) { & npm.cmd run desktop:build -- --debug }
    else { & npm.cmd run desktop:build }
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar desktop.' }
} finally { Pop-Location }
