# Celluloplast Academy — patch organisation principale (localhost)
# Renomme la demo org upstream "Udemy Test" / udemy-test → Celluloplast / celluloplast
#
# Usage (depuis la racine du repo) :
#   .\scripts\celluloplast\patch-primary-org.ps1
#   — ou dans le conteneur API Docker —
#   docker exec celluloplast-api pnpm --filter @cio/db db:celluloplast:patch-org

param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (Get-Command docker -ErrorAction SilentlyContinue) {
  $apiRunning = docker ps --filter 'name=celluloplast-api' --format '{{.Names}}' 2>$null
  if ($apiRunning -eq 'celluloplast-api') {
    Write-Host 'Patch via conteneur celluloplast-api...'
    docker exec celluloplast-api pnpm --filter @cio/db db:celluloplast:patch-org
    exit $LASTEXITCODE
  }
}

Write-Host 'Patch via pnpm (Postgres local requis)...'
pnpm --filter @cio/db db:celluloplast:patch-org
