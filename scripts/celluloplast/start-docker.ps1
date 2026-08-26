# Celluloplast Academy — démarrage Docker Compose
# Usage (depuis la racine du repo) :
#   .\scripts\celluloplast\start-docker.ps1
#   .\scripts\celluloplast\start-docker.ps1 -Rebuild

param(
    [switch]$Rebuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
Set-Location $Root

function New-Secret {
    return -join ((1..48) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
}

function Set-EnvValue {
    param([string]$Key, [string]$Value, [string[]]$Lines)
    $pattern = "^$([regex]::Escape($Key))="
    $found = $false
    $result = foreach ($line in $Lines) {
        if ($line -match $pattern) {
            $found = $true
            "$Key=$Value"
        } else {
            $line
        }
    }
    if (-not $found) {
        $result += "$Key=$Value"
    }
    return ,$result
}

$envFile = Join-Path $Root '.env'
$exampleFile = Join-Path $Root '.env.celluloplast.example'

if (-not (Test-Path $exampleFile)) {
    $exampleFile = Join-Path $Root '.env.example'
}

if (-not (Test-Path $envFile)) {
    if (-not (Test-Path $exampleFile)) {
        Write-Error ".env.example introuvable"
    }
    Copy-Item $exampleFile $envFile
    Write-Host 'Création de .env depuis .env.example'
}

$content = Get-Content $envFile -Raw
$lines = $content -split "`r?`n"

$authSecret = if ($content -match '(?m)^BETTER_AUTH_SECRET=\s*$') { New-Secret } else { $null }
$keySecret = if ($content -match '(?m)^PRIVATE_SERVER_KEY=\s*$') { New-Secret } else { $null }

if ($authSecret) {
    $lines = Set-EnvValue -Key 'BETTER_AUTH_SECRET' -Value $authSecret -Lines $lines
    Write-Host 'BETTER_AUTH_SECRET généré'
}
if ($keySecret) {
    $lines = Set-EnvValue -Key 'PRIVATE_SERVER_KEY' -Value $keySecret -Lines $lines
    Write-Host 'PRIVATE_SERVER_KEY généré'
}

$lines | Set-Content $envFile -Encoding utf8

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error 'Docker n est pas installé ou pas dans le PATH'
}

$composeArgs = @('compose', '-f', 'docker-compose.celluloplast.yaml', '--env-file', '.env', 'up', '-d')
if ($Rebuild) {
    $composeArgs += '--build'
}

Write-Host ''
Write-Host 'Démarrage de la stack Celluloplast Academy...'
Write-Host '  Dashboard : http://localhost:3082'
Write-Host '  Login démo: admin@test.com / 123456'
Write-Host ''

& docker @composeArgs

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host ''
Write-Host 'Suivre les logs : docker compose logs -f'
Write-Host 'Premier démarrage : l API seed la DB (1-2 min). Attendre que celluloplast-api soit healthy.'
