
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Root "frontend"
$Publish = Join-Path $Root "publish"

function Invoke-Checked {
    param(
        [Parameter(Mandatory)]
        [string]$Command,

        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    & $Command @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
    }
}

# Verify required tools and lockfile
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm is not installed or not available in PATH."
}

$Lockfile = Join-Path $Frontend "pnpm-lock.yaml"
if (-not (Test-Path $Lockfile)) {
    throw "pnpm-lock.yaml was not found in the frontend directory."
}

# Clean previous publish output
Remove-Item $Publish -Recurse -Force -ErrorAction SilentlyContinue
New-Item $Publish -ItemType Directory -Force | Out-Null

# Build frontend using pnpm only
Push-Location $Frontend
try {
    Invoke-Checked "pnpm" @("install", "--frozen-lockfile")
    Invoke-Checked "pnpm" @("build")
}
finally {
    Pop-Location
}

$FrontendOutput = Join-Path $Frontend "dist"
if (-not (Test-Path (Join-Path $FrontendOutput "index.html"))) {
    throw "Frontend build did not produce dist/index.html."
}

$PublishFrontend = Join-Path $Publish "frontend"
New-Item $PublishFrontend -ItemType Directory -Force | Out-Null
Copy-Item (Join-Path $FrontendOutput "*") $PublishFrontend -Recurse -Force

# Publish backend
Invoke-Checked "dotnet" @(
    "publish",
    (Join-Path $Root "backend\audexa-backend.csproj"),
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=true",
    "-o", (Join-Path $Publish "backend")
)

# Publish desktop shell
Invoke-Checked "dotnet" @(
    "publish",
    (Join-Path $Root "desktop\Audexa.Desktop\Audexa.Desktop.csproj"),
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=true",
    "-o", (Join-Path $Publish "desktop")
)

# Publish updater
Invoke-Checked "dotnet" @(
    "publish",
    (Join-Path $Root "desktop\Audexa.Updater\Audexa.Updater.csproj"),
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=true",
    "-o", (Join-Path $Publish "updater")
)

# Verify essential output files
$RequiredFiles = @(
    "frontend\index.html",
    "backend\audexa-backend.exe",
    "desktop\Audexa.Desktop.exe",
    "updater\Audexa.Updater.exe"
)

foreach ($RelativePath in $RequiredFiles) {
    $Path = Join-Path $Publish $RelativePath
    if (-not (Test-Path $Path)) {
        throw "Required publish file is missing: $RelativePath"
    }
}

Write-Host ""
Write-Host "Publish payload prepared at $Publish" -ForegroundColor Green
Write-Host "Next: compile installer\Audexa.iss using Inno Setup 6."
Write-Host "Verify installer and update behavior before publishing a release."
