@echo off
echo ===================================================
echo Starting MedVeda Server...
echo ===================================================
cd /d "%~dp0"
node --experimental-transform-types frontend/server.js
pause
