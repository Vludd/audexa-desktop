param(
    [Parameter(Mandatory)]
    [ValidatePattern('^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$')]
    [string]$Version
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$') {
    throw "Invalid version '$Version'. Expected MAJOR.MINOR.PATCH (optionally with a prerelease suffix)."
}

$AssemblyVersion = "$(($Version -split '-')[0]).0"

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

function Publish-DotNetProject {
    param(
        [Parameter(Mandatory)]
        [string]$ProjectPath,

        [Parameter(Mandatory)]
        [string]$OutputPath
    )

    Invoke-Checked "dotnet" @(
        "publish",
        $ProjectPath,
        "-c", "Release",
        "-r", "win-x64",
        "--self-contained", "true",
        "-p:PublishSingleFile=true",
        "-p:Version=$Version",
        "-p:AssemblyVersion=$AssemblyVersion",
        "-p:FileVersion=$AssemblyVersion",
        "-p:InformationalVersion=$Version",
        "-o", $OutputPath
    )
}

Write-Host "Building Audexa version $Version" -ForegroundColor Cyan

# Verify required tools and lockfile
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm is not installed or not available in PATH."
}

$Lockfile = Join-Path $Frontend "pnpm-lock.yaml"
if (-not (Test-Path $Lockfile)) {
    throw "pnpm-lock.yaml was not found in the frontend directory."
}

# Run updater transaction regression tests before producing release artifacts.
Invoke-Checked "dotnet" @(
    "test",
    (Join-Path $Root "tests\Audexa.Updater.Tests\Audexa.Updater.Tests.csproj"),
    "-c", "Release"
)

# Clean previous publish output
Remove-Item $Publish -Recurse -Force -ErrorAction SilentlyContinue
New-Item $Publish -ItemType Directory -Force | Out-Null

# Build frontend
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
Publish-DotNetProject `
    -ProjectPath (Join-Path $Root "backend\audexa-backend\audexa-backend.csproj") `
    -OutputPath (Join-Path $Publish "backend")

# Never ship a developer-local appsettings.json (it may contain production secrets).
# Runtime configuration is generated/migrated into %AppData%\Audexa.
$BackendLocalSettings = Join-Path $Publish "backend\appsettings.json"
if (Test-Path $BackendLocalSettings) {
    Remove-Item $BackendLocalSettings -Force
}
if (Test-Path $BackendLocalSettings) {
    throw "A local Backend appsettings.json must never be included in release payloads."
}

# Publish desktop shell
Publish-DotNetProject `
    -ProjectPath (Join-Path $Root "desktop\Audexa.Desktop\Audexa.Desktop.csproj") `
    -OutputPath (Join-Path $Publish "desktop")

# Publish updater
Publish-DotNetProject `
    -ProjectPath (Join-Path $Root "desktop\Audexa.Updater\Audexa.Updater.csproj") `
    -OutputPath (Join-Path $Publish "updater")

# Publish Media Agent as a separate self-contained folder.
# Keep PublishSingleFile disabled: LibVLC native libraries and plugins must remain
# available as files next to the Agent executable.
$MediaAgentOutput = Join-Path $Publish "media-agent"
Invoke-Checked "dotnet" @(
    "publish",
    (Join-Path $Root "backend\audexa-media-agent\Audexa.MediaAgent.csproj"),
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=false",
    "-p:Version=$Version",
    "-p:AssemblyVersion=$AssemblyVersion",
    "-p:FileVersion=$AssemblyVersion",
    "-p:InformationalVersion=$Version",
    "-o", $MediaAgentOutput
)

$AgentExampleConfig = Join-Path $Root "backend\audexa-media-agent\appsettings.example.json"
if (-not (Test-Path $AgentExampleConfig -PathType Leaf)) {
    throw "Media Agent example configuration is missing: $AgentExampleConfig"
}
Copy-Item $AgentExampleConfig (Join-Path $MediaAgentOutput "appsettings.example.json") -Force

$AgentReadme = Join-Path $Root "backend\audexa-media-agent\README.md"
if (Test-Path $AgentReadme -PathType Leaf) {
    Copy-Item $AgentReadme (Join-Path $MediaAgentOutput "README.md") -Force
}

# Verify essential output files
$RequiredFiles = @(
    "frontend\index.html",
    "backend\audexa-backend.exe",
    "desktop\Audexa.Desktop.exe",
    "updater\Audexa.Updater.exe",
    "media-agent\Audexa.MediaAgent.exe",
    "media-agent\appsettings.example.json"
)

foreach ($RelativePath in $RequiredFiles) {
    $Path = Join-Path $Publish $RelativePath
    if (-not (Test-Path $Path)) {
        throw "Required publish file is missing: $RelativePath"
    }
}

Write-Host ""
Write-Host "Publish payload prepared at $Publish" -ForegroundColor Green
Write-Host "Version: $Version" -ForegroundColor Cyan
Write-Host "Next: compile installer\Audexa.iss using Inno Setup 6."
Write-Host "Verify installer and update behavior before publishing a release."