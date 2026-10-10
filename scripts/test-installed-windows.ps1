$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true'){throw 'Executar apenas na máquina Windows isolada do GitHub.'}
$testRoot=Join-Path $env:RUNNER_TEMP 'nexo-release-validation'
$installRoot=Join-Path $testRoot 'installed'
$installer=Join-Path $testRoot 'setup.exe'
$webViewPresent=Test-Path -LiteralPath (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\EdgeWebView\Application')
$setupProcess=Start-Process -FilePath $installer -ArgumentList @('/S','/CURRENTUSER',('/D='+$installRoot)) -PassThru -Wait -WindowStyle Hidden
if($setupProcess.ExitCode -ne 0){throw "Instalador falhou: $($setupProcess.ExitCode)"}
$exe=Join-Path $installRoot 'nexo-ai.exe'
if(!(Test-Path -LiteralPath $exe)){throw 'Executável instalado ausente.'}
$shell=New-Object -ComObject WScript.Shell
$shortcuts=@(Get-ChildItem -LiteralPath ([Environment]::GetFolderPath('Programs')) -Filter '*Nexo*.lnk' -Recurse | Where-Object {$shell.CreateShortcut($_.FullName).TargetPath -eq $exe})
if($shortcuts.Count -eq 0){throw 'Atalho do menu Iniciar ausente.'}
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();$port=$listener.LocalEndpoint.Port;$listener.Stop()
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=$port --disable-gpu"
$env:WEBVIEW2_USER_DATA_FOLDER=Join-Path $testRoot 'webview-data'
$env:RUST_BACKTRACE='1'
$env:NEXO_TEST_CDP_PORT="$port"
$env:NEXO_TEST_RESULTS=$testRoot
# WebView2 150+ ignores environment overrides in an elevated CI runner.
# Scope the documented machine policy to this app, only on the disposable runner.
$policy='HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments'
$policyName='nexo-ai.exe'
$oldPolicy=Get-ItemPropertyValue -LiteralPath $policy -Name $policyName -ErrorAction SilentlyContinue
New-Item -Path $policy -Force | Out-Null
New-ItemProperty -LiteralPath $policy -Name $policyName -Value $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -PropertyType String -Force | Out-Null
$app=Start-Process -FilePath $exe -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $testRoot 'app-stdout.txt') -RedirectStandardError (Join-Path $testRoot 'app-stderr.txt')
@{installer=$setupProcess.ExitCode;startMenuShortcut=$true;webViewPresentBeforeInstall=$webViewPresent;version=(Get-Item -LiteralPath $exe).VersionInfo.ProductVersion;processId=$app.Id;cdpPort=$port} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'installation.json')
try{
    & node tests/windows-installed.mjs
    if($LASTEXITCODE -ne 0){throw 'Primeiro arranque desktop falhou.'}
    @{installer=$setupProcess.ExitCode;startMenuShortcut=$true;webViewPresentBeforeInstall=$webViewPresent;version=(Get-Item -LiteralPath $exe).VersionInfo.ProductVersion} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'installation.json')
}finally{
    if($null -eq $oldPolicy){Remove-ItemProperty -LiteralPath $policy -Name $policyName -ErrorAction SilentlyContinue}else{Set-ItemProperty -LiteralPath $policy -Name $policyName -Value $oldPolicy}
    $app.Refresh()
    @{exitedBeforeCleanup=$app.HasExited;exitCode=if($app.HasExited){$app.ExitCode}else{$null};webViewProcesses=@(Get-Process -Name msedgewebview2 -ErrorAction SilentlyContinue | Select-Object Id,SessionId)} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $testRoot 'process.json')
    $serviceLog=Join-Path $env:LOCALAPPDATA 'pt.nexoai.desktop\service.log'
    if(Test-Path -LiteralPath $serviceLog){Copy-Item -LiteralPath $serviceLog -Destination (Join-Path $testRoot 'service.txt')}
    if(!$app.HasExited){[void]$app.CloseMainWindow();if(!$app.WaitForExit(10000)){$app.Kill();$app.WaitForExit()}}
}
