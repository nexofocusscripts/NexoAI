param([Parameter(Mandatory=$true)][string]$InstallerPath)
$ErrorActionPreference='Stop'
$signature=Get-AuthenticodeSignature -LiteralPath $InstallerPath
@{status=$signature.Status.ToString();subject=$signature.SignerCertificate.Subject}|ConvertTo-Json -Compress
