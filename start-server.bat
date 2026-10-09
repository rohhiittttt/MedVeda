@echo off
echo ===================================================
echo Starting MedVeda Server...
echo ===================================================
cd /d "%~dp0"
call npm.cmd start
pause
