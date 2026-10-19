$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Publish = Join-Path $Root "publish"
Remove-Item $Publish -Recurse -Force -ErrorAction SilentlyContinue
New-Item $Publish -ItemType Directory | Out-Null

Push-Location (Join-Path $Root "frontend")
npm ci
npm run build
Pop-Location
Copy-Item `
    (Join-Path $Root "frontend\dist\*") `
    (Join-Path $Publish "frontend") `
    -Recurse -Force

dotnet publish (Join-Path $Root "backend\audexa-backend.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o (Join-Path $Publish "backend")
dotnet publish (Join-Path $Root "desktop\Audexa.Desktop\Audexa.Desktop.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o (Join-Path $Publish "desktop")
dotnet publish (Join-Path $Root "desktop\Audexa.Updater\Audexa.Updater.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o (Join-Path $Publish "updater")
Write-Host "Publish payload prepared at $Publish"
Write-Host "Install Inno Setup 6, then compile installer\Audexa.iss. Set version in the script before release."
