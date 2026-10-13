@echo off
echo ===================================================
echo Restarting MedVeda Server...
echo ===================================================
cd /d "%~dp0"
set PYTHONDONTWRITEBYTECODE=1

echo Stopping any existing processes on ports 3000 and 8001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 :8001" ^| findstr "LISTENING"') do (
    if not "%%a"=="0" taskkill /F /PID %%a >nul 2>&1
)

if not exist "node_modules" (
    echo Installing dependencies for fresh clone...
    call npm install
)

echo Starting MedVeda Unified Server (Port 3000 + Python AI Port 8001)...
npx tsx frontend/server.js
pause

