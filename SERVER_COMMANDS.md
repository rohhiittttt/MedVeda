# MedVeda Server Quick-Start & Restart Guide

> **AI / Developer Note**: Use these exact commands to start or restart the server directly without re-analyzing the codebase.

---

## 1. Start Server (One Command)

From the project root (`c:\Users\rohit das\MedVeda`):

```powershell
npm.cmd start
```

*Alternative direct command:*
```powershell
npx.cmd tsx frontend/server.js
```

### What this starts automatically:
1. **Unified Web & API Server**: `http://localhost:3000` (Node.js / tsx)
2. **Python AI & Voice Service**: `http://127.0.0.1:8001` (Auto-spawned by `frontend/server.js` using `python_service/app.py`)

---

## 2. Restart Server

Run this in PowerShell to stop existing instances on ports 3000 and 8001, then restart:

```powershell
# 1. Kill any existing processes on ports 3000 and 8001
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000, 8001 -State Listen -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Start the server
npm.cmd start
```

---

## 3. Verify Server Status

```powershell
# Check frontend & unified API
Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing | Select-Object StatusCode

# Check Python AI microservice
Invoke-WebRequest -Uri http://127.0.0.1:8001/api/agent/doctors -UseBasicParsing | Select-Object StatusCode
```

Both should return `StatusCode: 200`.

---

## 4. First-Time Setup Only (If `node_modules` is Missing)

```powershell
npm.cmd install
```

> **Windows PowerShell Note**: Always use `npm.cmd` and `npx.cmd` rather than `npm` / `npx` to prevent PowerShell script execution policy errors with `npm.ps1`.
