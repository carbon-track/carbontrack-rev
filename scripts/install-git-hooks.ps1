param()

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$hooksPath = Join-Path $repoRoot ".githooks"

git config --local core.hooksPath $hooksPath
if ($LASTEXITCODE -ne 0) {
    throw "Failed to set core.hooksPath to $hooksPath"
}

Write-Host "Configured core.hooksPath -> $hooksPath"
