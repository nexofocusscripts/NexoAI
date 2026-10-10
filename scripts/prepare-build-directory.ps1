param([switch]$Debug,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$profile=if($Debug){'debug'}else{'release'}
$target=[IO.Path]::GetFullPath((Join-Path $projectRoot "src-tauri\target\$profile\backend"))
if(!$target.StartsWith($projectRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Destino fora do projeto.'}
if(Test-Path -LiteralPath $target){
    $current=Get-Item -LiteralPath $target
    while($current.FullName -ne $projectRoot){
        if($current.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Ligação simbólica na pasta de compilação.'}
        $current=$current.Parent
        if(!$current){throw 'Destino de compilação inválido.'}
    }
    if(!$CheckOnly){Remove-Item -LiteralPath $target -Recurse -Force}
}
