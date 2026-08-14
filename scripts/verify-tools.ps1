[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Get-CommandOutput {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments
    )

    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "Required command '$Command' was not found. Run scripts/setup.ps1 after installing the prerequisites."
    }

    $output = & $Command @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "'$Command $($Arguments -join ' ')' failed: $output"
    }

    return ($output | Out-String).Trim()
}

$gitVersion = Get-CommandOutput -Command "git" -Arguments @("--version")
$databricksVersion = Get-CommandOutput -Command "databricks" -Arguments @("version")
$uvVersion = Get-CommandOutput -Command "uv" -Arguments @("--version")
$nodeVersion = Get-CommandOutput -Command "node" -Arguments @("--version")
$npmVersion = Get-CommandOutput -Command "npm" -Arguments @("--version")
$pythonPath = Get-CommandOutput -Command "uv" -Arguments @("python", "find", "3.11")

$nodeMatch = [regex]::Match($nodeVersion, "v(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)")
if (-not $nodeMatch.Success) {
    throw "Could not parse Node.js version: $nodeVersion"
}

$nodeMajor = [int]$nodeMatch.Groups["major"].Value
$nodeMinor = [int]$nodeMatch.Groups["minor"].Value
if ($nodeMajor -ne 22 -or $nodeMinor -lt 16) {
    throw "Node.js 22.16 or newer within major version 22 is required; found $nodeVersion."
}

$skillCount = (Get-ChildItem -LiteralPath ".agents/skills" -Directory -ErrorAction Stop).Count
if ($skillCount -lt 1) {
    throw "No repository-scoped Databricks agent skills were found."
}

Write-Host $gitVersion
Write-Host $databricksVersion
Write-Host $uvVersion
Write-Host "Node.js $nodeVersion"
Write-Host "npm $npmVersion"
Write-Host "Python 3.11: $pythonPath"
Write-Host "Databricks agent skills: $skillCount"
Write-Host ""
Write-Host "Available Databricks CLI profiles (select one explicitly before workspace operations):"
databricks auth profiles
