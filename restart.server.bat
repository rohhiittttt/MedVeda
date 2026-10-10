@echo off
echo ===================================================
echo Restarting MedVeda Server...
echo ===================================================
cd /d "%~dp0"

echo Stopping any existing processes on ports 3000 and 8001...
powershell -NoProfile -Command "$conns = Get-NetTCPConnection -LocalPort 3000, 8001 -State Listen -ErrorAction SilentlyContinue; if ($conns) { $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }"

echo Starting server fresh...
call npm.cmd start
pause
