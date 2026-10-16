$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or !$env:RUNNER_TEMP){throw 'Executar apenas no runner Windows descartável.'}
& (Join-Path $PSScriptRoot 'build-native.ps1') -PrepareOnly
$repo=Split-Path $PSScriptRoot -Parent
$fixture=Join-Path $env:RUNNER_TEMP 'nexo-updater-fixture.exe'
& cl.exe /nologo /std:c++17 /EHsc /O2 /MT (Join-Path $repo 'tests/fixtures/updater-fixture.cpp') "/Fo$env:RUNNER_TEMP/nexo-updater-fixture.obj" "/Fe$fixture"
if($LASTEXITCODE -ne 0){throw 'Compilação do instalador simulado falhou.'}
$env:NEXO_UPDATER_TEST_EXE=Join-Path $repo 'src-tauri/resources/nexo-updater.exe'
$env:NEXO_UPDATER_FIXTURE_EXE=$fixture
$uiFixture=Join-Path $env:RUNNER_TEMP 'nexo-recovery-ui-fixture.exe'
& cl.exe /nologo /std:c++17 /EHsc /O2 /MT (Join-Path $repo 'tests/fixtures/recovery-ui-fixture.cpp') "/Fo$env:RUNNER_TEMP/nexo-recovery-ui-fixture.obj" "/Fe$uiFixture"
if($LASTEXITCODE -ne 0){throw 'Compilação do teste gráfico falhou.'}
$env:NEXO_RECOVERY_UI_FIXTURE_EXE=$uiFixture
Push-Location $repo
try{
 & node tests/native-updater.mjs
 if($LASTEXITCODE -ne 0){throw 'Falha, interrupção ou integridade da recuperação falhou.'}
 & node --use-system-ca tests/windows-update.mjs
 if($LASTEXITCODE -ne 0){throw 'Atualização ou recuperação Windows falhou.'}
}finally{Pop-Location}
