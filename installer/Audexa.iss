
#define AppName "Audexa"
#ifndef AppVersion
  #define AppVersion "1.0.8"
#endif

[Setup]
AppId={{8C7F51DA-9C6A-4E2D-8F9B-0F3E8D2D11A7}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\Audexa
DefaultGroupName=Audexa
OutputDir=..\artifacts\installer
OutputBaseFilename=Audexa-Setup-{#AppVersion}-x64
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\Audexa.Desktop.exe

[Files]
Source: "..\publish\desktop\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion
Source: "..\publish\frontend\*"; DestDir: "{app}\frontend"; Flags: recursesubdirs ignoreversion
Source: "..\publish\backend\*"; DestDir: "{app}\backend"; Flags: recursesubdirs ignoreversion
Source: "..\publish\updater\*"; DestDir: "{app}\updater"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{group}\Audexa"; Filename: "{app}\Audexa.Desktop.exe"
Name: "{autodesktop}\Audexa"; Filename: "{app}\Audexa.Desktop.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"
