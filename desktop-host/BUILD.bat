@echo off
REM ============================================================
REM  SAZORA Desktop v1.9.13 - Builder + Installer (Inno Setup 7)
REM  Rebuilds SAZORA.exe and the setup file.
REM  Requires: .NET Framework 4.8 compiler + Inno Setup 7
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"

set "CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" (
    echo   [ERROR] .NET Framework compiler not found!
    pause
    exit /b 1
)

set "ISCC=C:\Program Files\Inno Setup 7\ISCC.exe"
if not exist "%ISCC%" set "ISCC=C:\Program Files (x86)\Inno Setup 7\ISCC.exe"
if not exist "%ISCC%" (
    echo   [ERROR] Inno Setup 7 not found!
    pause
    exit /b 1
)

echo   [1/2] Compiling SAZORA.exe with WebView2...
"%CSC%" /nologo /target:winexe /platform:x64 /out:"SAZORA.exe" /win32icon:"app.ico" /reference:System.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:"Microsoft.Web.WebView2.Core.dll" /reference:"Microsoft.Web.WebView2.WinForms.dll" "Sazora.cs"
if errorlevel 1 (
    echo   [ERROR] C# compilation failed!
    pause
    exit /b 1
)

echo   [2/2] Compiling installer...
"%ISCC%" "installer.iss"

echo.
echo   DONE: installer\SAZORA_1.9.13_Setup.exe
pause
