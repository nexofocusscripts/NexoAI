$ErrorActionPreference='SilentlyContinue'
Write-Host '=== Nexo AI - Diagnostico ===' -ForegroundColor Cyan
Write-Host "Windows: $([Environment]::OSVersion.VersionString)"
Write-Host "RAM GB: $([math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB))"
Write-Host "CPU: $((Get-CimInstance Win32_Processor | Select-Object -First 1).Name)"
if (Get-Command nvidia-smi) { nvidia-smi --query-gpu=name,memory.total --format=csv,noheader }
if (Get-Command node) { Write-Host "Node: $(node --version)" } else { Write-Host 'Node: NAO INSTALADO' -ForegroundColor Yellow }
if (Get-Command ollama) { Write-Host 'Ollama:'; ollama list } else { Write-Host 'Ollama: NAO INSTALADO' -ForegroundColor Yellow }
