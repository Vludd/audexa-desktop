# Release manifest format

The app expects `latest.json` with this shape:

```json
{
  "version": "1.0.1",
  "packageUrl": "https://github.com/OWNER/REPO/releases/download/v1.0.1/Audexa-Update-1.0.1-win-x64.zip",
  "sha256": "64-character-lowercase-hex-sha256",
  "releaseNotes": "Bug fixes and improvements."
}
```

The application source uses `PackageUrl`, `Sha256`, and `ReleaseNotes` properties. System.Text.Json web defaults make property names case-insensitive.
