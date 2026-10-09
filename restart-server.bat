@echo off
echo ===================================================
echo Restarting MedVeda Server...
echo ===================================================
cd /d "%~dp0"

echo Stopping any existing processes on ports 3000 and 8001...
powershell -NoProfile -Command "Get-Process -Id (Get-NetTCPConnection -LocalPort 3000, 8001 -State Listen -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force"

echo Starting server fresh...
call npm.cmd start
pause
