$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or !$env:RUNNER_TEMP){throw 'Este ensaio só pode correr no Windows descartável do GitHub.'}
$runtimeRoot=Join-Path ${env:ProgramFiles(x86)} 'Microsoft\EdgeWebView\Application'
if(Test-Path -LiteralPath $runtimeRoot){
    $setups=@(Get-ChildItem -LiteralPath $runtimeRoot -Directory | ForEach-Object {Join-Path $_.FullName 'Installer\setup.exe'} | Where-Object {Test-Path -LiteralPath $_})
    foreach($setup in $setups){
        $signature=Get-AuthenticodeSignature -LiteralPath $setup
        if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation'){throw 'Desinstalador WebView2 sem assinatura Microsoft válida.'}
        $process=Start-Process -FilePath $setup -ArgumentList @('--uninstall','--msedgewebview','--system-level','--force-uninstall') -PassThru -Wait -WindowStyle Hidden
        if($process.ExitCode -ne 0){throw "Preparação do ensaio WebView2 falhou: $($process.ExitCode)"}
    }
}
if(Test-Path -LiteralPath $runtimeRoot){
    $remaining=@(Get-ChildItem -LiteralPath $runtimeRoot -Recurse -Filter msedgewebview2.exe)
    if($remaining.Count){throw 'O runtime ainda está presente; não declarar validado o cenário de ausência.'}
}
$env:NEXO_EXPECT_WEBVIEW_ABSENT='1'
