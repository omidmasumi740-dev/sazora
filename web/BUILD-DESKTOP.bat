@echo off
REM ============================================================
REM  SAZORA Desktop v1.9.14 — Build web app + Windows installer
REM  Requires: Node.js, .NET Framework 4.8 compiler, Inno Setup 7,
REM            and WebView2 SDK DLLs inside "..\desktop-host"
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo   ========================================
echo   SAZORA Desktop v1.9.14 — Builder
echo   ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
    echo   [ERROR] Node.js not found! Install it from nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo   [1/3] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo   [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo   [2/3] Building web app...
call npm run build
if not exist "dist\index.html" (
    echo   [ERROR] Web build failed. Run "npm run build" here for details.
    pause
    exit /b 1
)

echo   [3/3] Copying app files to desktop-host\app ...
if exist "..\desktop-host\app" rmdir /s /q "..\desktop-host\app"
xcopy /e /i /y "dist\*" "..\desktop-host\app\" >nul
if errorlevel 1 (
    echo   [ERROR] Copy failed.
    pause
    exit /b 1
)

cd /d "..\desktop-host"
call BUILD.bat
