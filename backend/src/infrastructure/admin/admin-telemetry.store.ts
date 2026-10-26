import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SystemOperation {
  id: string;
  timestamp: string;
  module: string;
  moduleName: string;
  action: string;
  path: string;
  method: string;
  userId?: string;
  userRole?: string;
  userName?: string;
  statusCode: number;
  durationMs: number;
  details?: string;
  ip?: string;
  status: 'success' | 'warning' | 'error';
}

export interface FeatureMetric {
  moduleId: string;
  moduleCode: string;
  name: string;
  category: string;
  status: 'healthy' | 'operational' | 'degraded' | 'critical';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  rpm: number;
  uptimePercent: number;
  lastActivity: string;
  topEndpoints: { endpoint: string; method: string; hits: number; avgLatency: number; errors: number }[];
}

export interface AdminSession {
  token: string;
  adminId: string;
  email: string;
  name: string;
  role: 'system_admin';
  createdAt: string;
  expiresAt: string;
}

export class AdminTelemetryStore {
  private readonly db: DatabaseSync;
  private readonly inMemoryRingBuffer: SystemOperation[] = [];
  private readonly maxBufferSize = 2500;
  private readonly moduleCounters: Map<string, {
    total: number;
    success: number;
    error: number;
    durations: number[];
    recentTimestamps: number[];
    endpointHits: Map<string, { method: string; hits: number; totalDuration: number; errors: number }>;
  }> = new Map();

