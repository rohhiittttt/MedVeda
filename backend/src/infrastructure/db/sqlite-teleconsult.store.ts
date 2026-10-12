import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  Doctor,
  Appointment,
  QueueEntry,
  Consultation,
  ConsultationMessage,
  VitalsObservation
} from '../../domain/models/teleconsult.model.ts';
import { sortQueueByPriority } from '../../domain/rules/queue-priority.rules.ts';
import { SEED_DOCTORS, InMemoryTeleconsultStore } from '../cache/teleconsult.cache.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SqliteTeleconsultStore extends InMemoryTeleconsultStore {
  private readonly db: DatabaseSync;

  constructor(dbPath?: string) {
    super();
    const resolvedPath =
      dbPath ||
      (process.env.SQLITE_PERSIST_DISK === 'true'
        ? path.resolve(__dirname, '../../../data/teleconsult.db')
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
      CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        qualification TEXT NOT NULL,
        registration_number TEXT NOT NULL,
        specialties_json TEXT NOT NULL,
        facility_ids_json TEXT NOT NULL,
        availability_windows_json TEXT NOT NULL,
        max_daily_load INTEGER NOT NULL DEFAULT 25,
        is_available_online INTEGER NOT NULL DEFAULT 1,
        current_active_consultations INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS teleconsult_queue (
        id TEXT PRIMARY KEY,
        doctor_id TEXT NOT NULL,
        status TEXT NOT NULL,
        priority_score REAL NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tc_queue_doc ON teleconsult_queue(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_tc_queue_status ON teleconsult_queue(status);

      CREATE TABLE IF NOT EXISTS consultations (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS consultation_messages (
        id TEXT PRIMARY KEY,
        consultation_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tc_msg_cons ON consultation_messages(consultation_id);

      CREATE TABLE IF NOT EXISTS consultation_vitals (
        id TEXT PRIMARY KEY,
        consultation_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tc_vitals_cons ON consultation_vitals(consultation_id);
    `);

    const docCount = this.db.prepare('SELECT COUNT(*) as count FROM doctors').get() as { count: number };
    if (!docCount || docCount.count === 0) {
      const insertDoc = this.db.prepare(`
        INSERT INTO doctors (
          id, name, qualification, registration_number, specialties_json,
          facility_ids_json, availability_windows_json, max_daily_load,
          is_available_online, current_active_consultations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const doc of SEED_DOCTORS) {
        insertDoc.run(
          doc.id,
          doc.name,
          doc.qualification,
          doc.registrationNumber,
          JSON.stringify(doc.specialties),
          JSON.stringify(doc.facilityIds),
          JSON.stringify(doc.availabilityWindows),
          doc.maxDailyLoad,
          doc.isAvailableOnline ? 1 : 0,
          doc.currentActiveConsultations
        );
      }
    }

    const queueCount = this.db.prepare('SELECT COUNT(*) as count FROM teleconsult_queue').get() as {
      count: number;
    };
    if (!queueCount || queueCount.count === 0) {
      const seedQueue: QueueEntry[] = [
        {
          id: 'QUE-SEED-001',
          appointmentId: 'APT-SEED-01',
          patientId: 'PAT-2026-1024',
          patientName: 'Ramesh Mahto',
          patientAge: 54,
          patientSex: 'male',
          doctorId: 'doc_2',
          doctorName: 'Dr. Rajesh Verma',
          specialty: 'Cardiology',
          priorityScore: 92,
          urgencyTier: 'CRITICAL',
          highRiskFlags: ['Severe chest pressure', 'Diaphoresis'],
          bookedBy: 'worker',
          workerName: 'Anita Devi (ASHA)',
          joinedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
          scheduledTime: '10:00 AM',
          status: 'waiting'
        },
        {
          id: 'QUE-SEED-002',
          appointmentId: undefined,
          patientId: 'PAT-2026-2048',
          patientName: 'Sunita Soren',
          patientAge: 46,
          patientSex: 'female',
          doctorId: 'doc_1',
          doctorName: 'Dr. Priya Sharma',
          specialty: 'Neurology',
          priorityScore: 78,
          urgencyTier: 'URGENT',
          highRiskFlags: ['Elevated BP 168/104'],
          bookedBy: 'patient',
          joinedAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
          scheduledTime: 'Walk-In',
          status: 'waiting'
        },
        {
          id: 'QUE-SEED-003',
          appointmentId: 'APT-SEED-02',
          patientId: 'PAT-2026-4112',
          patientName: 'Rekha Devi',
          patientAge: 32,
          patientSex: 'female',
          doctorId: 'doc_4',
          doctorName: 'Dr. Kavita Murmu',
          specialty: 'Obstetrics & Gynecology',
          priorityScore: 65,
          urgencyTier: 'ROUTINE',
          highRiskFlags: ['Antenatal Third Trimester'],
          bookedBy: 'worker',
          workerName: 'Sunita Devi (ASHA)',
          joinedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
          scheduledTime: '10:30 AM',
          status: 'waiting'
        },
        {
          id: 'QUE-SEED-004',
          appointmentId: 'APT-SEED-03',
          patientId: 'PAT-2026-5501',
          patientName: 'Gopal Yadav',
          patientAge: 62,
          patientSex: 'male',
          doctorId: 'doc_gm',
          doctorName: 'Dr. Arvind Sinha',
          specialty: 'General Medicine',
          priorityScore: 50,
          urgencyTier: 'ROUTINE',
          highRiskFlags: [],
          bookedBy: 'patient',
          joinedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
          scheduledTime: '09:30 AM',
          status: 'called'
        }
      ];
      const insertQueue = this.db.prepare(
        'INSERT INTO teleconsult_queue (id, doctor_id, status, priority_score, payload_json) VALUES (?, ?, ?, ?, ?)'
      );
      for (const q of seedQueue) {
        insertQueue.run(q.id, q.doctorId, q.status, q.priorityScore, JSON.stringify(q));
      }
    }
  }

  private mapDoctorRow(row: Record<string, any>): Doctor {
    return {
      id: String(row.id),
      name: String(row.name),
      qualification: String(row.qualification),
      registrationNumber: String(row.registration_number),
      specialties: JSON.parse(String(row.specialties_json || '[]')),
      facilityIds: JSON.parse(String(row.facility_ids_json || '[]')),
      availabilityWindows: JSON.parse(String(row.availability_windows_json || '[]')),
      maxDailyLoad: Number(row.max_daily_load),
      isAvailableOnline: Boolean(row.is_available_online),
      currentActiveConsultations: Number(row.current_active_consultations)
    };
  }

  override async getDoctorRoster(facilityId?: string, specialty?: string): Promise<Doctor[]> {
    const rows = this.db.prepare('SELECT * FROM doctors').all() as Record<string, any>[];
    let list = rows.map((r) => this.mapDoctorRow(r));
    if (facilityId) {
      list = list.filter((d) => d.facilityIds.includes(facilityId));
    }
    if (specialty) {
      const specLower = specialty.toLowerCase().trim();
      list = list.filter((d) =>
        d.specialties.some((s) => {
          const sLower = s.toLowerCase().trim();
          if (sLower === specLower) return true;
          if (specLower.startsWith('general ') && sLower.startsWith('general ')) {
            return specLower === sLower;
          }
          if (specLower.includes('neuro') && sLower.includes('neuro')) {
            const isTargetSurg = specLower.includes('surg');
            const isDocSurg = sLower.includes('surg');
            if (isTargetSurg !== isDocSurg) return false;
          }
          if (specLower === 'ent') {
            return /\bent\b/i.test(sLower) || sLower.includes('otorhinolaryngology') || sLower.includes('ear, nose');
          }
          if (sLower === 'ent') {
            return /\bent\b/i.test(specLower) || specLower.includes('otorhinolaryngology') || specLower.includes('ear, nose');
          }
          if (specLower.includes('uro') && !specLower.includes('neuro') && sLower.includes('neuro')) return false;
          if (sLower.includes('uro') && !sLower.includes('neuro') && specLower.includes('neuro')) return false;
          if (sLower.includes(specLower) || specLower.includes(sLower)) return true;

          const targetTokens = specLower.split(/[\/&]/).map((t) => t.trim()).filter(Boolean);
          const docTokens = sLower.split(/[\/&]/).map((t) => t.trim()).filter(Boolean);
          return targetTokens.some((tt) => docTokens.some((dt) => dt === tt || dt.includes(tt) || tt.includes(dt)));
        })
      );
    }
    return list;
  }

  override async getDoctorById(id: string): Promise<Doctor | undefined> {
    const row = this.db.prepare('SELECT * FROM doctors WHERE id = ?').get(id) as Record<string, any> | undefined;
    return row ? this.mapDoctorRow(row) : undefined;
  }

  override async getAvailableSlots(doctorId?: string, specialty?: string, _date?: string) {
    const docs = await this.getDoctorRoster(undefined, specialty);
    const targetDocs = doctorId ? docs.filter((d) => d.id === doctorId) : docs;
    const apptRows = this.db
      .prepare("SELECT payload_json FROM appointments WHERE status = 'booked'")
      .all() as Array<{ payload_json: string }>;
    const bookedApps = apptRows.map((r) => JSON.parse(r.payload_json) as Appointment);

    const times = [
      '09:00 AM',
      '09:30 AM',
      '10:00 AM',
      '10:30 AM',
      '11:00 AM',
      '11:30 AM',
      '02:00 PM',
      '02:30 PM',
      '03:00 PM',
      '03:30 PM'
    ];
    const result = [];

    for (const doc of targetDocs) {
      const window = doc.availabilityWindows[0] || {
        facilityId: 'fac_sbmch',
        facilityName: 'SBMC&H Hazaribagh'
      };
      for (const t of times) {
        const slotKey = `${doc.id}_${t.replace(/\s/g, '_')}`;
        const isBooked = bookedApps.some(
          (app) => app.doctorId === doc.id && app.scheduledTime.includes(t) && app.status === 'booked'
        );
        result.push({
          slotId: slotKey,
          doctorId: doc.id,
          doctorName: doc.name,
          specialty: doc.specialties[0] || 'General Medicine',
          facilityId: window.facilityId,
          facilityName: window.facilityName,
          timeString: t,
          isAvailable: !isBooked
        });
      }
    }
    return result;
  }

  override async createAppointment(appointment: Appointment): Promise<Appointment> {
    this.db
      .prepare(
        `INSERT INTO appointments (id, payload_json, doctor_id, scheduled_time, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, status = excluded.status`
      )
      .run(
        appointment.id,
        JSON.stringify(appointment),
        appointment.doctorId,
        appointment.scheduledTime,
        appointment.status,
        new Date().toISOString()
      );
    return appointment;
  }

  override async getAppointment(id: string): Promise<Appointment | undefined> {
    const row = this.db
      .prepare('SELECT payload_json FROM appointments WHERE id = ?')
      .get(id) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as Appointment) : undefined;
  }

  override async addToQueue(entry: QueueEntry): Promise<QueueEntry> {
    this.db
      .prepare(
        `INSERT INTO teleconsult_queue (id, doctor_id, status, priority_score, payload_json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, priority_score = excluded.priority_score, payload_json = excluded.payload_json`
      )
      .run(entry.id, entry.doctorId, entry.status, entry.priorityScore, JSON.stringify(entry));
    return entry;
  }

  override async getQueueEntries(doctorId?: string): Promise<QueueEntry[]> {
    const rows = doctorId
      ? (this.db
          .prepare(
            "SELECT payload_json FROM teleconsult_queue WHERE doctor_id = ? AND status IN ('waiting', 'called')"
          )
          .all(doctorId) as Array<{ payload_json: string }>)
      : (this.db
          .prepare("SELECT payload_json FROM teleconsult_queue WHERE status IN ('waiting', 'called')")
          .all() as Array<{ payload_json: string }>);

    const list = rows.map((r) => JSON.parse(r.payload_json) as QueueEntry);
    return sortQueueByPriority(list);
  }

  override async getQueueEntry(id: string): Promise<QueueEntry | undefined> {
    const row = this.db
      .prepare('SELECT payload_json FROM teleconsult_queue WHERE id = ?')
      .get(id) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as QueueEntry) : undefined;
  }

  override async updateQueueStatus(
    id: string,
    status: 'waiting' | 'called' | 'in_consultation' | 'completed'
  ): Promise<void> {
    const existing = await this.getQueueEntry(id);
    if (existing) {
      const updated: QueueEntry = { ...existing, status };
      await this.addToQueue(updated);
    }
  }

  override async saveConsultation(consultation: Consultation): Promise<Consultation> {
    this.db
      .prepare(
        `INSERT INTO consultations (id, payload_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`
      )
      .run(consultation.id, JSON.stringify(consultation), new Date().toISOString());
    return consultation;
  }

  override async getConsultation(id: string): Promise<Consultation | undefined> {
    const row = this.db
      .prepare('SELECT payload_json FROM consultations WHERE id = ?')
      .get(id) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as Consultation) : undefined;
  }

  override async addMessage(message: ConsultationMessage): Promise<ConsultationMessage> {
    this.db
      .prepare(
        `INSERT INTO consultation_messages (id, consultation_id, payload_json, timestamp)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json`
      )
      .run(message.id, message.consultationId, JSON.stringify(message), message.sentAt || new Date().toISOString());
    return message;
  }

  override async getMessages(consultationId: string): Promise<ConsultationMessage[]> {
    const rows = this.db
      .prepare('SELECT payload_json FROM consultation_messages WHERE consultation_id = ? ORDER BY timestamp ASC')
      .all(consultationId) as Array<{ payload_json: string }>;
    return rows.map((r) => JSON.parse(r.payload_json) as ConsultationMessage);
  }

  override async addVitals(vital: VitalsObservation): Promise<VitalsObservation> {
    const id = (vital as any).id || `vit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const recordedAt = (vital as any).recordedAt || (vital as any).timestamp || new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO consultation_vitals (id, consultation_id, payload_json, recorded_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json`
      )
      .run(id, vital.consultationId, JSON.stringify(vital), recordedAt);
    return vital;
  }

  override async getVitals(consultationId: string): Promise<VitalsObservation[]> {
    const rows = this.db
      .prepare('SELECT payload_json FROM consultation_vitals WHERE consultation_id = ? ORDER BY recorded_at ASC')
      .all(consultationId) as Array<{ payload_json: string }>;
    return rows.map((r) => JSON.parse(r.payload_json) as VitalsObservation);
  }
}
