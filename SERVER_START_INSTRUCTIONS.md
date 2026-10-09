# MedVeda Unified Server: Manual Start & Operation Guide

This document records all commands and configurations to start, restart, and operate the MedVeda server manually.

---

## 1. Quick One-Click Launch (Windows)
Double-click either of the convenience scripts in the repository root:
- `start-server.bat`: Boots the unified Node & Python AI server.
- `restart-server.bat`: Terminates existing server processes on ports 3000 and 8001, then boots a clean instance.

---

## 2. Command-Line Launch (Terminal / PowerShell / CMD)

### Primary Command (From Repository Root):
```powershell
npm start
```
*Behind the scenes, this executes:*
```powershell
npm --prefix frontend start
```
Which runs `tsx server.js` from `frontend/`.

### What `frontend/server.js` Automatically Does:
1. Boots the Node HTTP reverse proxy & domain pipelines on **`http://localhost:3000`**.
2. Automatically discovers your Python 3.12 / 3.14 installation on Windows (`C:\Python314\python.exe` or `AppData\Local\Programs\Python\Python312\python.exe`).
3. Automatically launches the internal Python FastAPI AI Engine from `python_service/app.py` on **`http://127.0.0.1:8001`**.
4. Proxies all AI screening, LLM diagnostic triage, multilingual EHR RAG, voice STT, and voice TTS requests seamlessly.

---

## 3. Rebuilding Frontend Assets (If modifying `app.js`)
If you make changes to `frontend/public/app.js`:
```powershell
node frontend/build.js
```
This re-bundles `frontend/public/app.js` into `frontend/public/dist/bundle.js` and `frontend/public/app.compiled.js`.

---

## 4. Manual Standalone Commands (If Running Separately)

### If you wish to run the Python AI Service manually in its own terminal:
```powershell
python python_service/app.py
```
*(Runs FastAPI + Uvicorn on `http://127.0.0.1:8001`)*

### If you wish to run the Node Frontend Server manually in another terminal:
```powershell
cd frontend
node --import tsx server.js
```
*(Runs Unified Server on `http://localhost:3000`)*

---

## 5. Port Information
- **Port 3000**: MedVeda Web Application UI & API Gateway (`http://localhost:3000`)
- **Port 8001**: Python AI/ML Diagnostic & Clinical Screening Engine (`http://127.0.0.1:8001`)
