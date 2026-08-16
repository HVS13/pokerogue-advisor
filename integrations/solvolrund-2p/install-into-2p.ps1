param(
  [Parameter(Mandatory = $true)]
  [string]$GameRoot
)

$ErrorActionPreference = "Stop"

function Resolve-GameSrc([string]$Root) {
  $candidates = @(
    (Join-Path $Root "pokerogue-beta\src"),
    (Join-Path $Root "src")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate "main.ts")) {
      return $candidate
    }
  }

  throw "Could not find src/main.ts under '$Root'. Pass either the pokerogue-2p-beta repo root or its pokerogue-beta folder."
}

$gameSrc = Resolve-GameSrc $GameRoot
$sourceBridge = Join-Path $PSScriptRoot "pokerogue-advisor-bridge.ts"
$targetBridge = Join-Path $gameSrc "pokerogue-advisor-bridge.ts"
$mainPath = Join-Path $gameSrc "main.ts"
$advisorImport = 'import "./pokerogue-advisor-bridge";'

if (-not (Test-Path $sourceBridge)) {
  throw "Advisor bridge source not found next to this installer: $sourceBridge"
}

Copy-Item $sourceBridge $targetBridge -Force

$main = Get-Content $mainPath -Raw
if (-not $main.Contains($advisorImport)) {
  $marker = 'import "#app/i18n"; // Initializes i18n on import'
  if ($main.Contains($marker)) {
    $main = $main.Replace($marker, "$marker`r`n$advisorImport")
  } else {
    $main = "$advisorImport`r`n$main"
  }
  Set-Content $mainPath $main -Encoding UTF8
}

Write-Host "PokeRogue Advisor bridge installed."
Write-Host "Bridge: $targetBridge"
Write-Host "Entry:  $mainPath"
Write-Host "Next: run the PokeRogue typecheck/dev server, build the advisor extension, and reload the game page."
