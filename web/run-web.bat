@echo off
REM ============================================================
REM  SAZORA Web App v1.9.13 - Launcher
REM  Builds (if needed) and serves at http://localhost:5180
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo   ========================================
echo   SAZORA Web App v1.9.13
echo   ========================================
echo.

REM --- Kill any existing server on port 5180 ---
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5180 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>nul
)

REM --- Build the app once (source distribution has no dist/ yet) ---
if exist "dist\index.html" goto :serve

where npm >nul 2>nul
if errorlevel 1 (
    echo   [ERROR] Node.js is required to build the app.
    echo   Install it from https://nodejs.org and run this file again.
    echo.
    pause
    exit /b 1
)
if not exist "node_modules" (
    echo   Installing dependencies... (first run only)
    call npm install
    if errorlevel 1 (
        echo   [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)
echo   Building the app...
call npm run build
if not exist "dist\index.html" (
    echo   [ERROR] Build failed. Run "npm run build" in this folder to see details.
    pause
    exit /b 1
)

:serve
node -e "process.exit(0)" >nul 2>nul
if errorlevel 1 (
    echo   [ERROR] Node.js not found!
    echo   Install Node.js from nodejs.org, then run this file again.
    pause
    exit /b 1
)
start /b node serve.cjs

echo   Server is starting on http://localhost:5180
echo   Wait 2 seconds, then the browser opens...
timeout /t 2 /nobreak >nul

REM --- Open the default browser ---
start http://localhost:5180

echo   Browser opened!
echo   If it did not open, go to: http://localhost:5180
echo   Keep this window open while using the app.
echo   Press any key to close this window...
pause >nul
