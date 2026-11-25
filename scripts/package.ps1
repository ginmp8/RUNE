param([Parameter(Mandatory = $true)][string]$Output)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
python (Join-Path $Root "scripts/package_release.py") --root $Root --output $Output
