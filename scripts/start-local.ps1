$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory
$nodeInstallations = Join-Path $env:LOCALAPPDATA 'Volta\tools\image\node'
$taskNode = $null
if (Test-Path -LiteralPath $nodeInstallations) {
  $taskNode = Get-ChildItem -LiteralPath $nodeInstallations -Directory | Sort-Object { [version]$_.Name } -Descending | ForEach-Object { Join-Path $_.FullName 'node.exe' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $taskNode) { $taskNode = (Get-Command node -ErrorAction Stop).Source }
$env:PATH = (Split-Path -Parent $taskNode) + ';' + $env:PATH
$env:XDG_CONFIG_HOME = Join-Path $projectDirectory '.wrangler\config'
$env:WRANGLER_SEND_METRICS = 'false'
function Run-NodeTask([string[]]$TaskArguments) {
  & $taskNode @TaskArguments
  if ($LASTEXITCODE -ne 0) { throw 'La preparación falló. Revisá el mensaje anterior.' }
}
if (-not (Test-Path -LiteralPath 'node_modules\wrangler')) {
  $npmCli = Join-Path (Split-Path -Parent $taskNode) 'node_modules\npm\bin\npm-cli.js'
  if (Test-Path -LiteralPath $npmCli) { Run-NodeTask @($npmCli,'ci') }
  else { throw 'Primero instalá las dependencias con npm ci.' }
}
Run-NodeTask @('scripts/local-setup.mjs')
Run-NodeTask @('node_modules\typescript\bin\tsc','--noEmit')
Run-NodeTask @('node_modules\vite\bin\vite.js','build')
Run-NodeTask @('node_modules\wrangler\bin\wrangler.js','d1','migrations','apply','gesell','--local')
Write-Host 'Abrí http://localhost:8787 en tu navegador.'
Write-Host 'La primera vez usá el valor SETUP_TOKEN del archivo .dev.vars para habilitar el dispositivo.'
Write-Host 'Esta versión usa una base local vacía, separada de las pruebas. No está publicada en internet.'
Run-NodeTask @('node_modules\wrangler\bin\wrangler.js','dev','--local','--ip','127.0.0.1','--port','8787')
