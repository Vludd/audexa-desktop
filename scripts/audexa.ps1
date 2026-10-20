# Audexa Developer Commands
# Run through the PowerShell profile function: audexa <command>

param(
    [Parameter(Position = 0)]
    [ValidateSet("help", "status", "pull", "sync", "build", "release", "frontend", "backend")]
    [string]$Command = "help",

    [Parameter(Position = 1)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    param([string[]]$Arguments)

    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }
}

function Get-RepoRoot {
    $root = & git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0 -or -not $root) {
        throw "Run this command from inside the Audexa repository."
    }
    return $root.Trim()
}

$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot

switch ($Command) {
    "help" {
        @"
Audexa developer commands

  audexa status          Show repository and submodule status
  audexa pull            Pull main and sync pinned submodule commits
  audexa sync            Stage changed submodule references
  audexa build 1.0.9     Build the complete application
  audexa release 1.0.9   Trigger the GitHub release workflow
  audexa frontend        Enter the frontend directory
  audexa backend         Enter the backend directory
  audexa help            Show this help

"@
    }

    "status" {
        Write-Host "`n=== Main repository ===" -ForegroundColor Cyan
        Invoke-Git @("status", "--short")
        Write-Host "`n=== Submodules ===" -ForegroundColor Cyan
        Invoke-Git @("submodule", "status")
        Write-Host "`n=== Current branch ===" -ForegroundColor Cyan
        Invoke-Git @("branch", "--show-current")
    }

    "pull" {
        Invoke-Git @("pull", "origin", "main")
        Invoke-Git @("submodule", "update", "--init", "--recursive")
        Write-Host "Repository and pinned submodules are up to date." -ForegroundColor Green
    }

    "sync" {
        Invoke-Git @("add", "frontend", "backend")
        Write-Host "`nStaged changes:" -ForegroundColor Cyan
        Invoke-Git @("status", "--short")
        Write-Host "`nReview the staged changes, then commit and push when ready." -ForegroundColor Yellow
    }

    "build" {
        if ([string]::IsNullOrWhiteSpace($Version) -or $Version -notmatch '^\d+\.\d+\.\d+$') {
            throw "Usage: .\scripts\audexa.ps1 build <version>"
        }

        & (Join-Path $RepoRoot "scripts\build.ps1") -Version $Version

        if (-not $?) {
            throw "Build failed for version $Version."
        }
    }

    "release" {
        if (-not $Version -or $Version -notmatch '^\d+\.\d+\.\d+$') {
            throw "Usage: audexa release 1.0.9"
        }

        if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
            throw "GitHub CLI (gh) is required. Install it and run gh auth login."
        }

        & gh workflow run release.yml -f "version=$Version"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to trigger the release workflow."
        }

        Write-Host "Release workflow triggered for version $Version." -ForegroundColor Green
        Write-Host "Check its status with: gh run list --workflow release.yml"
    }

    "frontend" {
        Set-Location (Join-Path $RepoRoot "frontend")
    }

    "backend" {
        Set-Location (Join-Path $RepoRoot "backend")
    }
}