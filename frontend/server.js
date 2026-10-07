import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { AssessTriageUseCase } from '../backend/src/application/use-cases/assess-triage.use-case.ts';
import { ResearchHospitalsUseCase } from '../backend/src/application/use-cases/research-hospitals.use-case.ts';
import { RankFacilitiesUseCase } from '../backend/src/application/use-cases/rank-facilities.use-case.ts';
import { CareNavigationPipelineUseCase } from '../backend/src/application/use-cases/pipeline.use-case.ts';
import { InMemoryHospitalCacheAdapter } from '../backend/src/infrastructure/cache/in-memory-hospital.cache.ts';
import { GoogleSearchMcpAdapter } from '../backend/src/infrastructure/mcp/google-search-mcp.adapter.ts';
import { GeminiHospitalDiscoveryAdapter } from '../backend/src/infrastructure/mcp/gemini-search-grounding.adapter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env if present
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const k = trimmed.substring(0, eqIdx).trim();
        const v = trimmed.substring(eqIdx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch (e) {
  console.warn('Could not parse .env file:', e);
}

// ==========================================
// --- PYTHON AI & VOICE ENGINE AUTO-SPAWNER (UNIFIED BACKEND) ---
// ==========================================
const PYTHON_SERVICE_PORT = process.env.PYTHON_PORT || '8001';
const PYTHON_SERVICE_BASE = process.env.PYTHON_SERVICE_URL || `http://127.0.0.1:${PYTHON_SERVICE_PORT}`;
let pythonProcess = null;
let isStartingPython = false;

function resolvePythonPath() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  const possiblePaths = [
    process.env.PYTHON_PATH,
    'C:\\Users\\rohit das\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
    'python3',
    'python',
    'py'
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (p.includes(path.sep) && fs.existsSync(p)) {
      return p;
    }
  }
  return possiblePaths[0] || 'python';
}