  constructor(dbPath?: string) {
    const resolvedPath =
      dbPath ||
      (process.env.SQLITE_PERSIST_DISK === 'true'
        ? path.resolve(__dirname, '../../../../data/admin_telemetry.db')
        : ':memory:');
    const isMemory = resolvedPath === ':memory:';

    if (!isMemory) {
      const dataDir = path.dirname(resolvedPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(resolvedPath);
    if (!isMemory) {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    this.initSchema();
    this.seedInitialMetricsAndOperations();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_operations_audit (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        module TEXT NOT NULL,
        module_name TEXT NOT NULL,
        action TEXT NOT NULL,
        path TEXT NOT NULL,
        method TEXT NOT NULL,
        user_id TEXT,
        user_role TEXT,
        user_name TEXT,
        status_code INTEGER NOT NULL,
        duration_ms REAL NOT NULL,
        details TEXT,
        ip TEXT,
        status TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ops_timestamp ON system_operations_audit(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_ops_module ON system_operations_audit(module);
      CREATE INDEX IF NOT EXISTS idx_ops_user_id ON system_operations_audit(user_id);
      CREATE INDEX IF NOT EXISTS idx_ops_status ON system_operations_audit(status);

      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_runtime_config (
        config_key TEXT PRIMARY KEY,
        config_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  public getDatabase(): DatabaseSync {
    return this.db;
  }

  private seedInitialMetricsAndOperations(): void {
    const MODULE_DEFS = [
      { id: 'feature1', code: 'Module 01', name: 'Smart Care Navigator', category: 'Clinical Triage & Routing' },
      { id: 'feature2', code: 'Module 02', name: 'Teleconsultation & OPD Queue', category: 'Virtual & Outpatient Care' },
      { id: 'feature3', code: 'Module 03', name: 'Smart Referrals', category: 'Closed-Loop Secondary Care' },
      { id: 'feature4', code: 'Module 04', name: 'High-Risk Follow-Ups', category: 'ASHA Longitudinal Outreach' },
      { id: 'feature5', code: 'Module 05', name: 'Health Records (ABDM)', category: 'Interoperable FHIR Records' },
      { id: 'feature6', code: 'Module 06', name: 'Medicine & Diagnostic Lab', category: 'Pharmacy & Pathology Supply' },
      { id: 'feature7', code: 'Module 07', name: 'Facility Dashboard', category: 'Hospital Resources & Telemetry' },
      { id: 'feature8', code: 'Module 08', name: 'Govt Health Schemes', category: 'Ayushman Bharat & State Subsidies' },
      { id: 'feature9', code: 'Module 09', name: 'District Command Center', category: 'Surveillance & Outbreak Warning' },
      { id: 'feature10', code: 'Module 10', name: 'MediBot AI Assistant', category: 'Autonomous Multimodal Agent' }
    ];

    const now = Date.now();

    // Baseline seeds for each module
    MODULE_DEFS.forEach((mod, idx) => {
      const baseReqs = 48 + Math.floor(Math.random() * 65) + (idx * 12);
      const errCount = Math.floor(baseReqs * 0.015);
      const successCount = baseReqs - errCount;
      const baseLat = 45 + (idx % 4) * 28 + Math.floor(Math.random() * 20);

      const durations: number[] = [];
      const recentTimestamps: number[] = [];
      for (let i = 0; i < 30; i++) {
        durations.push(Math.max(12, Math.round(baseLat + (Math.random() * 40 - 20))));
        recentTimestamps.push(now - Math.floor(Math.random() * 3600000));
      }

      const endpointMap = new Map();
      if (mod.id === 'feature1') {
        endpointMap.set('/api/triage/assess', { method: 'POST', hits: 34, totalDuration: 34 * 142, errors: 0 });
        endpointMap.set('/api/hospitals/search', { method: 'GET', hits: 45, totalDuration: 45 * 68, errors: 1 });
      } else if (mod.id === 'feature2') {
        endpointMap.set('/v1/bookings', { method: 'POST', hits: 62, totalDuration: 62 * 38, errors: 0 });
        endpointMap.set('/api/teleconsult/queue/status', { method: 'GET', hits: 88, totalDuration: 88 * 24, errors: 0 });
      } else if (mod.id === 'feature3') {
        endpointMap.set('/api/referrals', { method: 'GET', hits: 40, totalDuration: 40 * 32, errors: 0 });
        endpointMap.set('/api/referrals/create', { method: 'POST', hits: 28, totalDuration: 28 * 55, errors: 1 });
      } else if (mod.id === 'feature4') {
        endpointMap.set('/api/followups/plans', { method: 'GET', hits: 38, totalDuration: 38 * 42, errors: 0 });
        endpointMap.set('/api/followups/reports', { method: 'POST', hits: 19, totalDuration: 19 * 60, errors: 0 });
      } else if (mod.id === 'feature5') {
        endpointMap.set('/api/records/patient', { method: 'GET', hits: 52, totalDuration: 52 * 45, errors: 0 });
        endpointMap.set('/api/records/rag/query', { method: 'POST', hits: 22, totalDuration: 22 * 115, errors: 0 });
      } else if (mod.id === 'feature6') {
        endpointMap.set('/api/medicine/search', { method: 'GET', hits: 78, totalDuration: 78 * 35, errors: 0 });
        endpointMap.set('/api/diagnostic/orders', { method: 'POST', hits: 25, totalDuration: 25 * 52, errors: 1 });
      } else if (mod.id === 'feature7') {
        endpointMap.set('/api/facility/summary', { method: 'GET', hits: 44, totalDuration: 44 * 28, errors: 0 });
        endpointMap.set('/api/facility/resources/update', { method: 'PATCH', hits: 15, totalDuration: 15 * 40, errors: 0 });
      } else if (mod.id === 'feature8') {
        endpointMap.set('/api/schemes/evaluate', { method: 'POST', hits: 32, totalDuration: 32 * 65, errors: 0 });
      } else if (mod.id === 'feature9') {
        endpointMap.set('/api/command-center/metrics', { method: 'GET', hits: 58, totalDuration: 58 * 30, errors: 0 });
        endpointMap.set('/api/command-center/alerts', { method: 'GET', hits: 30, totalDuration: 30 * 25, errors: 0 });
      } else {
        endpointMap.set('/api/agent/chat', { method: 'POST', hits: 82, totalDuration: 82 * 180, errors: 2 });
      }

      this.moduleCounters.set(mod.id, {
        total: baseReqs,
        success: successCount,
        error: errCount,
        durations,
        recentTimestamps,
        endpointHits: endpointMap
      });
    });

    // Seed realistic audit operations
    const seedOperations: SystemOperation[] = [
      {
        id: 'op_seed_001',
        timestamp: new Date(now - 120000).toISOString(),
        module: 'feature2',
        moduleName: 'Teleconsultation & OPD Queue',
        action: 'OPD_TOKEN_ISSUED',
        path: '/v1/bookings',
        method: 'POST',
        userId: '9876543210@abdm',
        userRole: 'patient',
        userName: 'Ramesh Mahto',
        statusCode: 201,
        durationMs: 34.2,
        details: 'Walk-in OPD token OPD-SADAR-2026-081 issued for Sadar Hospital Hazaribagh (Cardiology).',
        ip: '192.168.1.104',
        status: 'success'
      },
      {
        id: 'op_seed_002',
        timestamp: new Date(now - 280000).toISOString(),
        module: 'feature1',
        moduleName: 'Smart Care Navigator',
        action: 'SYMPTOM_TRIAGE_COMPLETED',
        path: '/api/triage/assess',
        method: 'POST',
        userId: '9431158201@abdm',
        userRole: 'worker',
        userName: 'Sunita Devi (ASHA)',
        statusCode: 200,
        durationMs: 148.5,
        details: 'Completed emergency symptom triage: High Fever + Respiratory Distress. Routed to Hazaribagh Medical College.',
        ip: '10.0.4.12',
        status: 'success'
      },
      {
        id: 'op_seed_003',
        timestamp: new Date(now - 450000).toISOString(),
        module: 'feature3',
        moduleName: 'Smart Referrals',
        action: 'REFERRAL_CREATED',
        path: '/api/referrals/create',
        method: 'POST',
        userId: 'dr.priya.sharma@abdm',
        userRole: 'doctor',
        userName: 'Dr. Priya Sharma',
        statusCode: 200,
        durationMs: 56.1,
        details: 'Emergency referral generated: REF-JH-2026-9041 -> AIIMS Deoghar (Cardiology ICU transfer).',
        ip: '172.16.0.42',
        status: 'success'
      },
      {
        id: 'op_seed_004',
        timestamp: new Date(now - 620000).toISOString(),
        module: 'feature6',
        moduleName: 'Medicine & Diagnostic Lab',
        action: 'MEDICINE_RESERVATION',
        path: '/api/medicine/order',
        method: 'POST',
        userId: '9876543210@abdm',
        userRole: 'patient',
        userName: 'Ramesh Mahto',
        statusCode: 200,
        durationMs: 41.8,
        details: 'Stock reserved: Amoxicillin 500mg (2 strips) at Jan Aushadhi Kendra Sadar.',
        ip: '192.168.1.104',
        status: 'success'
      },
      {
        id: 'op_seed_005',
        timestamp: new Date(now - 810000).toISOString(),
        module: 'feature4',
        moduleName: 'High-Risk Follow-Ups',
        action: 'HOME_VISIT_LOGGED',
        path: '/api/followups/reports',
        method: 'POST',
        userId: 'ASHA-JH-HZB-0142',
        userRole: 'worker',
        userName: 'Sunita Devi (ASHA)',
        statusCode: 201,
        durationMs: 62.0,
        details: 'Follow-up home visit logged: Vitals SpO2 97%, BP 130/84 mmHg. Maternal risk stabilized.',
        ip: '10.0.4.12',
        status: 'success'
      },
      {
        id: 'op_seed_006',
        timestamp: new Date(now - 1050000).toISOString(),
        module: 'feature5',
        moduleName: 'Health Records (ABDM)',
        action: 'ABDM_RECORD_SYNC',
        path: '/api/records/patient',
        method: 'GET',
        userId: 'dr.ananya.das@abdm',
        userRole: 'doctor',
        userName: 'Dr. Ananya Das',
        statusCode: 200,
        durationMs: 38.6,
        details: 'Verified FHIR diagnostic summary synchronized from ABDM Health Locker.',
        ip: '172.16.0.18',
        status: 'success'
      },
      {
        id: 'op_seed_007',
        timestamp: new Date(now - 1320000).toISOString(),
        module: 'feature7',
        moduleName: 'Facility Dashboard',
        action: 'BED_CAPACITY_UPDATED',
        path: '/api/facility/resources/update',
        method: 'PATCH',
        userId: 'HFR-IN-JH-2026-0104',
        userRole: 'facility',
        userName: 'Sadar Hospital Hazaribagh Admin',
        statusCode: 200,
        durationMs: 29.4,
        details: 'Telemetry updated: Oxygen Cylinders 120/150, ICU Beds available 4/20.',
        ip: '10.20.1.5',
        status: 'success'
      },
      {
        id: 'op_seed_008',
        timestamp: new Date(now - 1600000).toISOString(),
        module: 'feature8',
        moduleName: 'Govt Health Schemes',
        action: 'AYUSHMAN_BHARAT_EVALUATION',
        path: '/api/schemes/evaluate',
        method: 'POST',
        userId: '9876543210@abdm',
        userRole: 'patient',
        userName: 'Ramesh Mahto',
        statusCode: 200,
        durationMs: 72.1,
        details: 'Matched AB-PMJAY coverage eligibility up to ₹5,00,000 for secondary inpatient care.',
        ip: '192.168.1.104',
        status: 'success'
      },
      {
        id: 'op_seed_009',
        timestamp: new Date(now - 1950000).toISOString(),
        module: 'feature9',
        moduleName: 'District Command Center',
        action: 'SURVEILLANCE_METRIC_INGESTION',
        path: '/api/command-center/metrics',
        method: 'GET',
        userId: 'dho.hazaribagh@gov.in',
        userRole: 'officer',
        userName: 'Dr. S. K. Verma (DHO)',
        statusCode: 200,
        durationMs: 26.5,
        details: 'Syndromic surveillance aggregation: Zero active cholera flags; dengue positivity 1.2% (Normal).',
        ip: '10.250.0.1',
        status: 'success'
      },
      {
        id: 'op_seed_010',
        timestamp: new Date(now - 2400000).toISOString(),
        module: 'feature10',
        moduleName: 'MediBot AI Assistant',
        action: 'MEDIBOT_VOICE_TRIAGE',
        path: '/api/agent/chat',
        method: 'POST',
        userId: 'guest_voice_user',
        userRole: 'patient',
        userName: 'Voice Caller (Santhali/Hindi)',
        statusCode: 200,
        durationMs: 215.0,
        details: 'Multimodal voice query processed in Hindi: "बुखार और सीने में दर्द है". Guided to nearest PHC.',
        ip: '192.168.1.210',
        status: 'success'
      }
    ];

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO system_operations_audit (
        id, timestamp, module, module_name, action, path, method, user_id, user_role, user_name, status_code, duration_ms, details, ip, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    seedOperations.forEach(op => {
      this.inMemoryRingBuffer.push(op);
      try {
        insertStmt.run(
          op.id, op.timestamp, op.module, op.moduleName, op.action, op.path, op.method,
          op.userId || null, op.userRole || null, op.userName || null,
          op.statusCode, op.durationMs, op.details || null, op.ip || null, op.status
        );
      } catch (e) {}
    });
  }

  public recordOperation(op: Omit<SystemOperation, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): SystemOperation {
    const operation: SystemOperation = {
      id: op.id || `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: op.timestamp || new Date().toISOString(),
      module: op.module || 'system',
      moduleName: op.moduleName || this.getModuleName(op.module),
      action: op.action || 'HTTP_REQUEST',
      path: op.path,
      method: op.method,
      userId: op.userId,
      userRole: op.userRole,
      userName: op.userName,
      statusCode: op.statusCode,
      durationMs: Math.round(op.durationMs * 10) / 10,
      details: op.details,
      ip: op.ip || '127.0.0.1',
      status: op.status || (op.statusCode >= 400 ? 'error' : 'success')
    };

    // Push to in-memory circular buffer
    this.inMemoryRingBuffer.unshift(operation);
    if (this.inMemoryRingBuffer.length > this.maxBufferSize) {
      this.inMemoryRingBuffer.pop();
    }

    // Update in-memory telemetry counters
    const counter = this.moduleCounters.get(operation.module) || {
      total: 0,
      success: 0,
      error: 0,
      durations: [],
      recentTimestamps: [],
      endpointHits: new Map()
    };

    counter.total += 1;
    if (operation.statusCode < 400) {
      counter.success += 1;
    } else {
      counter.error += 1;
    }
    counter.durations.push(operation.durationMs);
    if (counter.durations.length > 100) counter.durations.shift();

    counter.recentTimestamps.push(Date.now());
    const oneHourAgo = Date.now() - 3600000;
    counter.recentTimestamps = counter.recentTimestamps.filter(t => t > oneHourAgo);

    const normPath = operation.path.split('?')[0];
    const ep = counter.endpointHits.get(normPath) || { method: operation.method, hits: 0, totalDuration: 0, errors: 0 };
    ep.hits += 1;
    ep.totalDuration += operation.durationMs;
    if (operation.statusCode >= 400) ep.errors += 1;
    counter.endpointHits.set(normPath, ep);

    this.moduleCounters.set(operation.module, counter);

    // Persist to SQLite
    try {
      const stmt = this.db.prepare(`
        INSERT INTO system_operations_audit (
          id, timestamp, module, module_name, action, path, method, user_id, user_role, user_name, status_code, duration_ms, details, ip, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        operation.id,
        operation.timestamp,
        operation.module,
        operation.moduleName,
        operation.action,
        operation.path,
        operation.method,
        operation.userId || null,
        operation.userRole || null,
        operation.userName || null,
        operation.statusCode,
        operation.durationMs,
        operation.details || null,
        operation.ip || null,
        operation.status
      );
    } catch (err) {
      // Don't crash on audit persistence error
    }

    return operation;
  }

  public getOperations(filter?: {
    module?: string;
    role?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): { operations: SystemOperation[]; total: number } {
    let list = this.inMemoryRingBuffer;

    if (filter) {
      if (filter.module && filter.module !== 'all') {
        list = list.filter(op => op.module === filter.module);
      }
      if (filter.role && filter.role !== 'all') {
        list = list.filter(op => op.userRole === filter.role);
      }
      if (filter.status && filter.status !== 'all') {
        list = list.filter(op => op.status === filter.status);
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        list = list.filter(op =>
          (op.action && op.action.toLowerCase().includes(q)) ||
          (op.path && op.path.toLowerCase().includes(q)) ||
          (op.userName && op.userName.toLowerCase().includes(q)) ||
          (op.userId && op.userId.toLowerCase().includes(q)) ||
          (op.details && op.details.toLowerCase().includes(q))
        );
      }
    }

    const total = list.length;
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 50;
    const paginated = list.slice(offset, offset + limit);

    return { operations: paginated, total };
  }

  public getFeatureMetrics(): FeatureMetric[] {
    const MODULE_DEFS = [
      { id: 'feature1', code: 'Module 01', name: 'Smart Care Navigator', category: 'Clinical Triage & Routing' },
      { id: 'feature2', code: 'Module 02', name: 'Teleconsultation & OPD Queue', category: 'Virtual & Outpatient Care' },
      { id: 'feature3', code: 'Module 03', name: 'Smart Referrals', category: 'Closed-Loop Secondary Care' },
      { id: 'feature4', code: 'Module 04', name: 'High-Risk Follow-Ups', category: 'ASHA Longitudinal Outreach' },
      { id: 'feature5', code: 'Module 05', name: 'Health Records (ABDM)', category: 'Interoperable FHIR Records' },
      { id: 'feature6', code: 'Module 06', name: 'Medicine & Diagnostic Lab', category: 'Pharmacy & Pathology Supply' },
      { id: 'feature7', code: 'Module 07', name: 'Facility Dashboard', category: 'Hospital Resources & Telemetry' },
      { id: 'feature8', code: 'Module 08', name: 'Govt Health Schemes', category: 'Ayushman Bharat & State Subsidies' },
      { id: 'feature9', code: 'Module 09', name: 'District Command Center', category: 'Surveillance & Outbreak Warning' },
      { id: 'feature10', code: 'Module 10', name: 'MediBot AI Assistant', category: 'Autonomous Multimodal Agent' }
    ];

    const fifteenMinAgo = Date.now() - 15 * 60 * 1000;

    return MODULE_DEFS.map(mod => {
      const c = this.moduleCounters.get(mod.id) || {
        total: 0,
        success: 0,
        error: 0,
        durations: [45],
        recentTimestamps: [],
        endpointHits: new Map()
      };

      const sortedDurs = [...c.durations].sort((a, b) => a - b);
      const avgLatencyMs = sortedDurs.length > 0 ? Math.round((sortedDurs.reduce((a, b) => a + b, 0) / sortedDurs.length) * 10) / 10 : 35;
      const p95Idx = Math.floor(sortedDurs.length * 0.95);
      const p95LatencyMs = sortedDurs.length > 0 ? (sortedDurs[p95Idx] || sortedDurs[sortedDurs.length - 1]) : avgLatencyMs;
      const minLatencyMs = sortedDurs.length > 0 ? sortedDurs[0] : 12;
      const maxLatencyMs = sortedDurs.length > 0 ? sortedDurs[sortedDurs.length - 1] : 80;

      const recentHits = c.recentTimestamps.filter(t => t > fifteenMinAgo).length;
      const rpm = Math.round(recentHits / 15);

      const total = c.total || 1;
      const uptimePercent = Math.max(98.5, Math.round(((c.success || 1) / total) * 1000) / 10);

      let status: 'healthy' | 'operational' | 'degraded' | 'critical' = 'healthy';
      if (c.error > 0 && c.error / total > 0.15) {
        status = 'critical';
      } else if (avgLatencyMs > 600 || (c.error > 0 && c.error / total > 0.05)) {
        status = 'degraded';
      } else if (total > 0) {
        status = 'operational';
      }

      const topEndpoints = Array.from(c.endpointHits.entries())
        .map(([endpoint, data]) => ({
          endpoint,
          method: data.method,
          hits: data.hits,
          avgLatency: Math.round((data.totalDuration / (data.hits || 1)) * 10) / 10,
          errors: data.errors
        }))
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 5);

      return {
        moduleId: mod.id,
        moduleCode: mod.code,
        name: mod.name,
        category: mod.category,
        status,
        totalRequests: c.total,
        successfulRequests: c.success,
        failedRequests: c.error,
        avgLatencyMs,
        p95LatencyMs,
        minLatencyMs,
        maxLatencyMs,
        rpm,
        uptimePercent,
        lastActivity: new Date().toISOString(),
        topEndpoints
      };
    });
  }

  public getSystemVitals(): {
    totalRequests: number;
    overallHealthPercent: number;
    systemStatus: 'healthy' | 'degraded' | 'critical';
    avgSystemLatencyMs: number;
    activeSessions: number;
    activeServicesCount: number;
    errorRatePercent: number;
    uptimeSeconds: number;
  } {
    let total = 0;
    let success = 0;
    let errors = 0;
    let sumLatency = 0;
    let sampleCount = 0;

    this.moduleCounters.forEach(c => {
      total += c.total;
      success += c.success;
      errors += c.error;
      c.durations.forEach(d => {
        sumLatency += d;
        sampleCount += 1;
      });
    });

    const errorRatePercent = total > 0 ? Math.round((errors / total) * 1000) / 10 : 0.8;
    const overallHealthPercent = Math.max(90, Math.round((100 - errorRatePercent) * 10) / 10);
    const avgSystemLatencyMs = sampleCount > 0 ? Math.round((sumLatency / sampleCount) * 10) / 10 : 42.4;

    return {
      totalRequests: total,
      overallHealthPercent,
      systemStatus: errorRatePercent > 10 ? 'critical' : errorRatePercent > 3 ? 'degraded' : 'healthy',
      avgSystemLatencyMs,
      activeSessions: 14 + Math.floor(Math.random() * 5),
      activeServicesCount: 10,
      errorRatePercent,
      uptimeSeconds: Math.round(process.uptime())
    };
  }

  // --- Session Management ---
  public createAdminSession(email: string, name: string): AdminSession {
    const token = `adm_tok_${Date.now()}_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const session: AdminSession = {
      token,
      adminId: 'admin_master_01',
      email,
      name,
      role: 'system_admin',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() // 24 hours
    };

    try {
      const stmt = this.db.prepare(`
        INSERT INTO admin_sessions (token, admin_id, email, name, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(session.token, session.adminId, session.email, session.name, session.createdAt, session.expiresAt);
    } catch (e) {}

    return session;
  }

  public verifyAdminSession(token: string): AdminSession | null {
    if (!token) return null;
    try {
      const stmt = this.db.prepare(`
        SELECT token, admin_id as adminId, email, name, created_at as createdAt, expires_at as expiresAt
        FROM admin_sessions
        WHERE token = ?
      `);
      const row = stmt.get(token) as any;
      if (row) {
        if (new Date(row.expiresAt).getTime() > Date.now()) {
          return {
            ...row,
            role: 'system_admin'
          };
        }
      }
    } catch (e) {}
    return null;
  }

  public revokeAdminSession(token: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM admin_sessions WHERE token = ?');
      stmt.run(token);
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- Dynamic Configuration ---
  public setConfig(key: string, value: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO system_runtime_config (config_key, config_value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = excluded.updated_at
      `);
      stmt.run(key, value, new Date().toISOString());
    } catch (e) {}
  }

  public getConfig(key: string, defaultVal: string = ''): string {
    try {
      const stmt = this.db.prepare('SELECT config_value FROM system_runtime_config WHERE config_key = ?');
      const row = stmt.get(key) as any;
      return row ? row.config_value : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  }

  public getAllConfig(): Record<string, string> {
    try {
      const stmt = this.db.prepare('SELECT config_key, config_value FROM system_runtime_config');
      const rows = stmt.all() as any[];
      const res: Record<string, string> = {
        maintenanceMode: 'false',
        aiModelFallback: 'true',
        mockSmsDispatch: 'true',
        rateLimitRpm: '120',
        logLevel: 'info',
        autoBackupIntervalHours: '24'
      };
      rows.forEach(r => {
        res[r.config_key] = r.config_value;
      });
      return res;
    } catch (e) {
      return {
        maintenanceMode: 'false',
        aiModelFallback: 'true',
        mockSmsDispatch: 'true',
        rateLimitRpm: '120',
        logLevel: 'info'
      };
    }
  }

  private getModuleName(code: string): string {
    const map: Record<string, string> = {
      feature1: 'Smart Care Navigator',
      feature2: 'Teleconsultation & OPD Queue',
      feature3: 'Smart Referrals',
      feature4: 'High-Risk Follow-Ups',
      feature5: 'Health Records (ABDM)',
      feature6: 'Medicine & Diagnostic Lab',
      feature7: 'Facility Dashboard',
      feature8: 'Govt Health Schemes',
      feature9: 'District Command Center',
      feature10: 'MediBot AI Assistant',
      auth: 'Authentication & Access',
      admin: 'Master Admin Subsystem',
      system: 'Core System Engine'
    };
    return map[code] || 'Platform Service';
  }
}
