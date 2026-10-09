# MedVeda Server Quick-Start & Restart Guide

> **AI / Developer Note**: Use these exact commands to start, stop, or restart the server directly without re-analyzing the codebase.

---

## 1. Quick One-Click Options (Windows Batch)

You can run or double-click these batch scripts in the project root (`c:\Users\rohit das\MedVeda`):

- **Start**: `.\start-server.bat`
- **Restart**: `.\restart-server.bat`

---

## 2. Start Server (Command Line)

From the project root (`c:\Users\rohit das\MedVeda`):

### PowerShell:
```powershell
npm.cmd start
```

*Alternative direct command:*
```powershell
npx.cmd tsx frontend/server.js
```

### Command Prompt (`cmd.exe`):
```cmd
npm start
```

### What this starts automatically:
1. **Unified Web & API Server**: `http://localhost:3000` (Node.js / tsx)
2. **Python AI & Voice Service**: `http://127.0.0.1:8001` (Auto-spawned by `frontend/server.js` using `python_service/app.py`)

---

## 3. Restart Server Manually

Run this in PowerShell to stop existing instances on ports 3000 and 8001, then restart:

```powershell
# Step 1: Kill any existing processes on ports 3000 and 8001
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000, 8001 -State Listen -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force

# Step 2: Start the server
npm.cmd start
```

---

## 4. Stop Server Only

To terminate the running server instances without starting a new one:

### PowerShell:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000, 8001 -State Listen -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Command Prompt (`cmd.exe`):
```cmd
for /f "tokens=5" %a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %a
for /f "tokens=5" %a in ('netstat -aon ^| findstr :8001') do taskkill /f /pid %a
```

---

## 5. Verify Server Health

```powershell
# Check frontend & unified API (Expect: StatusCode 200)
Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing | Select-Object StatusCode

# Check Python AI microservice (Expect: StatusCode 200)
Invoke-WebRequest -Uri http://127.0.0.1:8001/api/agent/doctors -UseBasicParsing | Select-Object StatusCode
```

---

## 6. First-Time Setup Only (If `node_modules` is Missing)

```powershell
npm.cmd install
```

> **Windows PowerShell Note**: Always use `npm.cmd` and `npx.cmd` rather than `npm` / `npx` in PowerShell to prevent script execution policy errors (`npm.ps1 cannot be loaded`).
