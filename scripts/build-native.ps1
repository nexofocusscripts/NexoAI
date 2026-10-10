param([switch]$PrepareOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (!(Test-Path -LiteralPath $vswhere)) { throw 'Instala Visual Studio Build Tools com C++ e Windows SDK.' }
$visualStudio = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$visualStudio) { throw 'Não foi encontrada uma instalação com ferramentas C++ x64.' }
$msvcRoot = (Get-ChildItem (Join-Path $visualStudio 'VC\Tools\MSVC') -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
$sdkRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10'
$sdkVersion = (Get-ChildItem (Join-Path $sdkRoot 'Lib') -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'um\x64\kernel32.lib') } | Sort-Object Name -Descending | Select-Object -First 1).Name
if (!$sdkVersion) { throw 'Windows SDK x64 não encontrado.' }
$env:PATH = "$msvcRoot\bin\Hostx64\x64;$sdkRoot\bin\$sdkVersion\x64;$env:PATH"
$env:LIB = "$msvcRoot\lib\x64;$sdkRoot\Lib\$sdkVersion\um\x64;$sdkRoot\Lib\$sdkVersion\ucrt\x64"
$env:INCLUDE = "$msvcRoot\include;$sdkRoot\Include\$sdkVersion\um;$sdkRoot\Include\$sdkVersion\ucrt;$sdkRoot\Include\$sdkVersion\shared"
if ($PrepareOnly) { return }
Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Path 'src-tauri/resources' -Force | Out-Null
    foreach ($helper in @('sandbox', 'vault', 'signature', 'updater')) {
        & cl.exe /nologo /std:c++17 /EHsc /O2 /MT /GS /guard:cf "native/$helper.cpp" "/Fosrc-tauri/resources/$helper.obj" "/Fesrc-tauri/resources/nexo-$helper.exe" /link /DYNAMICBASE /NXCOMPAT /HIGHENTROPYVA /guard:cf
        if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar $helper." }
    }
} finally { Pop-Location }
