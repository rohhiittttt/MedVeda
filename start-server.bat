@echo off
echo ===================================================
echo Starting MedVeda Server...
echo ===================================================
cd /d "%~dp0"
set PYTHONDONTWRITEBYTECODE=1
if not exist "node_modules" (
    echo Installing dependencies for fresh clone...
    call npm install
)
npx tsx frontend/server.js
pause

