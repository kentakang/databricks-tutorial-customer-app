[CmdletBinding()]
param(
    [switch]$SkipGitHooks
)

$ErrorActionPreference = "Stop"

function Assert-Command {
    param([Parameter(Mandatory)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found. Install it and restart the terminal."
    }
}

foreach ($command in @("git", "databricks", "uv", "node", "npm")) {
    Assert-Command -Name $command
}

uv python install 3.11

if (-not $SkipGitHooks) {
    git config --local core.hooksPath .githooks
}

Write-Host "Toolchain setup is complete."
Write-Host "Run scripts/verify-tools.ps1, then choose a Databricks CLI profile explicitly for workspace commands."