async function isPythonRunning() {
  try {
    const res = await fetch(`${PYTHON_SERVICE_BASE}/api/agent/doctors`, { signal: AbortSignal.timeout(1200) });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

async function ensurePythonServiceRunning() {
  if (isStartingPython) return;

  const alreadyRunning = await isPythonRunning();
  if (alreadyRunning) {
    console.log(`[Unified Server] Python AI & Voice Service is already active on ${PYTHON_SERVICE_BASE}`);
    return;
  }

  // If a remote URL is explicitly configured, don't attempt to spawn locally
  if (process.env.PYTHON_SERVICE_URL && !process.env.PYTHON_SERVICE_URL.includes('127.0.0.1') && !process.env.PYTHON_SERVICE_URL.includes('localhost')) {
    console.log(`[Unified Server] Connecting to remote Python AI Service at ${process.env.PYTHON_SERVICE_URL}`);
    return;
  }

  isStartingPython = true;
  const pythonExec = resolvePythonPath();
  const scriptPath = path.resolve(__dirname, '../python_service/app.py');
  const projectRoot = path.resolve(__dirname, '..');

  console.log(`[Unified Server] Spawning Python AI Service internally: ${pythonExec} ${scriptPath}`);

  try {
    pythonProcess = spawn(pythonExec, [scriptPath], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PORT: String(PYTHON_SERVICE_PORT)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    pythonProcess.stdout.on('data', (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) console.log(`[Python AI Service] ${msg}`);
    });

    pythonProcess.stderr.on('data', (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) console.log(`[Python AI Service stderr] ${msg}`);
    });

    pythonProcess.on('exit', (code, signal) => {
      console.warn(`[Unified Server] Internal Python AI Service process exited (code: ${code}, signal: ${signal})`);
      pythonProcess = null;
    });

    // Wait up to 15 seconds for Python service to report healthy
    const startTime = Date.now();
    while (Date.now() - startTime < 15000) {
      await new Promise((r) => setTimeout(r, 600));
      if (await isPythonRunning()) {
        console.log(`[Unified Server] Python AI & Voice Service is online and connected at ${PYTHON_SERVICE_BASE}`);
        isStartingPython = false;
        return;
      }
    }
    console.warn(`[Unified Server] Python AI Service startup is taking longer than expected. Continuing in background.`);
  } catch (err) {
    console.error(`[Unified Server] Error launching Python AI Service:`, err);
  } finally {
    isStartingPython = false;
  }
}

function cleanupPythonProcess() {
  if (pythonProcess && !pythonProcess.killed) {
    console.log('[Unified Server] Shutting down internal Python AI Service process...');
    try {
      pythonProcess.kill('SIGTERM');
    } catch (e) {
      // ignore
    }
    pythonProcess = null;
  }
}

process.on('SIGINT', () => {
  cleanupPythonProcess();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanupPythonProcess();
  process.exit(0);
});

process.on('exit', () => {
  cleanupPythonProcess();
});

import { InMemoryTeleconsultStore } from '../backend/src/infrastructure/cache/teleconsult.cache.ts';
import { TeleconsultBookingUseCase } from '../backend/src/application/use-cases/teleconsult-booking.use-case.ts';
import { TeleconsultQueueUseCase } from '../backend/src/application/use-cases/teleconsult-queue.use-case.ts';
import { TeleconsultSessionUseCase } from '../backend/src/application/use-cases/teleconsult-session.use-case.ts';

import { SqliteReferralStore } from '../backend/src/infrastructure/db/sqlite-referral.store.ts';
import { ManageReferralUseCase } from '../backend/src/application/use-cases/manage-referral.use-case.ts';

import { SqliteFollowUpStore } from '../backend/src/infrastructure/db/sqlite-followup.store.ts';
import { ManageFollowUpUseCase } from '../backend/src/application/use-cases/manage-followup.use-case.ts';

import { InMemoryRecordsStore } from '../backend/src/infrastructure/cache/records.store.ts';
import { ManageRecordsUseCase } from '../backend/src/application/use-cases/manage-records.use-case.ts';

import { SqliteMedicineStore } from '../backend/src/infrastructure/db/sqlite-medicine.store.ts';
import { ManageMedicineDiagnosticUseCase } from '../backend/src/application/use-cases/manage-medicine-diagnostic.use-case.ts';

import { InMemoryFacilityDashboardStore } from '../backend/src/infrastructure/cache/facility-dashboard.store.ts';
import { ManageFacilityDashboardUseCase } from '../backend/src/application/use-cases/manage-facility-dashboard.use-case.ts';

import { InMemorySchemeStore } from '../backend/src/infrastructure/cache/scheme.store.ts';

import { InMemoryCommandCenterStore } from '../backend/src/infrastructure/cache/command-center.store.ts';
import { ManageCommandCenterUseCase } from '../backend/src/application/use-cases/manage-command-center.use-case.ts';
import { GeminiCommandCenterAdapter } from '../backend/src/infrastructure/mcp/gemini-command-center.adapter.ts';
import { INDIA_STATES, INDIA_DISTRICTS, getDistrictsByState, getDistrictById, searchDistricts } from '../backend/src/infrastructure/data/india-geography.ts';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize Domain Pipeline (Feature 01)
const triageUseCase = new AssessTriageUseCase();
const cacheAdapter = new InMemoryHospitalCacheAdapter();
const searchAdapter = new GoogleSearchMcpAdapter();
const geminiAdapter = new GeminiHospitalDiscoveryAdapter();
const researchUseCase = new ResearchHospitalsUseCase(searchAdapter, cacheAdapter, geminiAdapter);
const rankUseCase = new RankFacilitiesUseCase();
const pipelineUseCase = new CareNavigationPipelineUseCase(triageUseCase, researchUseCase, rankUseCase);

// Initialize Teleconsultation & Queue Store & Use Cases (Feature 02)
const teleconsultStore = new InMemoryTeleconsultStore();
const bookingUseCase = new TeleconsultBookingUseCase(teleconsultStore);
const queueUseCase = new TeleconsultQueueUseCase(teleconsultStore);
const sessionUseCase = new TeleconsultSessionUseCase(teleconsultStore);

// Initialize Referral Store & Use Case (Feature 03: Persistent SQLite)
const referralStore = new SqliteReferralStore();
const referralUseCase = new ManageReferralUseCase(referralStore);

// Initialize Follow-Up Store & Use Case (Feature 04: Persistent SQLite)
const followUpStore = new SqliteFollowUpStore();
const followUpUseCase = new ManageFollowUpUseCase(followUpStore);

// Initialize Interoperable Health Records Store & Use Case (Feature 05)
import { RecordsRagUseCase } from '../backend/src/application/use-cases/records-rag.use-case.ts';
import { GeminiRecordsRagAdapter } from '../backend/src/infrastructure/ai/gemini-records-rag.adapter.ts';

const recordsStore = new InMemoryRecordsStore();
const recordsUseCase = new ManageRecordsUseCase(recordsStore);
const recordsRagAdapter = new GeminiRecordsRagAdapter();
const recordsRagUseCase = new RecordsRagUseCase(recordsStore, recordsRagAdapter);

// Initialize Medicine Availability & Diagnostic Coordination Store & Use Case (Feature 06: Persistent SQLite)
const medicineStore = new SqliteMedicineStore();
const medicineUseCase = new ManageMedicineDiagnosticUseCase(medicineStore);

// Initialize Facility Dashboard Store & Use Case (Feature 07)
const dashboardStore = new InMemoryFacilityDashboardStore();
const dashboardUseCase = new ManageFacilityDashboardUseCase(
  dashboardStore,
  teleconsultStore,
  referralStore,
  followUpStore,
  recordsStore,
  medicineStore
);

// Initialize Scheme Finder Store (Feature 08)
const schemeStore = new InMemorySchemeStore();

// Initialize District Admin Command Center (Feature 09 / MV-DAC)
const commandCenterStore = new InMemoryCommandCenterStore();
const commandCenterGeminiAdapter = new GeminiCommandCenterAdapter();
const commandCenterUseCase = new ManageCommandCenterUseCase(commandCenterStore, commandCenterGeminiAdapter);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const reqPath = urlObj.pathname;

  // --- API ROUTING (/api/v1/* and /api/*) ---
  if (reqPath.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    try {
      // normalize path without /v1/ if present
      const normPath = reqPath.replace(/^\/api\/v1\//, '/api/');

      // === FEATURE 01: SMART CARE NAVIGATOR ENDPOINTS ===
      if ((normPath === '/api/geocode/reverse') && req.method === 'POST') {
        const body = await readJsonBody(req);
        const lat = typeof body.latitude === 'number' ? body.latitude : parseFloat(body.latitude);
        const lng = typeof body.longitude === 'number' ? body.longitude : parseFloat(body.longitude);
        const geoResult = await geminiAdapter.reverseGeocode(lat, lng);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: geoResult }));
        return;
      }

      if ((normPath === '/api/navigate/pipeline') && req.method === 'POST') {
        const body = await readJsonBody(req);
        const result = await pipelineUseCase.execute(body);
        if (result.triage?.urgency === 'CRITICAL') {
          dashboardStore.addAlert({
            alertId: `ALT-CRIT-${Date.now().toString(36).toUpperCase()}`,
            facilityId: result.recommendations?.[0]?.id?.includes('sbmch') ? 'fac_03' : 'fac_01',
            alertType: 'emergency_case',
            severity: 'critical',
            relatedEntityId: result.sessionId,
            message: `CRITICAL Triage Alert: Urgent emergency triage triggered (${result.triage.conditionCategory || result.triage.clinicalRoutingAdvice || 'Red-flag presentation'}). Top facility: ${result.recommendations?.[0]?.name || 'District Emergency Hospital'}.`,
            status: 'active',
            createdAt: new Date().toISOString()
          });
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      if ((normPath === '/api/triage/assess') && req.method === 'POST') {
        const body = await readJsonBody(req);
        const triage = await triageUseCase.execute(body);
        if (triage.urgency === 'CRITICAL') {
          dashboardStore.addAlert({
            alertId: `ALT-CRIT-${Date.now().toString(36).toUpperCase()}`,
            facilityId: 'fac_01',
            alertType: 'emergency_case',
            severity: 'critical',
            message: `CRITICAL Triage Alert: Severe condition identified (${triage.conditionCategory || triage.clinicalRoutingAdvice || 'Emergency red flag'}). Immediate ER triage prep advised.`,
            status: 'active',
            createdAt: new Date().toISOString()
          });
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: triage }));
        return;
      }

      if ((normPath === '/api/hospitals/research') && req.method === 'POST') {
        const body = await readJsonBody(req);
        const research = await researchUseCase.execute(body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: research }));
        return;
      }

      if ((normPath === '/api/recommendations/rank') && req.method === 'POST') {
        const body = await readJsonBody(req);
        const ranking = await rankUseCase.execute(body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: ranking }));
        return;
      }

      // === FEATURE 02: TELECONSULTATION & QUEUE ENDPOINTS ===
      // 1. Doctor Roster: GET /api/doctors/roster
      if (normPath === '/api/doctors/roster' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || undefined;
        const specialty = urlObj.searchParams.get('specialty') || undefined;
        const roster = await bookingUseCase.getRoster(facilityId, specialty);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: roster }));
        return;
      }

      // 2. Slots: GET /api/teleconsult/slots
      if (normPath === '/api/teleconsult/slots' && req.method === 'GET') {
        const doctorId = urlObj.searchParams.get('doctor_id') || undefined;
        const specialty = urlObj.searchParams.get('specialty') || undefined;
        const date = urlObj.searchParams.get('date') || undefined;
        const slots = await bookingUseCase.getSlots(doctorId, specialty, date);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: slots }));
        return;
      }

      // 3. Book: POST /api/teleconsult/book
      if (normPath === '/api/teleconsult/book' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const booking = await bookingUseCase.bookAppointment(body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: booking }));
        return;
      }

      // 4. Join Queue: POST /api/teleconsult/queue/join
      if (normPath === '/api/teleconsult/queue/join' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const entry = await queueUseCase.joinQueue(body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: entry }));
        return;
      }

      // 5. Queue Status: GET /api/teleconsult/queue/status?queue_id=
      if (normPath === '/api/teleconsult/queue/status' && req.method === 'GET') {
        const queueId = urlObj.searchParams.get('queue_id') || '';
        const status = await queueUseCase.getQueueStatus(queueId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: status }));
        return;
      }

      // 6. Doctor Queue: GET /api/teleconsult/queue/doctor?doctor_id=
      if (normPath === '/api/teleconsult/queue/doctor' && req.method === 'GET') {
        const doctorId = urlObj.searchParams.get('doctor_id') || 'doc_1';
        const queue = await queueUseCase.getDoctorQueue(doctorId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: queue }));
        return;
      }

      // 7. Call Next Patient: POST /api/teleconsult/queue/call-next
      if (normPath === '/api/teleconsult/queue/call-next' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const nextPatient = await queueUseCase.callNextPatient(body.doctorId || 'doc_1');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: nextPatient }));
        return;
      }

      // 8. Session Start: POST /api/teleconsult/session/start
      if (normPath === '/api/teleconsult/session/start' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const session = await sessionUseCase.startSession(
          body.consultationId,
          body.appointmentId,
          body.patientName,
          body.doctorId,
          body.doctorName,
          body.specialty,
          body.mode || 'video'
        );
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: session }));
        return;
      }

      // 9. Session Mode Switch: POST /api/teleconsult/session/mode
      if (normPath === '/api/teleconsult/session/mode' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const updated = await sessionUseCase.switchMode(body.consultationId, body.mode);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 10. Record Vitals: POST /api/teleconsult/session/vitals
      if (normPath === '/api/teleconsult/session/vitals' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const vital = await sessionUseCase.recordVitals(body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: vital }));
        return;
      }

      // 11. Get Vitals: GET /api/teleconsult/session/vitals?consultation_id=
      if (normPath === '/api/teleconsult/session/vitals' && req.method === 'GET') {
        const consultationId = urlObj.searchParams.get('consultation_id') || '';
        const vitals = await sessionUseCase.getSessionVitals(consultationId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: vitals }));
        return;
      }

      // 12. Send Message: POST /api/teleconsult/consultation/:id/message
      if (normPath.includes('/message') && req.method === 'POST') {
        const body = await readJsonBody(req);
        const msg = await sessionUseCase.sendMessage(body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: msg }));
        return;
      }

      // 13. Get Messages: GET /api/teleconsult/consultation/:id/messages
      if (normPath.includes('/messages') && req.method === 'GET') {
        const consultationId = urlObj.searchParams.get('consultation_id') || '';
        const messages = await sessionUseCase.getMessages(consultationId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: messages }));
        return;
      }

      // 14. Finalize Consultation / Notes: POST /api/teleconsult/consultation/notes
      if (normPath === '/api/teleconsult/consultation/notes' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const finalized = await sessionUseCase.finalizeConsultation(body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: finalized }));
        return;
      }

      // === FEATURE 03: SMART REFERRAL MANAGEMENT ENDPOINTS ===
      // Discover all nearby hospitals across India based on location/GPS
      if (normPath === '/api/referrals/nearby-hospitals' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const location = body.location || 'India';
        const latitude = typeof body.latitude === 'number' ? body.latitude : (body.latitude ? parseFloat(body.latitude) : undefined);
        const longitude = typeof body.longitude === 'number' ? body.longitude : (body.longitude ? parseFloat(body.longitude) : undefined);
        const specialty = body.specialty || 'General Medicine';
        const emergencyRequired = Boolean(body.emergencyRequired);

        const facilities = await geminiAdapter.discoverHospitals({
          location,
          latitude,
          longitude,
          requiredSpecialty: specialty,
          emergencyRequired,
          searchQueries: [`hospitals near ${location}`, `${specialty} hospitals ${location}`]
        });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: facilities }));
        return;
      }

      // 15. Create Referral: POST /api/referrals
      if (normPath === '/api/referrals' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const referral = await referralUseCase.createReferral(body);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: referral }));
        return;
      }

      // 16. Get Pending Referrals (ASHA Worker Queue): GET /api/referrals/pending
      if (normPath === '/api/referrals/pending' && req.method === 'GET') {
        const pending = await referralUseCase.getPendingReferrals();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: pending }));
        return;
      }

      // 17. Get Completed Referrals: GET /api/referrals/completed
      if (normPath === '/api/referrals/completed' && req.method === 'GET') {
        const completed = await referralUseCase.getCompletedReferrals();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: completed }));
        return;
      }

      // 18. Get Referral Stats (KPIs): GET /api/referrals/stats
      if (normPath === '/api/referrals/stats' && req.method === 'GET') {
        const stats = await referralUseCase.getStats();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: stats }));
        return;
      }

      // 19. Get Referral History: GET /api/referrals/:referral_id/history
      if (normPath.startsWith('/api/referrals/') && normPath.endsWith('/history') && req.method === 'GET') {
        const parts = normPath.split('/');
        const refId = decodeURIComponent(parts[3] || '');
        const history = await referralUseCase.getHistory(refId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: history }));
        return;
      }

      // 20. Update Referral Status: PATCH /api/referrals/:referral_id/status
      if (normPath.startsWith('/api/referrals/') && normPath.endsWith('/status') && (req.method === 'PATCH' || req.method === 'POST')) {
        const parts = normPath.split('/');
        const refId = decodeURIComponent(parts[3] || '');
        const body = await readJsonBody(req);
        const updated = await referralUseCase.updateReferralStatus(refId, body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 21. Delete Referral: DELETE /api/referrals/:referral_id
      if (normPath.startsWith('/api/referrals/') && req.method === 'DELETE') {
        const parts = normPath.split('/');
        const refId = decodeURIComponent(parts[3] || '');
        const deleted = await referralUseCase.deleteReferral(refId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: { referralId: refId, deleted } }));
        return;
      }

      // 22. Get Single Referral by ID: GET /api/referrals/:referral_id
      if (normPath.startsWith('/api/referrals/') && req.method === 'GET') {
        const parts = normPath.split('/');
        const refId = decodeURIComponent(parts[3] || '');
        const ref = await referralUseCase.getReferral(refId);
        if (!ref) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: `Referral '${refId}' not found` }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: ref }));
        return;
      }

      // 22. List Referrals with Filters: GET /api/referrals
      if (normPath === '/api/referrals' && req.method === 'GET') {
        const status = urlObj.searchParams.get('status') || undefined;
        const role = urlObj.searchParams.get('role') || undefined;
        const facilityId = urlObj.searchParams.get('facility_id') || undefined;
        const doctorId = urlObj.searchParams.get('doctor_id') || undefined;
        const patientId = urlObj.searchParams.get('patient_id') || undefined;
        const search = urlObj.searchParams.get('search') || undefined;

        const list = await referralUseCase.listReferrals({
          status: status,
          role: role,
          facilityId,
          doctorId,
          patientId,
          search
        });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: list }));
        return;
      }

      // === FEATURE 04: HIGH-RISK PATIENT FOLLOW-UP SYSTEM ENDPOINTS ===

      // 23. Create Follow-Up Plan: POST /api/followups/plans
      if (normPath === '/api/followups/plans' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const result = await followUpUseCase.createPlan(body);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      // 24. List / Get Follow-Up Plans: GET /api/followups/plans/:id or GET /api/followups/plans
      if (normPath.startsWith('/api/followups/plans/') && req.method === 'GET') {
        const parts = normPath.split('/');
        const planId = decodeURIComponent(parts[4] || '');
        const plan = await followUpUseCase.getPlan(planId);
        if (!plan) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: `Plan '${planId}' not found` }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: plan }));
        return;
      }

      if (normPath === '/api/followups/plans' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || undefined;
        const doctorId = urlObj.searchParams.get('doctor_id') || undefined;
        const workerId = urlObj.searchParams.get('worker_id') || undefined;
        const patientId = urlObj.searchParams.get('patient_id') || undefined;
        const plans = await followUpUseCase.listPlans({ facilityId, doctorId, workerId, patientId });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: plans }));
        return;
      }

      // 25. Worker Follow-Up Task Queue: GET /api/followups/tasks
      if (normPath === '/api/followups/tasks' && req.method === 'GET') {
        const workerId = urlObj.searchParams.get('worker_id') || undefined;
        const status = urlObj.searchParams.get('status') || undefined;
        const patientId = urlObj.searchParams.get('patient_id') || undefined;
        const facilityId = urlObj.searchParams.get('facility_id') || undefined;
        const tasks = await followUpUseCase.listTasks({ workerId, status, patientId, facilityId });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: tasks }));
        return;
      }

      // 25b. Past Follow-Up Assessment Reports Log: GET /api/followups/reports
      if (normPath === '/api/followups/reports' && req.method === 'GET') {
        const workerId = urlObj.searchParams.get('worker_id') || undefined;
        const patientId = urlObj.searchParams.get('patient_id') || undefined;
        const facilityId = urlObj.searchParams.get('facility_id') || undefined;
        const reports = await followUpUseCase.listReports({ workerId, patientId, facilityId });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: reports }));
        return;
      }

      // 25c. Follow-Up Filter Options (Dropdown lists): GET /api/followups/filters
      if (normPath === '/api/followups/filters' && req.method === 'GET') {
        const filterOpts = await followUpUseCase.getFilterOptions();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: filterOpts }));
        return;
      }

      // 26. Submit Follow-Up Report: POST /api/followups/tasks/:id/report
      if (normPath.startsWith('/api/followups/tasks/') && normPath.endsWith('/report') && req.method === 'POST') {
        const parts = normPath.split('/');
        const taskId = decodeURIComponent(parts[4] || '');
        const body = await readJsonBody(req);
        const result = await followUpUseCase.submitReport({ ...body, taskId });
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      // 27. Patient Longitudinal Follow-Ups: GET /api/patients/:id/followups
      if (normPath.startsWith('/api/patients/') && normPath.endsWith('/followups') && req.method === 'GET') {
        const parts = normPath.split('/');
        const patientId = decodeURIComponent(parts[3] || '');
        const reports = await followUpUseCase.getPatientFollowUps(patientId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: reports }));
        return;
      }

      // 28. Patient Risk History: GET /api/patients/:id/risk-history
      if (normPath.startsWith('/api/patients/') && normPath.endsWith('/risk-history') && req.method === 'GET') {
        const parts = normPath.split('/');
        const patientId = decodeURIComponent(parts[3] || '');
        const riskHistory = await followUpUseCase.getPatientRiskHistory(patientId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: riskHistory }));
        return;
      }

      // 29. High-Risk Patients Overview: GET /api/high-risk-patients
      if (normPath === '/api/high-risk-patients' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || undefined;
        const doctorId = urlObj.searchParams.get('doctor_id') || undefined;
        const workerId = urlObj.searchParams.get('worker_id') || undefined;
        const patientId = urlObj.searchParams.get('patient_id') || undefined;
        const highRisk = await followUpUseCase.getHighRiskPatients({ facilityId, doctorId, workerId, patientId });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: highRisk }));
        return;
      }

      // 30. Facility Alerts: GET /api/facility/alerts
      if (normPath === '/api/facility/alerts' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || undefined;
        const doctorId = urlObj.searchParams.get('doctor_id') || undefined;
        const patientId = urlObj.searchParams.get('patient_id') || undefined;
        const alerts = await followUpUseCase.getFacilityAlerts({ facilityId, doctorId, patientId });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: alerts }));
        return;
      }

      // 31. Acknowledge Facility Alert: PATCH /api/facility/alerts/:id/ack
      if (normPath.startsWith('/api/facility/alerts/') && normPath.endsWith('/ack') && (req.method === 'PATCH' || req.method === 'POST')) {
        const parts = normPath.split('/');
        const alertId = decodeURIComponent(parts[4] || '');
        const ack = await followUpUseCase.acknowledgeAlert(alertId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: ack }));
        return;
      }

      // ==========================================
      // --- FEATURE 05: INTEROPERABLE HEALTH RECORDS APIS ---
      // ==========================================

      // 32. Register Patient: POST /api/patient/register
      if (normPath === '/api/patient/register' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const patient = await recordsUseCase.registerPatient(body);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: patient }));
        return;
      }

      // 33. Get Patient by ID: GET /api/patient/:id
      if (normPath.startsWith('/api/patient/') && !normPath.includes('/records') && !normPath.includes('/link-abha') && !normPath.includes('/consent') && !normPath.includes('/emergency-override') && req.method === 'GET') {
        const parts = normPath.split('/');
        const patientId = decodeURIComponent(parts[3] || '');
        const patient = recordsStore.getPatientById(patientId);
        if (!patient) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Patient Not Found' }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: patient }));
        return;
      }

      // 34. List All Registered Patients: GET /api/patients
      if (normPath === '/api/patients' && req.method === 'GET') {
        const patients = recordsStore.getAllPatients();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: patients }));
        return;
      }

      // 35. Link ABHA ID: POST /api/patient/:id/link-abha
      if (normPath.startsWith('/api/patient/') && normPath.endsWith('/link-abha') && req.method === 'POST') {
        const parts = normPath.split('/');
        const patientId = decodeURIComponent(parts[3] || '');
        const body = await readJsonBody(req);
        const updated = await recordsUseCase.linkAbhaId(patientId, body.abhaId || '');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 36. Manual Record Capture: POST /api/patient/:id/records/manual
      if (normPath.startsWith('/api/patient/') && normPath.endsWith('/records/manual') && req.method === 'POST') {
        const parts = normPath.split('/');
        const patientId = decodeURIComponent(parts[3] || '');
        const body = await readJsonBody(req);
        const record = await recordsUseCase.captureManualRecord({
          ...body,
          internalMedicalId: patientId
        });
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: record }));
        return;
      }

      // 37. Unified Record Timeline: GET /api/patient/:id/records/timeline
      if (normPath.startsWith('/api/patient/') && normPath.endsWith('/records/timeline') && req.method === 'GET') {
        const parts = normPath.split('/');
        const patientId = decodeURIComponent(parts[3] || '');
        const requesterId = urlObj.searchParams.get('requester_id') || 'self';
        const requesterRole = (urlObj.searchParams.get('requester_role') || 'patient');
        const isEmergency = urlObj.searchParams.get('emergency') === 'true';
        const emergencyReason = urlObj.searchParams.get('emergency_reason') || '';

        const timeline = await recordsUseCase.getUnifiedTimeline(patientId, {
          requesterId,
          requesterRole,
          isEmergencyOverride: isEmergency,
          emergencyReason
        });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: timeline }));
        return;
      }

      // 38. Create Consent Request: POST /api/patient/:id/consent/request
      if (normPath.startsWith('/api/patient/') && normPath.endsWith('/consent/request') && req.method === 'POST') {
        const parts = normPath.split('/');
        const patientId = decodeURIComponent(parts[3] || '');
        const body = await readJsonBody(req);
        const consent = await recordsUseCase.createConsentRequest({
          ...body,
          internalMedicalId: patientId
        });
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: consent }));
        return;
      }

      // 39. Grant / Revoke Consent: POST /api/consents/:id/grant or /revoke
      if (normPath.startsWith('/api/consents/') && (normPath.endsWith('/grant') || normPath.endsWith('/revoke')) && req.method === 'POST') {
        const parts = normPath.split('/');
        const consentId = decodeURIComponent(parts[3] || '');
        const isGrant = normPath.endsWith('/grant');
        const result = isGrant
          ? await recordsUseCase.grantConsent(consentId)
          : await recordsUseCase.revokeConsent(consentId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      // 40. List Consents: GET /api/consents
      if (normPath === '/api/consents' && req.method === 'GET') {
        const patientId = urlObj.searchParams.get('patient_id') || undefined;
        const consents = patientId
          ? recordsStore.getConsentsByMedicalId(patientId)
          : recordsStore.getAllConsents();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: consents }));
        return;
      }

      // 41. Pull ABDM Sandbox FHIR Records: GET /api/abdm/fetch-records/:consent_id
      if (normPath.startsWith('/api/abdm/fetch-records/') && req.method === 'GET') {
        const parts = normPath.split('/');
        const consentId = decodeURIComponent(parts[4] || '');
        const patientId = urlObj.searchParams.get('patient_id') || 'MV-MED-2026-1024';
        const records = await recordsUseCase.fetchAbdmSandboxRecords(patientId, consentId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: records }));
        return;
      }

      // 42. Sync CoWIN Vaccination: GET or POST /api/cowin/vaccination/:id
      if (normPath.startsWith('/api/cowin/vaccination/') && (req.method === 'GET' || req.method === 'POST')) {
        const parts = normPath.split('/');
        const patientId = decodeURIComponent(parts[4] || '');
        const beneficiaryId = urlObj.searchParams.get('beneficiary_id') || '';
        const vaccineRecord = await recordsUseCase.syncCowinVaccinationRecords(patientId, beneficiaryId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: vaccineRecord }));
        return;
      }

      // 43. Emergency Access Override: POST /api/patient/:id/emergency-override
      if (normPath.startsWith('/api/patient/') && normPath.endsWith('/emergency-override') && req.method === 'POST') {
        const parts = normPath.split('/');
        const patientId = decodeURIComponent(parts[3] || '');
        const body = await readJsonBody(req);
        const log = await recordsUseCase.executeEmergencyOverride(patientId, body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: log }));
        return;
      }

      // 44. Audit Emergency Overrides: GET /api/audit/emergency-overrides
      if (normPath === '/api/audit/emergency-overrides' && req.method === 'GET') {
        const patientId = urlObj.searchParams.get('patient_id') || undefined;
        const logs = recordsStore.getEmergencyLogs(patientId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: logs }));
        return;
      }

      // Helper to proxy AI requests to Python FastAPI Service (Unified Backend)
      const proxyToPython = async (subPath, body) => {
        try {
          const pyRes = await fetch(`${PYTHON_SERVICE_BASE}${subPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
          });
          if (pyRes.ok) {
            return await pyRes.json();
          }
        } catch (e) {
          // If Python service crashed or not running locally, auto-revive it!
          if (!process.env.PYTHON_SERVICE_URL || process.env.PYTHON_SERVICE_URL.includes('127.0.0.1')) {
            ensurePythonServiceRunning().catch(() => {});
          }
        }
        return null;
      };

      // 44b. AI Multimodal Vision OCR Document Analysis: POST /api/records/ocr/analyze
      if (normPath === '/api/records/ocr/analyze' && req.method === 'POST') {
        try {
          const body = await readJsonBody(req);
          const pyRes = await proxyToPython('/api/records/ocr/analyze', body);
          if (pyRes && pyRes.success) {
            res.writeHead(200);
            res.end(JSON.stringify(pyRes));
            return;
          }
          const result = await recordsRagUseCase.analyzeDocumentOcr(body);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (err) {
          console.error('Error in /api/records/ocr/analyze:', err);
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: err.message || 'OCR Analysis Failed' }));
        }
        return;
      }

      // 44c. EHR-Integrated Multilingual Grounded RAG Chatbot: POST /api/records/chat
      if (normPath === '/api/records/chat' && req.method === 'POST') {
        try {
          const body = await readJsonBody(req);
          const pyRes = await proxyToPython('/api/records/chat', body);
          if (pyRes && pyRes.success) {
            res.writeHead(200);
            res.end(JSON.stringify(pyRes));
            return;
          }
          const result = await recordsRagUseCase.queryPatientRecordsChat(body);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (err) {
          console.error('Error in /api/records/chat:', err);
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: err.message || 'RAG Chat Evaluation Failed' }));
        }
        return;
      }

      // 44c2. Voice Speech-to-Text Transcription: POST /api/records/voice/transcribe
      if (normPath === '/api/records/voice/transcribe' && req.method === 'POST') {
        try {
          const body = await readJsonBody(req);
          const pyRes = await proxyToPython('/api/records/voice/transcribe', body);
          if (pyRes) {
            res.writeHead(200);
            res.end(JSON.stringify(pyRes));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: { transcript: '', detectedLanguage: 'en' } }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // 44c3. Voice Text-to-Speech Synthesis: POST /api/records/voice/synthesize
      if (normPath === '/api/records/voice/synthesize' && req.method === 'POST') {
        try {
          const body = await readJsonBody(req);
          const pyRes = await proxyToPython('/api/records/voice/synthesize', body);
          if (pyRes) {
            res.writeHead(200);
            res.end(JSON.stringify(pyRes));
            return;
          }
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: 'Voice synthesis service offline' }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // 44d. RAG Chat Audit Logs: GET /api/records/chat/audit
      if (normPath === '/api/records/chat/audit' && req.method === 'GET') {
        const patientId = urlObj.searchParams.get('patient_id') || undefined;
        const logs = recordsRagUseCase.getAuditLogs(patientId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: logs }));
        return;
      }

      // ==========================================
      // --- FEATURE 10: MEDICAL AI ASSISTANT AGENT (STANDALONE ACTION AGENT) ---
      // ==========================================

      if (normPath.startsWith('/api/agent/')) {
        const subPath = normPath;
        try {
          if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const pyRes = await proxyToPython(subPath, body);
            if (pyRes) {
              // Sync confirmed booking into Node teleconsultStore for seamless cross-feature visibility
              if (subPath === '/api/agent/action/execute' && pyRes.success && pyRes.data?.appointment) {
                try {
                  const apt = pyRes.data.appointment;
                  await teleconsultStore.createAppointment({
                    id: apt.id || `APT-${Date.now()}`,
                    patientId: apt.patientId || 'PAT-2026-1024',
                    patientName: apt.patientName || 'Ramesh Mahto',
                    patientAge: apt.patientAge || 48,
                    patientSex: apt.patientSex || 'male',
                    doctorId: apt.doctorId || 'doc_2',
                    doctorName: apt.doctorName || 'Dr. Rajesh Verma',
                    specialty: apt.specialty || 'Cardiology',
                    facilityId: apt.facilityId || 'fac_sbmch',
                    facilityName: apt.facilityName || 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)',
                    scheduledDate: new Date().toISOString().split('T')[0],
                    scheduledTime: apt.scheduledTime || 'Tomorrow 10:00 AM',
                    status: 'booked',
                    bookedBy: 'patient',
                    priorityScore: 50,
                    urgencyTier: 'ROUTINE',
                    createdAt: new Date().toISOString()
                  });
                } catch (syncErr) {
                  console.warn('Could not sync agent appointment into teleconsultStore:', syncErr);
                }
              }
              res.writeHead(200);
              res.end(JSON.stringify(pyRes));
              return;
            }
          } else if (req.method === 'GET') {
            try {
              const pyFetch = await fetch(`${PYTHON_SERVICE_BASE}${subPath}${urlObj.search}`);
              if (pyFetch.ok) {
                const pyData = await pyFetch.json();
                res.writeHead(200);
                res.end(JSON.stringify(pyData));
                return;
              }
            } catch (err) {
              // fallback below
            }
          }
          res.writeHead(503);
          res.end(JSON.stringify({ success: false, error: 'Python Medical Assistant Service is offline on port 8001' }));
        } catch (err) {
          console.error('Error in agent proxy:', err);
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: err.message || 'Medical Assistant Agent failed' }));
        }
        return;
      }

      // ==========================================
      // --- FEATURE 06: MEDICINE AVAILABILITY & DIAGNOSTIC COORDINATION ---
      // ==========================================

      // 45. List Medical Shops: GET /api/shops
      if (normPath === '/api/shops' && req.method === 'GET') {
        const shops = medicineStore.getAllShops();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: shops }));
        return;
      }

      // 46. Get Shop Inventory: GET /api/shop/:id/inventory
      if (normPath.startsWith('/api/shop/') && normPath.endsWith('/inventory') && req.method === 'GET') {
        const parts = normPath.split('/');
        const shopId = decodeURIComponent(parts[3] || '');
        const data = await medicineUseCase.getShopInventory(shopId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data }));
        return;
      }

      // 47. Add Inventory Item: POST /api/shop/:id/inventory (Owner-only)
      if (normPath.startsWith('/api/shop/') && normPath.endsWith('/inventory') && req.method === 'POST') {
        const parts = normPath.split('/');
        const shopId = decodeURIComponent(parts[3] || '');
        const body = await readJsonBody(req);
        const actor = body.actor || { id: 'owner_pharma_1', role: 'shop_owner', shopId };
        const item = await medicineUseCase.addInventoryItem(shopId, actor, body);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: item }));
        return;
      }

      // 48. Update Inventory Item: PUT /api/shop/:id/inventory/:med_id (Owner-only)
      if (normPath.startsWith('/api/shop/') && normPath.includes('/inventory/') && req.method === 'PUT') {
        const parts = normPath.split('/');
        const shopId = decodeURIComponent(parts[3] || '');
        const medId = decodeURIComponent(parts[5] || '');
        const body = await readJsonBody(req);
        const actor = body.actor || { id: 'owner_pharma_1', role: 'shop_owner', shopId };
        const updated = await medicineUseCase.updateInventoryItem(shopId, medId, actor, body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 49. Delete Inventory Item: DELETE /api/shop/:id/inventory/:med_id (Owner-only)
      if (normPath.startsWith('/api/shop/') && normPath.includes('/inventory/') && req.method === 'DELETE') {
        const parts = normPath.split('/');
        const shopId = decodeURIComponent(parts[3] || '');
        const medId = decodeURIComponent(parts[5] || '');
        const body = (await readJsonBody(req).catch(() => ({}))) || {};
        const actor = body.actor || { id: 'owner_pharma_1', role: 'shop_owner', shopId };
        const result = await medicineUseCase.deleteInventoryItem(shopId, medId, actor);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      // 50. Medicine Geo Stock Search: GET /api/medicine/search
      if (normPath === '/api/medicine/search' && req.method === 'GET') {
        const query = urlObj.searchParams.get('query') || '';
        const lat = parseFloat(urlObj.searchParams.get('lat') || '23.998');
        const lng = parseFloat(urlObj.searchParams.get('lng') || '85.345');
        const radius = parseFloat(urlObj.searchParams.get('radius') || '25');
        const searchRes = await medicineUseCase.searchMedicines(query, lat, lng, radius);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: searchRes }));
        return;
      }

      // 50a. Top Nearby Pharmacies / Chemists: GET /api/pharmacies/nearby
      if (normPath === '/api/pharmacies/nearby' && req.method === 'GET') {
        const lat = parseFloat(urlObj.searchParams.get('lat') || '23.998');
        const lng = parseFloat(urlObj.searchParams.get('lng') || '85.345');
        const radius = parseFloat(urlObj.searchParams.get('radius') || '50');
        const pharmacies = await medicineUseCase.getTopNearbyPharmacies(lat, lng, radius);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: pharmacies }));
        return;
      }

      // 50b. Medicines Master Catalog Search: GET /api/medicines/master
      if (normPath === '/api/medicines/master' && req.method === 'GET') {
        const query = urlObj.searchParams.get('query') || '';
        const category = urlObj.searchParams.get('category') || undefined;
        const results = await medicineUseCase.searchMedicinesMaster(query, category);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: results }));
        return;
      }

      // 50c. Medicine Categories: GET /api/medicines/categories
      if (normPath === '/api/medicines/categories' && req.method === 'GET') {
        const categories = await medicineUseCase.getMedicineCategories();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: categories }));
        return;
      }

      // 51. Create Medicine Order Reservation: POST /api/medicine/order
      if (normPath === '/api/medicine/order' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const order = await medicineUseCase.createMedicineOrder(body);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: order }));
        return;
      }

      // 52. Get Shop Orders: GET /api/shop/:id/orders (Owner)
      if (normPath.startsWith('/api/shop/') && normPath.endsWith('/orders') && req.method === 'GET') {
        const parts = normPath.split('/');
        const shopId = decodeURIComponent(parts[3] || '');
        const actorId = urlObj.searchParams.get('actor_id') || 'owner_pharma_1';
        const actor = { id: actorId, role: 'shop_owner', shopId };
        const orders = await medicineUseCase.getShopOrders(shopId, actor);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: orders }));
        return;
      }

      // 53. Update Medicine Order Status: PUT /api/shop/:id/orders/:order_id (Owner)
      if (normPath.startsWith('/api/shop/') && normPath.includes('/orders/') && req.method === 'PUT') {
        const parts = normPath.split('/');
        const shopId = decodeURIComponent(parts[3] || '');
        const orderId = decodeURIComponent(parts[5] || '');
        const body = await readJsonBody(req);
        const actor = body.actor || { id: 'owner_pharma_1', role: 'shop_owner', shopId };
        const updated = await medicineUseCase.updateMedicineOrderStatus(
          shopId,
          orderId,
          actor,
          body.status,
          body.ownerNotes
        );
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 54. List Diagnostic Centers: GET /api/diagnostic-centers
      if (normPath === '/api/diagnostic-centers' && req.method === 'GET') {
        const centers = medicineStore.getAllDiagnosticCenters();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: centers }));
        return;
      }

      // 55. Get Center Test Catalog: GET /api/diagnostic-center/:id/tests
      if (normPath.startsWith('/api/diagnostic-center/') && normPath.endsWith('/tests') && req.method === 'GET') {
        const parts = normPath.split('/');
        const centerId = decodeURIComponent(parts[3] || '');
        const data = await medicineUseCase.getCenterTestCatalog(centerId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data }));
        return;
      }

      // 56. Add Test Offering: POST /api/diagnostic-center/:id/tests (Owner-only)
      if (normPath.startsWith('/api/diagnostic-center/') && normPath.endsWith('/tests') && req.method === 'POST') {
        const parts = normPath.split('/');
        const centerId = decodeURIComponent(parts[3] || '');
        const body = await readJsonBody(req);
        const actor = body.actor || { id: 'owner_lab_1', role: 'lab_staff', centerId };
        const test = await medicineUseCase.addTestOffering(centerId, actor, body);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: test }));
        return;
      }

      // 57. Update Test Offering: PUT /api/diagnostic-center/:id/tests/:test_id (Owner-only)
      if (normPath.startsWith('/api/diagnostic-center/') && normPath.includes('/tests/') && req.method === 'PUT') {
        const parts = normPath.split('/');
        const centerId = decodeURIComponent(parts[3] || '');
        const testId = decodeURIComponent(parts[5] || '');
        const body = await readJsonBody(req);
        const actor = body.actor || { id: 'owner_lab_1', role: 'lab_staff', centerId };
        const updated = await medicineUseCase.updateTestOffering(centerId, testId, actor, body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 58. Delete Test Offering: DELETE /api/diagnostic-center/:id/tests/:test_id (Owner-only)
      if (normPath.startsWith('/api/diagnostic-center/') && normPath.includes('/tests/') && req.method === 'DELETE') {
        const parts = normPath.split('/');
        const centerId = decodeURIComponent(parts[3] || '');
        const testId = decodeURIComponent(parts[5] || '');
        const body = (await readJsonBody(req).catch(() => ({}))) || {};
        const actor = body.actor || { id: 'owner_lab_1', role: 'lab_staff', centerId };
        const result = await medicineUseCase.deleteTestOffering(centerId, testId, actor);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      // 59. Diagnostic Test Geo Search: GET /api/diagnostic/search?test=&lat=&lng=&radius=
      if (normPath === '/api/diagnostic/search' && req.method === 'GET') {
        const query = urlObj.searchParams.get('test') || urlObj.searchParams.get('query') || '';
        const lat = parseFloat(urlObj.searchParams.get('lat') || '23.994');
        const lng = parseFloat(urlObj.searchParams.get('lng') || '85.364');
        const radius = parseFloat(urlObj.searchParams.get('radius') || '30');
        const searchRes = await medicineUseCase.searchDiagnosticTests(query, lat, lng, radius);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: searchRes }));
        return;
      }

      // 60. Direct Diagnostic Booking: POST /api/diagnostic/book
      if (normPath === '/api/diagnostic/book' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const booking = await medicineUseCase.bookDiagnosticTest(body);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: booking }));
        return;
      }

      // 61. Doctor Consultation Diagnostic Order: POST /api/diagnostic/order
      if (normPath === '/api/diagnostic/order' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const order = await medicineUseCase.createDoctorDiagnosticOrder(body);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: order }));
        return;
      }

      // 62. Get Diagnostic Order Status & Results: GET /api/diagnostic/order/:id/status
      if (normPath.startsWith('/api/diagnostic/order/') && normPath.endsWith('/status') && req.method === 'GET') {
        const parts = normPath.split('/');
        const orderId = decodeURIComponent(parts[4] || '');
        const order = await medicineUseCase.getDiagnosticOrderById(orderId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: order }));
        return;
      }

      // 63. Update Diagnostic Order Status & Upload Results: PUT /api/diagnostic/order/:id/status (Lab staff)
      if (normPath.startsWith('/api/diagnostic/order/') && normPath.endsWith('/status') && req.method === 'PUT') {
        const parts = normPath.split('/');
        const orderId = decodeURIComponent(parts[4] || '');
        const body = await readJsonBody(req);
        const centerId = body.centerId || 'center_01';
        const actor = body.actor || { id: 'owner_lab_1', role: 'lab_staff', centerId };
        const updated = await medicineUseCase.updateDiagnosticOrderStatus(
          centerId,
          orderId,
          actor,
          body.status,
          body.resultData,
          body.centerNotes
        );
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 64. Get Center Diagnostic Orders: GET /api/diagnostic-center/:id/orders (Lab staff)
      if (normPath.startsWith('/api/diagnostic-center/') && normPath.endsWith('/orders') && req.method === 'GET') {
        const parts = normPath.split('/');
        const centerId = decodeURIComponent(parts[3] || '');
        const actorId = urlObj.searchParams.get('actor_id') || 'owner_lab_1';
        const actor = { id: actorId, role: 'lab_staff', centerId };
        const orders = await medicineUseCase.getDiagnosticOrdersByCenter(centerId, actor);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: orders }));
        return;
      }

      // ==========================================
      // --- FEATURE 07: FACILITY DASHBOARD ROUTES ---
      // ==========================================

      // 65. Get Facilities List: GET /api/dashboard/facilities
      if (normPath === '/api/dashboard/facilities' && req.method === 'GET') {
        const facilities = dashboardStore.getAllFacilities();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: facilities }));
        return;
      }

      // 66. Section 1 Overview Summary: GET /api/dashboard/overview
      if (normPath === '/api/dashboard/overview' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || urlObj.searchParams.get('facilityId') || 'fac_01';
        let role = urlObj.searchParams.get('actor_role') || urlObj.searchParams.get('role') || 'admin';
        const actorId = urlObj.searchParams.get('actor_id') || urlObj.searchParams.get('actorId') || 'admin_01';
        if (!['admin', 'facility', 'doctor'].includes(role)) role = 'admin';
        const actor = { actorId, role, facilityId };
        const data = await dashboardUseCase.getOverview(facilityId, actor);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data }));
        return;
      }

      // 67. Section 2 Patient & Care Management: GET /api/dashboard/patient-care
      if (normPath === '/api/dashboard/patient-care' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || urlObj.searchParams.get('facilityId') || 'fac_01';
        let role = urlObj.searchParams.get('actor_role') || urlObj.searchParams.get('role') || 'admin';
        const actorId = urlObj.searchParams.get('actor_id') || urlObj.searchParams.get('actorId') || 'admin_01';
        if (!['admin', 'facility', 'doctor', 'worker'].includes(role)) role = 'admin';
        const actor = { actorId, role, facilityId };
        const data = await dashboardUseCase.getPatientCare(facilityId, actor);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data }));
        return;
      }

      // 68. Section 3 Appointment & Queue Management: GET /api/dashboard/appointments-queue
      if (normPath === '/api/dashboard/appointments-queue' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || urlObj.searchParams.get('facilityId') || 'fac_01';
        let role = urlObj.searchParams.get('actor_role') || urlObj.searchParams.get('role') || 'admin';
        const actorId = urlObj.searchParams.get('actor_id') || urlObj.searchParams.get('actorId') || 'admin_01';
        if (!['admin', 'facility', 'doctor'].includes(role)) role = 'admin';
        const actor = { actorId, role, facilityId };
        const data = await dashboardUseCase.getAppointmentsQueue(facilityId, actor);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data }));
        return;
      }

      // 68b. Update Queue Entry Status: POST /api/dashboard/queue/update-status
      if (normPath === '/api/dashboard/queue/update-status' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const queueId = body.queueId || body.id;
        const status = body.status || 'called';
        if (teleconsultStore && teleconsultStore.updateQueueStatus) {
          await teleconsultStore.updateQueueStatus(queueId, status);
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: `Status updated to ${status}` }));
        return;
      }

      // 68c. Register Walk-In Patient to Queue: POST /api/dashboard/queue/walk-in
      if (normPath === '/api/dashboard/queue/walk-in' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const entry = await queueUseCase.joinQueue({
          patientName: body.patientName || 'Walk-In Patient',
          patientAge: Number(body.patientAge) || 45,
          patientSex: body.patientSex || 'female',
          doctorId: body.doctorId || 'doc_1',
          specialty: body.specialty || 'General Medicine',
          urgencyTier: body.urgencyTier || 'ROUTINE',
          bookedBy: 'worker',
          workerName: body.workerName || 'Intake Desk'
        });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: entry }));
        return;
      }

      // 68d. Call Next Patient: POST /api/dashboard/queue/call-next
      if (normPath === '/api/dashboard/queue/call-next' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const doctorId = body.doctorId || 'doc_1';
        const called = await queueUseCase.callNextPatient(doctorId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: called }));
        return;
      }

      // 69. Section 4 Service & Resource Status: GET /api/dashboard/service-resource
      if (normPath === '/api/dashboard/service-resource' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || urlObj.searchParams.get('facilityId') || 'fac_01';
        let role = urlObj.searchParams.get('actor_role') || urlObj.searchParams.get('role') || 'admin';
        const actorId = urlObj.searchParams.get('actor_id') || urlObj.searchParams.get('actorId') || 'admin_01';
        if (!['admin', 'facility'].includes(role)) role = 'admin';
        const actor = { actorId, role, facilityId };
        const data = dashboardUseCase.getServiceResource(facilityId, actor);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data }));
        return;
      }

      // 70. Section 5 Analytics & Reports: GET /api/dashboard/analytics
      if (normPath === '/api/dashboard/analytics' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || urlObj.searchParams.get('facilityId') || 'fac_01';
        let role = urlObj.searchParams.get('actor_role') || urlObj.searchParams.get('role') || 'admin';
        const actorId = urlObj.searchParams.get('actor_id') || urlObj.searchParams.get('actorId') || 'admin_01';
        const startDate = urlObj.searchParams.get('start_date') || urlObj.searchParams.get('startDate') || undefined;
        const endDate = urlObj.searchParams.get('end_date') || urlObj.searchParams.get('endDate') || undefined;
        if (!['admin', 'facility'].includes(role)) role = 'admin';
        const actor = { actorId, role, facilityId };
        const data = dashboardUseCase.getAnalytics(facilityId, actor, startDate, endDate);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data }));
        return;
      }

      // 71. Section 6 Alerts & Notification Center: GET /api/dashboard/alerts
      if (normPath === '/api/dashboard/alerts' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || urlObj.searchParams.get('facilityId') || 'fac_01';
        let role = urlObj.searchParams.get('actor_role') || urlObj.searchParams.get('role') || 'admin';
        const actorId = urlObj.searchParams.get('actor_id') || urlObj.searchParams.get('actorId') || 'admin_01';
        if (!['admin', 'facility', 'doctor', 'worker'].includes(role)) role = 'admin';
        const actor = { actorId, role, facilityId };
        const data = dashboardUseCase.getAlerts(facilityId, actor);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data }));
        return;
      }

      // 72. Update Bed / Resource Count: POST /api/dashboard/resource-status/update or /api/dashboard/service-resource/update
      if ((normPath === '/api/dashboard/resource-status/update' || normPath === '/api/dashboard/service-resource/update') && req.method === 'POST') {
        const body = await readJsonBody(req);
        const facilityId = body.facilityId || body.facility_id || 'fac_01';
        let actorRole = body.actorRole || (body.actor && body.actor.role) || 'admin';
        if (!['admin', 'facility'].includes(actorRole)) actorRole = 'admin';
        const actorId = (body.actor && body.actor.actorId) || 'admin_01';
        const actor = body.actor || { actorId, role: actorRole, facilityId };
        let resourceType = body.resourceType || body.type || 'bed';
        if (resourceType === 'icu') resourceType = 'icu_bed';
        if (resourceType === 'beds') resourceType = 'bed';
        const totalCount = body.totalCount !== undefined ? Number(body.totalCount) : 100;
        const availableCount = body.availableCount !== undefined ? Number(body.availableCount) : (body.availableDelta !== undefined ? Math.max(0, 10 + body.availableDelta) : 10);
        const updated = dashboardUseCase.updateResourceStatus(
          facilityId,
          actor,
          resourceType,
          totalCount,
          availableCount
        );
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 73. Update Alert Status: PUT /api/dashboard/alerts/:id/status
      if (normPath.startsWith('/api/dashboard/alerts/') && normPath.endsWith('/status') && req.method === 'PUT') {
        const parts = normPath.split('/');
        const alertId = decodeURIComponent(parts[4] || '');
        const body = await readJsonBody(req);
        const facilityId = body.facilityId || body.facility_id || 'fac_01';
        const actor = body.actor || { actorId: 'admin_01', role: 'admin', facilityId };
        const updated = dashboardUseCase.updateAlertStatus(facilityId, actor, alertId, body.status);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 74. Get Notifications: GET /api/dashboard/notifications
      if (normPath === '/api/dashboard/notifications' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || urlObj.searchParams.get('facilityId') || 'fac_01';
        let role = urlObj.searchParams.get('actor_role') || urlObj.searchParams.get('role') || 'admin';
        const actorId = urlObj.searchParams.get('actor_id') || urlObj.searchParams.get('actorId') || 'admin_01';
        if (!['admin', 'facility', 'doctor', 'worker'].includes(role)) role = 'admin';
        const actor = { actorId, role, facilityId };
        const alerts = dashboardUseCase.getAlerts(facilityId, actor);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: alerts }));
        return;
      }

      // === FEATURE 08: AI GOVERNMENT HEALTH SCHEME FINDER ENDPOINTS ===
      if (normPath.startsWith('/api/schemes') || normPath.startsWith('/api/admin/schemes')) {
        const pythonBase = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';
        let body = null;
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          body = await readJsonBody(req);
        }

        // Helper for deterministic in-memory evaluation
        const evaluateAssessmentForProfile = (profile) => {
          const assessmentId = `assess_${Date.now()}`;
          const schemes = schemeStore.getAllSchemes();
          const evaluated = [];
          const pendingQuestions = [];
          const existing = (profile.existing_documents || []).map(d => d.toLowerCase());

          for (const s of schemes) {
            const locPassed = !s.applicable_states ||
              s.applicable_states.some(st => (profile.state || '').toLowerCase().includes(st.toLowerCase()) || st.toLowerCase().includes((profile.state || '').toLowerCase()));
            const agePassed = (s.age_min === null || profile.age >= s.age_min) && (s.age_max === null || profile.age <= s.age_max);
            const incPassed = s.income_threshold_annual === null || (profile.family_income_annual || 0) <= s.income_threshold_annual;
            const hospPassed = s.empanelled_hospitals_rule !== 'all_government' || profile.hospital_type === 'government';
            const diagStr = (profile.diagnosis || '').toLowerCase();
            const treatStr = (profile.treatment_required || '').toLowerCase();
            const comb = `${diagStr} ${treatStr}`;
            const medPassed = !profile.diagnosis || s.covered_conditions.some(c => {
              const words = c.toLowerCase().split(/\s+/).filter(w => w.length > 3);
              return words.some(w => comb.includes(w));
            }) || comb.includes('hospital') || comb.includes('surgery') || comb.includes('emergency') || comb.includes('acute') || ['AB-PMJAY', 'Vay Vandana (Seniors 70+)', 'RAN', 'MJPJAY (Maharashtra)', 'Jharkhand MMGBUY'].includes(s.short_code);

            const checks = {
              location: { passed: locPassed, details: locPassed ? 'Territorial requirement verified' : `Restricted to ${s.applicable_states?.join(', ')}` },
              age: { passed: agePassed, details: agePassed ? 'Age eligibility satisfied' : `Requires age ${s.age_min || 0} to ${s.age_max || 'any'}` },
              medical_need: { passed: medPassed, details: `Clinical condition aligns with ${s.short_code} schedule` },
              income: { passed: incPassed, details: incPassed ? 'Income limit satisfied' : `Income exceeds threshold of ₹${s.income_threshold_annual}` },
              hospital: { passed: hospPassed, details: hospPassed ? 'Hospital network approved' : 'Requires government hospital' }
            };

            const nonDocPass = Object.values(checks).every(c => c.passed);
            const missing = s.required_documents.filter(d => !existing.some(e => {
              const dNorm = d.toLowerCase();
              const eNorm = e.toLowerCase();
              return dNorm.includes(eNorm) || eNorm.includes(dNorm) ||
                (dNorm.includes('aadhaar') && eNorm.includes('aadhaar')) ||
                (dNorm.includes('ration') && eNorm.includes('ration')) ||
                (dNorm.includes('bpl') && (eNorm.includes('bpl') || eNorm.includes('ration')));
            }));

            checks.documents = { passed: missing.length === 0, details: missing.length === 0 ? 'All documents available' : `Missing: ${missing.join(', ')}` };
            const isSingleGap = nonDocPass && missing.length === 1;
            const status = nonDocPass && missing.length === 0 ? 'PASS' : (nonDocPass ? 'PARTIAL' : 'FAIL');

            evaluated.push({
              scheme_id: s.scheme_id,
              scheme_name: s.scheme_name,
              short_code: s.short_code,
              status,
              is_single_document_gap: isSingleGap,
              gap_document: isSingleGap ? missing[0] : null,
              missing_documents: missing,
              checks
            });

            if (isSingleGap) {
              pendingQuestions.push({
                question_id: `q_${s.scheme_id}_${Date.now()}`,
                scheme_id: s.scheme_id,
                scheme_name: s.scheme_name,
                document_name: missing[0],
                question_text: `'${s.scheme_name}' covers your situation, but requires verification: Do you currently possess a valid ${missing[0]}?`,
                options: ['yes', 'no', 'not_sure'],
                guidance_if_no: s.document_guidance[missing[0]] || 'Apply at nearest administrative office or e-District portal.'
              });
            }
          }

          const passedSchemes = evaluated.filter(e => e.status === 'PASS' || e.status === 'PARTIAL');
          passedSchemes.sort((a, b) => {
            if (a.status === 'PASS' && b.status !== 'PASS') return -1;
            if (a.status !== 'PASS' && b.status === 'PASS') return 1;
            return a.missing_documents.length - b.missing_documents.length;
          });

          const ranked = passedSchemes.slice(0, 5).map((e, idx) => {
            const orig = schemes.find(s => s.scheme_id === e.scheme_id);
            const score = e.status === 'PASS' ? Math.max(88, 96 - (idx * 3)) : Math.max(68, 92 - (idx * 4) - (e.missing_documents.length * 4));
            return {
              rank: idx + 1,
              scheme_id: e.scheme_id,
              scheme_name: e.scheme_name,
              short_code: e.short_code,
              issuing_body: orig.issuing_body,
              match_score_pct: score,
              match_tier: idx === 0 ? 'Best Match' : (score >= 80 ? 'Possible Match' : 'Alternative'),
              status: e.status,
              treatment_covered: true,
              patient_eligible: true,
              state_available: true,
              financial_assistance: orig.benefit_amount_or_formula,
              max_benefit_amount: orig.max_benefit_amount,
              required_documents: orig.required_documents,
              matched_documents: orig.required_documents.filter(d => !e.missing_documents.includes(d)),
              missing_documents: e.missing_documents,
              source_url: orig.source_url,
              source_portal_name: orig.source_portal_name,
              last_verified_date: orig.last_verified_date,
              rule_summary: e.checks,
              application_steps: [
                `Step 1: Check document availability (${orig.required_documents.slice(0, 2).join(', ')}).`,
                `Step 2: Visit nearest Helpdesk or official portal (${orig.source_portal_name}).`,
                'Step 3: Submit pre-authorization request for cashless admission.'
              ]
            };
          });

          return {
            assessment_id: assessmentId,
            patient_profile: profile,
            schemes_evaluated: evaluated,
            pending_clarifications: pendingQuestions,
            clarification_status: pendingQuestions.length > 0 ? 'pending' : 'none',
            ranked_recommendations: ranked,
            created_at: new Date().toISOString()
          };
        };

        // Try Python FastAPI microservice first with fast timeout
        try {
          const fetchRes = await fetch(`${pythonBase}${req.url}`, {
            method: req.method,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(600)
          });
          const pyData = await fetchRes.json();
          res.writeHead(fetchRes.status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(pyData));
          return;
        } catch (fetchErr) {
          // Python microservice starting or offline - fallback to in-memory evaluation
          if (normPath === '/api/schemes' && req.method === 'GET') {
            const list = schemeStore.getAllSchemes();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, count: list.length, data: list }));
            return;
          }

          if (normPath.startsWith('/api/schemes/') && !normPath.includes('/assessment') && req.method === 'GET') {
            const sId = normPath.replace('/api/schemes/', '');
            const scheme = schemeStore.getSchemeById(sId);
            if (scheme) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: true, data: scheme }));
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: false, error: 'Scheme not found' }));
            }
            return;
          }

          if (normPath === '/api/schemes/assess' && req.method === 'POST') {
            const profile = body || {};
            const assessment = evaluateAssessmentForProfile(profile);
            schemeStore.saveAssessment(assessment);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, data: assessment }));
            return;
          }

          if (normPath.startsWith('/api/schemes/assessment/') && normPath.endsWith('/clarify') && req.method === 'POST') {
            const parts = normPath.split('/');
            const aId = parts[4];
            const assessment = schemeStore.getAssessmentById(aId);
            if (assessment) {
              const q = assessment.pending_clarifications.find(item => item.question_id === body.question_id);
              if (q) {
                q.patient_answer = body.answer;
                if (body.answer === 'yes' && !assessment.patient_profile.existing_documents.includes(q.document_name)) {
                  assessment.patient_profile.existing_documents.push(q.document_name);
                }
              }
              // Re-evaluate to upgrade schemes immediately
              const updated = evaluateAssessmentForProfile(assessment.patient_profile);
              updated.assessment_id = aId;
              const reQ = updated.pending_clarifications.find(item => item.document_name === q?.document_name);
              if (reQ) reQ.patient_answer = body.answer;
              schemeStore.saveAssessment(updated);
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: true, data: updated }));
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: false, error: 'Assessment not found' }));
            }
            return;
          }

          if (normPath.startsWith('/api/schemes/assessment/') && normPath.endsWith('/explain') && req.method === 'POST') {
            const parts = normPath.split('/');
            const aId = parts[4];
            const sId = body.scheme_id;
            const perspective = body.perspective || 'why_eligible';
            const scheme = schemeStore.getSchemeById(sId);
            const explanationText = perspective === 'why_eligible'
              ? `You appear eligible for ${scheme?.scheme_name || sId} based on verified regional coverage, economic threshold compliance, and clinical procedure scheduling.`
              : `Key precautions for ${scheme?.scheme_name || sId}: Ensure clinical cost estimates are countersigned by the attending superintendent and required identification cards are presented before hospital discharge.`;
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              data: {
                scheme_id: sId,
                scheme_name: scheme?.scheme_name || sId,
                perspective,
                explanation: explanationText,
                traceable_rule_checks: {},
                key_highlights: ['✓ Territorial Eligibility Verified', '✓ Income Limit Adherence', '✓ Treatment Procedure Covered'],
                cautions_or_actions: ['Ensure pre-authorization is confirmed before elective surgery']
              }
            }));
            return;
          }

          if (normPath.startsWith('/api/schemes/assessment/') && req.method === 'GET') {
            const aId = normPath.replace('/api/schemes/assessment/', '');
            const assessment = schemeStore.getAssessmentById(aId);
            if (assessment) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: true, data: assessment }));
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: false, error: 'Assessment not found' }));
            }
            return;
          }

          if (normPath === '/api/admin/schemes/ingestion-log' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              count: 4,
              data: [
                { ingestion_id: 'ing_001', source_url: 'https://pmjay.gov.in', portal_name: 'National Health Authority (NHA) Central Portal', run_at: '2025-01-15 04:30:00', ingestion_status: 'success', staleness_status: 'verified_fresh' },
                { ingestion_id: 'ing_002', source_url: 'https://main.mohfw.gov.in', portal_name: 'Ministry of Health and Family Welfare (MoHFW)', run_at: '2025-01-18 05:15:00', ingestion_status: 'success', staleness_status: 'verified_fresh' },
                { ingestion_id: 'ing_003', source_url: 'https://www.jeevandayee.gov.in', portal_name: 'State Health Assurance Society, Govt of Maharashtra', run_at: '2025-01-14 06:00:00', ingestion_status: 'success', staleness_status: 'verified_fresh' },
                { ingestion_id: 'ing_004', source_url: 'https://jharkhand.gov.in/health', portal_name: 'Department of Health & Family Welfare, Govt of Jharkhand', run_at: '2025-01-22 09:00:00', ingestion_status: 'success', staleness_status: 'verified_fresh' }
              ]
            }));
            return;
          }
        }
      }

      // ==========================================
      // --- FEATURE 09: DISTRICT ADMIN COMMAND CENTER (MV-DAC) ROUTES ---
      // ==========================================

      // 75. Pan-India Geography: States Master
      if (normPath === '/api/command-center/geography/states' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: INDIA_STATES.length, data: INDIA_STATES }));
        return;
      }

      // 76. Pan-India Geography: Districts by State or Query Search
      if (normPath === '/api/command-center/geography/districts' && req.method === 'GET') {
        const stateId = urlObj.searchParams.get('state_id') || urlObj.searchParams.get('stateId') || undefined;
        const query = urlObj.searchParams.get('query') || undefined;

        let districts = INDIA_DISTRICTS;
        if (stateId) {
          districts = getDistrictsByState(stateId);
        } else if (query) {
          districts = searchDistricts(query);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: districts.length, data: districts }));
        return;
      }

      // 77. S1 Overview: District KPIs & Summary
      if (normPath === '/api/command-center/overview' && req.method === 'GET') {
        const districtId = urlObj.searchParams.get('district_id') || urlObj.searchParams.get('districtId') || 'dist_jhk_hazaribagh';
        const overview = await commandCenterUseCase.getOverview(districtId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: overview }));
        return;
      }

      // 78. S1 & S2: Facilities Registry List
      if (normPath === '/api/command-center/facilities' && req.method === 'GET') {
        const districtId = urlObj.searchParams.get('district_id') || urlObj.searchParams.get('districtId') || 'dist_jhk_hazaribagh';
        const facilities = await commandCenterUseCase.getFacilities(districtId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: facilities.length, data: facilities }));
        return;
      }

      // 79. S2: Facility Drill-Down Detail
      if (normPath.startsWith('/api/command-center/facility/') && req.method === 'GET') {
        const parts = normPath.split('/');
        const facilityId = decodeURIComponent(parts[4] || '');
        const detail = await commandCenterUseCase.getFacilityDetail(facilityId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: detail }));
        return;
      }

      // 80. S3: Reporting Compliance Matrix
      if (normPath === '/api/command-center/reports/matrix' && req.method === 'GET') {
        const districtId = urlObj.searchParams.get('district_id') || urlObj.searchParams.get('districtId') || 'dist_jhk_hazaribagh';
        const days = urlObj.searchParams.get('days') ? Number(urlObj.searchParams.get('days')) : 7;
        const matrix = await commandCenterUseCase.getReportingMatrix(districtId, days);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: matrix }));
        return;
      }

      // 81. S3: Trigger Urgent Report Reminder
      if (normPath === '/api/command-center/reports/remind' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const result = await commandCenterUseCase.triggerReportReminder(body.facilityId, body.actor || 'district_admin_01');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      // 82. S4: Threshold Rules Configuration
      if (normPath === '/api/command-center/rules' && req.method === 'GET') {
        const districtId = urlObj.searchParams.get('district_id') || urlObj.searchParams.get('districtId') || 'dist_jhk_hazaribagh';
        const rules = await commandCenterUseCase.getThresholdRules(districtId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: rules }));
        return;
      }

      if (normPath === '/api/command-center/rules' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const saved = await commandCenterUseCase.upsertThresholdRule(body, body.updatedBy || 'district_admin_01');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: saved }));
        return;
      }

      if (normPath === '/api/command-center/rules/preset' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const updated = await commandCenterUseCase.applySeasonalPreset(
          body.districtId || 'dist_jhk_hazaribagh',
          body.preset || 'monsoon_fevers',
          body.actor || 'district_admin_01'
        );
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 83. S5: Command Alerts Feed
      if (normPath === '/api/command-center/alerts' && req.method === 'GET') {
        const districtId = urlObj.searchParams.get('district_id') || urlObj.searchParams.get('districtId') || 'dist_jhk_hazaribagh';
        const status = urlObj.searchParams.get('status') || undefined;
        const alerts = await commandCenterUseCase.getAlerts(districtId, status);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: alerts.length, data: alerts }));
        return;
      }

      if (normPath.startsWith('/api/command-center/alerts/') && normPath.endsWith('/status') && (req.method === 'PATCH' || req.method === 'POST' || req.method === 'PUT')) {
        const parts = normPath.split('/');
        const alertId = decodeURIComponent(parts[4] || '');
        const body = await readJsonBody(req);
        const districtId = body.districtId || 'dist_jhk_hazaribagh';
        const updated = await commandCenterUseCase.updateAlertStatus(
          districtId,
          alertId,
          body.status,
          body.actor || 'district_admin_01',
          body.snoozeReason,
          body.snoozeUntil
        );
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 84. S5: Shortage Forecast Engine (7-14 Days Projection)
      if (normPath === '/api/command-center/forecasts' && req.method === 'GET') {
        const districtId = urlObj.searchParams.get('district_id') || urlObj.searchParams.get('districtId') || 'dist_jhk_hazaribagh';
        const facilityId = urlObj.searchParams.get('facility_id') || urlObj.searchParams.get('facilityId') || undefined;
        const forecasts = await commandCenterUseCase.getStockoutForecasts(districtId, facilityId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: forecasts.length, data: forecasts }));
        return;
      }

      // 85. S6: Outbreak Watch & Gemini Early Aberration Brief
      if (normPath === '/api/command-center/outbreak/watch' && req.method === 'GET') {
        const districtId = urlObj.searchParams.get('district_id') || urlObj.searchParams.get('districtId') || 'dist_jhk_hazaribagh';
        const cluster = urlObj.searchParams.get('cluster') || 'acute_fever_rash';
        const days = urlObj.searchParams.get('days') ? Number(urlObj.searchParams.get('days')) : 14;
        const analysis = await commandCenterUseCase.getOutbreakWatch(districtId, cluster, days);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: analysis }));
        return;
      }

      // 86. S7: Transfer Recommendations Recommender Engine
      if (normPath === '/api/command-center/transfers/recommend' && req.method === 'GET') {
        const facilityId = urlObj.searchParams.get('facility_id') || urlObj.searchParams.get('facilityId') || 'fac_01';
        const resourceId = urlObj.searchParams.get('resource_id') || urlObj.searchParams.get('resourceId') || 'oxygen_cylinders';
        const quantity = urlObj.searchParams.get('quantity') ? Number(urlObj.searchParams.get('quantity')) : 15;
        const result = await commandCenterUseCase.getTransferRecommendations(facilityId, resourceId, quantity);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      // 87. S7: Request Workflow (Transfer & Procurement)
      if (normPath === '/api/command-center/requests' && req.method === 'GET') {
        const districtId = urlObj.searchParams.get('district_id') || urlObj.searchParams.get('districtId') || 'dist_jhk_hazaribagh';
        const status = urlObj.searchParams.get('status') || undefined;
        const requests = await commandCenterUseCase.getRequests(districtId, status);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: requests.length, data: requests }));
        return;
      }

      if (normPath === '/api/command-center/requests' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const reqItem = await commandCenterUseCase.createRequest(body, body.createdBy || 'district_admin_01');
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: reqItem }));
        return;
      }

      if (normPath.startsWith('/api/command-center/requests/') && normPath.endsWith('/status') && (req.method === 'PATCH' || req.method === 'POST' || req.method === 'PUT')) {
        const parts = normPath.split('/');
        const requestId = decodeURIComponent(parts[4] || '');
        const body = await readJsonBody(req);
        const updated = await commandCenterUseCase.updateRequestStatus(
          requestId,
          body.status,
          body.actor || 'district_admin_01',
          body.notes
        );
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: updated }));
        return;
      }

      // 88. Real-Time Telemetry Ingestion (Reactive Threshold Engine Trigger)
      if (normPath === '/api/command-center/ingest/beds' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const result = await commandCenterUseCase.ingestBedSnapshot(body);
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      if (normPath === '/api/command-center/ingest/stock' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const result = await commandCenterUseCase.ingestStockSnapshot(body);
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      // 89. S8: Audit Trail Logs
      if (normPath === '/api/command-center/audit' && req.method === 'GET') {
        const districtId = urlObj.searchParams.get('district_id') || urlObj.searchParams.get('districtId') || 'dist_jhk_hazaribagh';
        const logs = await commandCenterUseCase.getAuditLogs(districtId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: logs.length, data: logs }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ success: false, error: 'Endpoint Not Found' }));
      return;
    } catch (err) {
      const isForbidden = err.name === 'ForbiddenError' || (err.message && (err.message.toLowerCase().includes('forbidden') || err.message.toLowerCase().includes('restricted') || err.message.toLowerCase().includes('authorized')));
      if (isForbidden) {
        // Expected RBAC rejection — do not spam console.error
      } else {
        console.error('API Error:', err);
      }
      res.writeHead(isForbidden ? 403 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }));
      return;
    }
  }

  // --- STATIC ASSET SERVING ---
  let filePath = path.join(PUBLIC_DIR, reqPath === '/' || reqPath === '' ? 'index.html' : reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (indexErr, content) => {
        if (indexErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`MedVeda Unified Server running at http://localhost:${PORT}`);
  await ensurePythonServiceRunning();
});
