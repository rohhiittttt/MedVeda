import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  PatientProfile,
  HealthRecordItem,
  ConsentRequest,
  EmergencyOverrideLog
} from '../../domain/models/records.model.ts';
import { InMemoryRecordsStore } from '../cache/records.store.ts';
import type { ChatAuditLogItem } from '../../application/use-cases/records-rag.use-case.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SqliteRecordsStore extends InMemoryRecordsStore {
  private readonly db: DatabaseSync;

  constructor(dbPath?: string) {
    super();
    const resolvedPath =
      dbPath ||
      (process.env.SQLITE_PERSIST_DISK === 'true'
        ? path.resolve(__dirname, '../../../data/records.db')
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
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patient_profiles (
        internal_medical_id TEXT PRIMARY KEY,
        abha_id TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_patients_abha ON patient_profiles(abha_id);

      CREATE TABLE IF NOT EXISTS health_records (
        id TEXT PRIMARY KEY,
        internal_medical_id TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_records_med_id ON health_records(internal_medical_id);

      CREATE TABLE IF NOT EXISTS consent_requests (
        consent_id TEXT PRIMARY KEY,
        internal_medical_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_consents_med_id ON consent_requests(internal_medical_id);

      CREATE TABLE IF NOT EXISTS emergency_override_logs (
        id TEXT PRIMARY KEY,
        internal_medical_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rag_audit_logs (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);

    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM patient_profiles').get() as {
      count: number;
    };
    if (!countRow || countRow.count === 0) {
      for (const p of super.getAllPatients()) {
        this.savePatient(p);
        for (const r of super.getRecordsByMedicalId(p.internalMedicalId)) {
          this.saveRecord(r);
        }
      }
      for (const c of super.getAllConsents()) {
        this.saveConsent(c);
      }
    }
  }

  override savePatient(patient: PatientProfile): PatientProfile {
    if (!this.db) return super.savePatient(patient);
    this.db
      .prepare(
        `INSERT INTO patient_profiles (internal_medical_id, abha_id, payload_json, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(internal_medical_id) DO UPDATE SET abha_id = excluded.abha_id, payload_json = excluded.payload_json`
      )
      .run(
        patient.internalMedicalId,
        patient.abhaId ?? null,
        JSON.stringify(patient),
        patient.createdAt || new Date().toISOString()
      );
    return patient;
  }

  override getPatientById(id: string): PatientProfile | undefined {
    if (!this.db) return super.getPatientById(id);
    const direct = this.db
      .prepare('SELECT payload_json FROM patient_profiles WHERE internal_medical_id = ? OR abha_id = ?')
      .get(id, id) as { payload_json: string } | undefined;
    if (direct) return JSON.parse(direct.payload_json) as PatientProfile;

    const all = this.getAllPatients();
    return all.find(
      (p) => p.internalMedicalId === id || p.internalMedicalId.includes(id) || (p.abhaId && p.abhaId === id)
    );
  }

  override getAllPatients(): PatientProfile[] {
    if (!this.db) return super.getAllPatients();
    const rows = this.db
      .prepare('SELECT payload_json FROM patient_profiles ORDER BY created_at DESC')
      .all() as Array<{ payload_json: string }>;
    return rows.map((r) => JSON.parse(r.payload_json) as PatientProfile);
  }

  override linkAbhaId(internalMedicalId: string, abhaId: string): PatientProfile | undefined {
    const patient = this.getPatientById(internalMedicalId);
    if (!patient) return undefined;
    const updated: PatientProfile = { ...patient, abhaId };
    return this.savePatient(updated);
  }

  override saveRecord(record: HealthRecordItem): HealthRecordItem {
    if (!this.db) return super.saveRecord(record);
    this.db
      .prepare(
        `INSERT INTO health_records (id, internal_medical_id, recorded_at, payload_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET recorded_at = excluded.recorded_at, payload_json = excluded.payload_json`
      )
      .run(record.id, record.internalMedicalId, record.recordedAt, JSON.stringify(record));
    return record;
  }

  override getRecordsByMedicalId(internalMedicalId: string): HealthRecordItem[] {
    if (!this.db) return super.getRecordsByMedicalId(internalMedicalId);
    const patient = this.getPatientById(internalMedicalId);
    const targetId = patient ? patient.internalMedicalId : internalMedicalId;

    const rows = this.db
      .prepare(
        'SELECT payload_json FROM health_records WHERE internal_medical_id = ? OR internal_medical_id = ?'
      )
      .all(targetId, internalMedicalId) as Array<{ payload_json: string }>;

    return rows
      .map((r) => JSON.parse(r.payload_json) as HealthRecordItem)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  override getRecordById(recordId: string): HealthRecordItem | undefined {
    if (!this.db) return super.getRecordById(recordId);
    const row = this.db
      .prepare('SELECT payload_json FROM health_records WHERE id = ?')
      .get(recordId) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as HealthRecordItem) : undefined;
  }

  override saveConsent(consent: ConsentRequest): ConsentRequest {
    if (!this.db) return super.saveConsent(consent);
    this.db
      .prepare(
        `INSERT INTO consent_requests (consent_id, internal_medical_id, payload_json)
         VALUES (?, ?, ?)
         ON CONFLICT(consent_id) DO UPDATE SET payload_json = excluded.payload_json`
      )
      .run(consent.consentId, consent.internalMedicalId, JSON.stringify(consent));
    return consent;
  }

  override getConsentById(consentId: string): ConsentRequest | undefined {
    if (!this.db) return super.getConsentById(consentId);
    const row = this.db
      .prepare('SELECT payload_json FROM consent_requests WHERE consent_id = ?')
      .get(consentId) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as ConsentRequest) : undefined;
  }

  override getConsentsByMedicalId(internalMedicalId: string): ConsentRequest[] {
    if (!this.db) return super.getConsentsByMedicalId(internalMedicalId);
    const patient = this.getPatientById(internalMedicalId);
    const targetId = patient ? patient.internalMedicalId : internalMedicalId;
    const rows = this.db
      .prepare(
        'SELECT payload_json FROM consent_requests WHERE internal_medical_id = ? OR internal_medical_id = ?'
      )
      .all(targetId, internalMedicalId) as Array<{ payload_json: string }>;
    return rows.map((r) => JSON.parse(r.payload_json) as ConsentRequest);
  }

  override getAllConsents(): ConsentRequest[] {
    if (!this.db) return super.getAllConsents();
    const rows = this.db
      .prepare('SELECT payload_json FROM consent_requests')
      .all() as Array<{ payload_json: string }>;
    return rows.map((r) => JSON.parse(r.payload_json) as ConsentRequest);
  }

  override logEmergencyOverride(log: EmergencyOverrideLog): EmergencyOverrideLog {
    if (!this.db) return super.logEmergencyOverride(log);
    this.db
      .prepare(
        `INSERT INTO emergency_override_logs (id, internal_medical_id, payload_json, timestamp)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json`
      )
      .run(log.id, log.internalMedicalId, JSON.stringify(log), log.timestamp || new Date().toISOString());
    return log;
  }

  override getEmergencyLogs(internalMedicalId?: string): EmergencyOverrideLog[] {
    if (!this.db) return super.getEmergencyLogs(internalMedicalId);
    const rows = internalMedicalId
      ? (this.db
          .prepare(
            'SELECT payload_json FROM emergency_override_logs WHERE internal_medical_id = ? ORDER BY timestamp DESC'
          )
          .all(internalMedicalId) as Array<{ payload_json: string }>)
      : (this.db
          .prepare('SELECT payload_json FROM emergency_override_logs ORDER BY timestamp DESC')
          .all() as Array<{ payload_json: string }>);
    return rows.map((r) => JSON.parse(r.payload_json) as EmergencyOverrideLog);
  }

  saveRagAuditLog(item: ChatAuditLogItem): ChatAuditLogItem {
    this.db
      .prepare(
        `INSERT INTO rag_audit_logs (id, patient_id, payload_json, timestamp)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json`
      )
      .run(item.id, item.patientId, JSON.stringify(item), item.timestamp);
    return item;
  }

  getRagAuditLogs(patientId?: string, limit = 50): ChatAuditLogItem[] {
    const rows = patientId
      ? (this.db
          .prepare('SELECT payload_json FROM rag_audit_logs WHERE patient_id = ? ORDER BY timestamp DESC LIMIT ?')
          .all(patientId, limit) as Array<{ payload_json: string }>)
      : (this.db
          .prepare('SELECT payload_json FROM rag_audit_logs ORDER BY timestamp DESC LIMIT ?')
          .all(limit) as Array<{ payload_json: string }>);
    return rows.map((r) => JSON.parse(r.payload_json) as ChatAuditLogItem);
  }
}
