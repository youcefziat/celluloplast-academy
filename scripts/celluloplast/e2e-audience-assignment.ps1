# Celluloplast Academy — E2E API isolation + auto-assignation audience
# Usage (depuis la racine du repo) :
#   .\scripts\celluloplast\e2e-audience-assignment.ps1
#
# Prérequis : stack Docker up (api :3081), migration 0008, admin@test.com / 123456

param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
Set-Location $Root

$script = Join-Path $Root 'scripts\celluloplast\e2e-audience-assignment.mjs'
if (-not (Test-Path $script)) {
  Write-Error "Script introuvable: $script"
}

Write-Host 'E2E audience assignment — Docker API locale...'
node $script
exit $LASTEXITCODE
