# Compacte le disque virtuel de Docker Desktop pour rendre a Windows l'espace
# libere par "docker builder prune" / "docker image prune".
#
# A LANCER DANS UNE CONSOLE POWERSHELL *ADMINISTRATEUR* :
#   powershell -ExecutionPolicy Bypass -File .\scripts\compact-docker-disk.ps1
#
# Le script arrete Docker Desktop et WSL, compacte le .vhdx, puis vous laisse
# relancer Docker Desktop. Aucune image, aucun conteneur, aucun volume n'est
# supprime : la compaction ne recupere que les blocs deja libres dans le disque.

$ErrorActionPreference = 'Stop'

$vhdx = "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)

if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error 'Ce script doit etre lance depuis une console PowerShell Administrateur.'
}

if (-not (Test-Path $vhdx)) {
  Write-Error "Disque introuvable : $vhdx"
}

$sizeBefore = (Get-Item $vhdx).Length
$freeBefore = (Get-PSDrive C).Free
Write-Host ("Taille avant   : {0} Go" -f [math]::Round($sizeBefore / 1GB, 2))
Write-Host ("C: libre avant : {0} Go" -f [math]::Round($freeBefore / 1GB, 2))

Write-Host 'Arret de Docker Desktop...'
Get-Process -Name 'Docker Desktop', 'com.docker.backend', 'com.docker.build', 'docker-agent', 'docker' -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

Write-Host 'Arret de WSL...'
wsl.exe --shutdown
Start-Sleep -Seconds 10

Write-Host 'Compactage en cours (plusieurs minutes)...'
$script = @"
select vdisk file="$vhdx"
attach vdisk readonly
compact vdisk
detach vdisk
exit
"@

$scriptPath = Join-Path $env:TEMP 'compact-docker-vhdx.txt'
Set-Content -Path $scriptPath -Value $script -Encoding ascii
diskpart /s $scriptPath
Remove-Item $scriptPath -Force -ErrorAction SilentlyContinue

$sizeAfter = (Get-Item $vhdx).Length
$freeAfter = (Get-PSDrive C).Free
Write-Host ("Taille apres   : {0} Go" -f [math]::Round($sizeAfter / 1GB, 2))
Write-Host ("C: libre apres : {0} Go" -f [math]::Round($freeAfter / 1GB, 2))
Write-Host ("Espace rendu   : {0} Go" -f [math]::Round(($freeAfter - $freeBefore) / 1GB, 2))
Write-Host 'Termine. Vous pouvez relancer Docker Desktop.'
