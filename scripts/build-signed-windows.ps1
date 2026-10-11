param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$CertificateThumbprint,
    [Parameter(Mandatory=$true)][uri]$TimestampServer
)
$ErrorActionPreference='Stop'
if($TimestampServer.Scheme -ne 'https'){throw 'Usa o endereço HTTPS de carimbo de tempo indicado pelo emissor.'}
$certificate=Get-Item -LiteralPath ("Cert:\CurrentUser\My\"+$CertificateThumbprint) -ErrorAction SilentlyContinue
if(!$certificate -or !$certificate.HasPrivateKey){throw 'Certificado de assinatura com chave privada não encontrado. Não foi compilado nem assinado qualquer ficheiro.'}
if($certificate.NotAfter -le [DateTime]::Now -or $certificate.NotBefore -gt [DateTime]::Now){throw 'Certificado fora da validade.'}
if(!($certificate.EnhancedKeyUsageList | Where-Object {$_.ObjectId -eq '1.3.6.1.5.5.7.3.3'})){throw 'O certificado não permite assinatura de código.'}
$chain=[Security.Cryptography.X509Certificates.X509Chain]::new()
try{if(!$chain.Build($certificate)){throw 'A cadeia do certificado não é reconhecida pelo Windows.'}}finally{$chain.Dispose()}
$projectRoot=Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot 'build-native.ps1')
$signTool=(Get-Command signtool.exe -ErrorAction Stop).Source
foreach($name in @('sandbox','vault','signature','updater','lua-tests')){
    $file=Join-Path $projectRoot "src-tauri\resources\nexo-$name.exe"
    & $signTool sign /sha1 $CertificateThumbprint /fd SHA256 /tr $TimestampServer.AbsoluteUri /td SHA256 $file
    if($LASTEXITCODE -ne 0){throw "Falha de assinatura: $name"}
    $helperSignature=Get-AuthenticodeSignature -LiteralPath $file
    if($helperSignature.Status -ne 'Valid' -or $helperSignature.SignerCertificate.Thumbprint -ne $CertificateThumbprint){throw 'Assinatura de auxiliar não validada.'}
}
$configurationDirectory=Join-Path $projectRoot '.nexo-build'
New-Item -ItemType Directory -Path $configurationDirectory -Force | Out-Null
$configuration=Join-Path $configurationDirectory 'windows-signing.json'
@{bundle=@{windows=@{certificateThumbprint=$CertificateThumbprint;digestAlgorithm='sha256';timestampUrl=$TimestampServer.AbsoluteUri}}} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $configuration
Push-Location $projectRoot
try{
    & node --use-system-ca scripts/prepare-runtime.mjs
    if($LASTEXITCODE -ne 0){throw 'Falha ao preparar o runtime oficial.'}
    & (Join-Path $PSScriptRoot 'prepare-build-directory.ps1')
    & npm.cmd run desktop:build -- --config $configuration
    if($LASTEXITCODE -ne 0){throw 'Falha ao compilar a distribuição assinada.'}
    $files=@((Join-Path $projectRoot 'src-tauri\target\release\nexo-ai.exe'))
    $files+=@(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src-tauri\target\release\bundle\nsis') -Filter '*-setup.exe' | ForEach-Object {$_.FullName})
    if($files.Count -ne 2){throw 'A distribuição não contém exatamente uma aplicação e um instalador.'}
    foreach($file in $files){
        $signature=Get-AuthenticodeSignature -LiteralPath $file
        if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne $CertificateThumbprint){throw 'Assinatura de editor não validada. Não distribuir esta compilação.'}
    }
    Write-Output 'Aplicação e instalador assinados e verificados. Preparar o pacote Ed25519 apenas depois desta verificação.'
}finally{Pop-Location;Remove-Item -LiteralPath $configuration -Force -ErrorAction SilentlyContinue}
