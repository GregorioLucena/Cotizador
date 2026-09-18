# Renombra la carpeta del proyecto de Ferreteria a Cotizador.
# Cerra Cursor (o al menos esta ventana del workspace) antes de ejecutarlo.
#
# Uso (PowerShell, desde cualquier sitio):
#   powershell -ExecutionPolicy Bypass -File "C:\Users\User\Documents\Trabajo\personal\Ferreteria\scripts\rename-folder-to-cotizador.ps1"

$ErrorActionPreference = "Stop"
$parent = "C:\Users\User\Documents\Trabajo\personal"
$from = Join-Path $parent "Ferreteria"
$to = Join-Path $parent "Cotizador"

if (-not (Test-Path $from)) {
  if (Test-Path $to) {
    Write-Host "Ya existe Cotizador. Nada que hacer."
    exit 0
  }
  throw "No se encontro la carpeta Ferreteria en $parent"
}

if (Test-Path $to) {
  throw "Ya existe $to. Borra o renombra ese destino primero."
}

Set-Location $parent
Rename-Item -Path $from -NewName "Cotizador"
Write-Host "Listo: $to"
Write-Host "Abrí esa carpeta en Cursor como workspace."
Write-Host "Luego: cd $to; pnpm docker:db; pnpm db:migrate; pnpm db:seed"
