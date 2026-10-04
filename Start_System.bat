@echo off
setlocal enabledelayedexpansion
title TDBridge Production Control Terminal
color 0b

echo =========================================================
echo             TOUCHDESIGNER BRIDGE LAUNCHER
echo =========================================================
echo.

:: --- Step 1: Check Node.js ---
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0c
    echo [FATAL ERROR] Node.js is not installed or not in PATH!
    echo               Please download and install from: https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js detected: %NODE_VER%

:: --- Step 2: Verify & Install Dependencies ---
if not exist "node_modules\" (
    echo [SETUP] node_modules missing - installing packages...
    call npm install
    if %errorlevel% neq 0 (
        color 0c
        echo [ERROR] npm install failed! Please check your internet connection.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed.
) else (
    echo [OK] Dependencies verified.
)

:: --- Step 3: Network Port & Process Hygiene ---
echo [CHECK] Cleaning stale background processes & ports...
if exist ".relay.pid" (
    set /p OLD_PID=<.relay.pid
    if defined OLD_PID (
        taskkill /F /T /PID !OLD_PID! >nul 2>&1
        echo   - Terminated previous relay process tree ^(PID !OLD_PID!^)
    )
    del /f /q .relay.pid >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo   - Cleared stale TCP port 8080 ^(PID %%a^)
)
for /f "tokens=4" %%a in ('netstat -aon ^| findstr ":9001 "') do (
    taskkill /F /PID %%a >nul 2>&1
    echo   - Cleared stale UDP port 9001 ^(PID %%a^)
)
taskkill /F /IM cloudflared.exe >nul 2>&1
echo [OK] Network ports ready.

set REBUILD_REQUESTED=0
for %%x in (%*) do (
    if /i "%%x"=="--rebuild" set REBUILD_REQUESTED=1
    if /i "%%x"=="-r" set REBUILD_REQUESTED=1
)

:: --- Step 4: Build Client & Server Bundles ---
echo [BUILD] Verifying application bundles...
if not exist "public\app.js" (
    echo   - Building client app.js...
    call npx tsc src\client\app.ts --outDir public --target es2020 --lib dom,es2020 --esModuleInterop --skipLibCheck 2>nul
)

set NEED_SERVER_BUILD=0
if not exist "dist\relay.js" set NEED_SERVER_BUILD=1
if "!REBUILD_REQUESTED!"=="1" set NEED_SERVER_BUILD=1

if "!NEED_SERVER_BUILD!"=="0" (
    node -e "const fs = require('fs'); const d = fs.statSync('dist/relay.js').mtimeMs; const r = fs.statSync('src/server/relay.ts').mtimeMs; const p = fs.existsSync('src/server/profiles.ts') ? fs.statSync('src/server/profiles.ts').mtimeMs : 0; process.exit(r > d || p > d ? 1 : 0);" >nul 2>&1
    if !errorlevel! neq 0 (
        set NEED_SERVER_BUILD=1
    )
)

if "!NEED_SERVER_BUILD!"=="1" (
    echo   - Building relay server dist\relay.js...
    call npx tsc src\server\relay.ts --outDir dist --target es2020 --module commonjs --esModuleInterop --skipLibCheck 2>nul
    if not exist "dist\relay.js" (
        color 0c
        echo [ERROR] TypeScript compilation failed!
        echo         Check src\server\relay.ts for syntax errors.
        pause
        exit /b 1
    )
    echo [OK] Build complete.
) else (
    echo [OK] Application bundles up to date ^(cached^).
)

:: --- Step 5: TouchDesigner Engine Health Check ---
tasklist /FI "IMAGENAME eq TouchDesigner.exe" 2>NUL | find /I /N "TouchDesigner.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] TouchDesigner engine is actively running.
) else (
    echo.
    echo [INFO] TouchDesigner is NOT currently running.
    echo        Would you like to open TDBridge.toe now?
    set /p LAUNCH_TD="       Press [Y] to launch TouchDesigner, or any key to continue: "
    if /i "!LAUNCH_TD!"=="Y" (
        echo   - Launching TDBridge.toe...
        if exist "C:\Program Files\Derivative\TouchDesigner\bin\TouchDesigner.exe" (
            start "" "C:\Program Files\Derivative\TouchDesigner\bin\TouchDesigner.exe" "TDBridge.toe"
        ) else (
            start "" "TDBridge.toe"
        )
        echo   - Waiting for TouchDesigner to initialize...
        timeout /t 5 /nobreak >nul
    )
)

:: --- Step 6: Start Relay Service with Diagnostics Trap ---
echo.
echo =========================================================
echo   Starting Relay Server & Cloudflare Tunnel...
echo   TouchDesigner active project: TDBridge.toe
echo =========================================================
echo.

node dist\relay.js %*
set RELAY_EXIT_CODE=%errorlevel%

:: --- Step 7: Post-Exit Diagnostics ---
if %RELAY_EXIT_CODE% neq 0 (
    color 0c
    echo.
    echo =========================================================
    echo [DIAGNOSTIC] Relay service exited with error code: %RELAY_EXIT_CODE%
    echo =========================================================
    if exist "scratch_debug\error_log.txt" (
        echo Recent Error Logs:
        powershell -NoProfile -Command "Get-Content scratch_debug\error_log.txt -Tail 10" 2>nul
        echo =========================================================
    )
    echo Troubleshooting Steps:
    echo   1. Ensure port 8080 is not claimed by another app.
    echo   2. Ensure TouchDesigner project is open and running at 60 FPS.
    echo   3. Verify internet connection for Cloudflare tunnel.
    echo.
)

pause
