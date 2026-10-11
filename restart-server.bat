@echo off
echo ===================================================
echo Restarting MedVeda Server...
echo ===================================================
cd /d "%~dp0"

echo Stopping any existing processes on ports 3000 and 8001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 :8001" ^| findstr "LISTENING"') do (
    if not "%%a"=="0" taskkill /F /PID %%a >nul 2>&1
)

echo Starting MedVeda Unified Server (Port 3000 + Python AI Port 8001)...
node --experimental-transform-types frontend/server.js
pause
