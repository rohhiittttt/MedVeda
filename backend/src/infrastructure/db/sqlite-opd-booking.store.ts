import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_HOLD_TTL_MS,
  DEFAULT_SMS_QUOTA_RATIO,
  generateConfirmCode,
  generateTrackingId,
  hashConfirmCode,
  hashMsisdn,
  maskName,
  maskPhoneLast4,
  normalizeChannel,
  normalizeCrockford,
  normalizeMsisdn,
  signQrPayload,
  validateTrackingId,
  verifyQrPayload,
  type AdminQueueSnapshot,
  type AuditEventRecord,
  type BookingChannel,
  type BookingRecord,
  type BookingStatus,
  type CounterLookupResult,
  type DepartmentRecord,
  type FacilityRecord,
  type PatientRecord,
  type SessionPeriod,
  type SessionSlotRecord,
  type SmsDirection,
  type SmsMessageRecord,
  type SmsParseResult,
  type StaffRole,
  type StaffUserRecord,
} from '../../../../packages/contracts/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CreateBookingInput {
  facilityCode?: string;
  facilityId?: string;
  deptCode?: string;
  departmentId?: string;
  sessionId?: string;
  date?: string;
  session?: SessionPeriod;
  phone: string;
  patientName?: string | null;
  abhaAddress?: string | null;
  abhaNumberHash?: string | null;
  abhaVerified?: boolean;
  channel?: BookingChannel | string;
  mode?: 'HOLD' | 'IMMEDIATE_CONFIRM';
  holdTtlMs?: number;
  allowReservedQuota?: boolean;
  trackingIdSeed?: string;
  customConfirmCode?: string;
  actorId?: string;
}

export class OpdBookingError extends Error {
  public code: string;
  public statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'OpdBookingError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function getTodayIstDateString(now: Date = new Date()): string {
  // IST is UTC + 5:30
  const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return istTime.toISOString().slice(0, 10);
}

export function computeReportingWindow(
  session: SessionPeriod,
  tokenNumber: number | null
): string {
  const token = tokenNumber && tokenNumber > 0 ? tokenNumber : 1;
  if (session === 'AFTERNOON') {
    const slotOffsetHours = Math.min(2, Math.floor((token - 1) / 15));
    const startHour24 = 14 + slotOffsetHours;
    const endHour24 = startHour24 + 1;
    const fmt = (h: number) => `${h > 12 ? h - 12 : h}:00 PM`;
    return `${fmt(startHour24)}-${fmt(endHour24)}`;
  }
  if (session === 'EVENING') {
    return '05:00-06:30 PM';
  }
  // MORNING: 09:00 - 13:00 staggered in 1-hour windows (or 09:30-10:30 AM around token ~27)
  if (token >= 20 && token <= 35) {
    return '09:30-10:30 AM';
  }
  const slotOffsetHours = Math.min(3, Math.floor((token - 1) / 20));
  const startHour = 9 + slotOffsetHours;
  const endHour = startHour + 1;
  const fmtHour = (h: number) => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h;
    return `${String(h12).padStart(2, '0')}:00 ${suffix}`;
  };
  return `${fmtHour(startHour)}-${fmtHour(endHour)}`;
}

export class SqliteOpdBookingStore {
  private db: DatabaseSync;
  private txDepth: number;

  constructor(dbPath?: string) {
    this.txDepth = 0;
    const resolvedPath =
      dbPath ||
      (process.env.SQLITE_PERSIST_DISK === 'true'
        ? path.resolve(__dirname, '../../../data/medveda_opd.sqlite')
        : ':memory:');

    if (resolvedPath !== ':memory:') {
      const dataDir = path.dirname(resolvedPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(resolvedPath);
    if (resolvedPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.initSchema();
    this.seedDefaultsIfEmpty();
  }

  public getDatabase(): DatabaseSync {
    return this.db;
  }

  public close(): void {
    this.db.close();
  }

  /**
   * Executes a synchronous callback inside an atomic SQLite `BEGIN IMMEDIATE` transaction.
   * Re-entrant safe if called inside an already active transaction.
   */
  public runInTransaction<T>(fn: () => T): T {
    if (this.txDepth > 0) {
      return fn();
    }
    this.txDepth++;
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      this.txDepth--;
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // ignore rollback error if already rolled back
      }
      this.txDepth--;
      throw err;
    }
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS facilities (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        short_name TEXT,
        district TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'Jharkhand',
        type TEXT NOT NULL DEFAULT 'DISTRICT_HOSPITAL',
        address TEXT,
        geo TEXT,
        latitude REAL,
        longitude REAL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_facilities_code ON facilities(code);
      CREATE INDEX IF NOT EXISTS idx_facilities_district ON facilities(district, active);

      CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        facility_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        daily_capacity INTEGER NOT NULL DEFAULT 80,
        morning_hours TEXT NOT NULL DEFAULT '09:00-13:00',
        afternoon_hours TEXT NOT NULL DEFAULT '14:00-17:00',
        room_number TEXT NOT NULL DEFAULT 'OPD-101',
        active INTEGER NOT NULL DEFAULT 1,
        UNIQUE(facility_id, code),
        FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_departments_facility ON departments(facility_id, active);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        facility_id TEXT NOT NULL,
        department_id TEXT NOT NULL,
        date TEXT NOT NULL,
        session TEXT NOT NULL DEFAULT 'MORNING',
        start TEXT NOT NULL DEFAULT '09:00',
        end TEXT NOT NULL DEFAULT '13:00',
        capacity INTEGER NOT NULL DEFAULT 50,
        walkin_reserve INTEGER NOT NULL DEFAULT 13,
        booked_count INTEGER NOT NULL DEFAULT 0,
        held_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'OPEN',
        UNIQUE(department_id, date, session),
        FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_lookup ON sessions(facility_id, department_id, date);

      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        msisdn TEXT UNIQUE NOT NULL,
        msisdn_hash TEXT NOT NULL,
        phone_last4 TEXT NOT NULL,
        name TEXT,
        abha_address TEXT,
        abha_number_hash TEXT,
        preferred_lang TEXT NOT NULL DEFAULT 'en',
        consent_at TEXT,
        blocked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_patients_msisdn_hash ON patients(msisdn_hash);

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        tracking_id TEXT UNIQUE NOT NULL,
        tracking_id_raw TEXT NOT NULL,
        facility_id TEXT NOT NULL,
        department_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        slot_date TEXT NOT NULL,
        session_period TEXT NOT NULL DEFAULT 'MORNING',
        reporting_window TEXT NOT NULL DEFAULT '09:30-10:30 AM',
        token_no INTEGER,
        estimated_token_no INTEGER,
        channel TEXT NOT NULL DEFAULT 'WEB',
        status TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
        state TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
        hold_expires_at TEXT,
        confirm_code TEXT,
        confirm_code_hash TEXT,
        qr_payload TEXT,
        abha_verified INTEGER NOT NULL DEFAULT 0,
        cancel_reason TEXT,
        created_at TEXT NOT NULL,
        confirmed_at TEXT,
        arrived_at TEXT,
        cancelled_at TEXT,
        completed_at TEXT,
        FOREIGN KEY (facility_id) REFERENCES facilities(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (patient_id) REFERENCES patients(id)
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_session_status ON bookings(session_id, status);
      CREATE INDEX IF NOT EXISTS idx_bookings_patient_created ON bookings(patient_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_bookings_tracking_id ON bookings(tracking_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_tracking_raw ON bookings(tracking_id_raw);
      CREATE INDEX IF NOT EXISTS idx_bookings_patient_dept_date ON bookings(patient_id, department_id, slot_date);

      CREATE TABLE IF NOT EXISTS token_counters (
        session_id TEXT PRIMARY KEY,
        last_token INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sms_inbox (
        id TEXT PRIMARY KEY,
        provider_msg_id TEXT UNIQUE NOT NULL,
        provider TEXT NOT NULL DEFAULT 'simulator',
        msisdn TEXT NOT NULL,
        body TEXT NOT NULL,
        received_at TEXT NOT NULL,
        parsed_json TEXT,
        booking_id TEXT,
        status TEXT NOT NULL DEFAULT 'PROCESSED'
      );

      CREATE INDEX IF NOT EXISTS idx_sms_inbox_provider_msg_id ON sms_inbox(provider_msg_id);
      CREATE INDEX IF NOT EXISTS idx_sms_inbox_msisdn ON sms_inbox(msisdn, received_at);

      CREATE TABLE IF NOT EXISTS sms_outbox (
        id TEXT PRIMARY KEY,
        booking_id TEXT,
        msisdn TEXT NOT NULL,
        template_id TEXT NOT NULL DEFAULT 'OPD_GENERIC',
        rendered TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'simulator',
        provider_msg_id TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'SENT',
        dlr_status TEXT,
        attempts INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sms_outbox_provider_msg_id ON sms_outbox(provider_msg_id);
      CREATE INDEX IF NOT EXISTS idx_sms_outbox_booking_id ON sms_outbox(booking_id);

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        actor_type TEXT NOT NULL DEFAULT 'SYSTEM',
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_events(at);

      CREATE TABLE IF NOT EXISTS staff_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        facility_id TEXT,
        role TEXT NOT NULL DEFAULT 'COUNTER',
        pin_hash TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_staff_facility_role ON staff_users(facility_id, role);
    `);
  }

  private seedDefaultsIfEmpty(): void {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM facilities').get() as { cnt: number };
    if (row && row.cnt > 0) {
      return;
    }

    const nowIso = new Date().toISOString();

    const facilitiesSeed = [
      {
        id: 'fac_dhj01',
        code: 'DHJ01',
        name: 'District Hospital Jamshedpur',
        shortName: 'DH Jamshedpur',
        district: 'Jamshedpur',
        state: 'Jharkhand',
        type: 'DISTRICT_HOSPITAL',
        address: 'Sakchi, Jamshedpur, East Singhbhum',
        lat: 22.8046,
        lng: 86.2029,
        aliases: ['jamshedpur', 'east singhbhum', 'jaipur', 'rajasthan', 'dh jamshedpur', 'district hospital jaipur'],
      },
      {
        id: 'fac_sbmc01',
        code: 'SBMC01',
        name: 'Sheikh Bhikhari Medical College & Hospital',
        shortName: 'SBMC Hazaribagh',
        district: 'Hazaribagh',
        state: 'Jharkhand',
        type: 'MEDICAL_COLLEGE',
        address: 'NH-33, Hazaribagh',
        lat: 23.9929,
        lng: 85.3637,
        aliases: ['hazaribagh', 'sbmc', 'jaipur', 'sms medical college', 'sbmch'],
      },
      {
        id: 'fac_sdh01',
        code: 'SDH01',
        name: 'Sadar Hospital Hazaribagh',
        shortName: 'Sadar Hazaribagh',
        district: 'Hazaribagh',
        state: 'Jharkhand',
        type: 'SUB_DISTRICT_HOSPITAL',
        address: 'Civil Lines, Hazaribagh',
        lat: 23.9966,
        lng: 85.3691,
        aliases: ['hazaribagh', 'sadar', 'sikar', 'sub-district hospital sikar'],
      },
      {
        id: 'fac_rims01',
        code: 'RIMS01',
        name: 'Rajendra Institute of Medical Sciences',
        shortName: 'RIMS Ranchi',
        district: 'Ranchi',
        state: 'Jharkhand',
        type: 'MEDICAL_COLLEGE',
        address: 'Bariatu, Ranchi, Jharkhand',
        lat: 23.3911,
        lng: 85.3484,
        aliases: ['ranchi', 'rims', 'rims ranchi', 'jharkhand'],
      },
      {
        id: 'fac_chc01',
        code: 'CHC01',
        name: 'Community Health Centre Katkamsandi',
        shortName: 'CHC Katkamsandi',
        district: 'Hazaribagh',
        state: 'Jharkhand',
        type: 'CHC',
        address: 'Katkamsandi Block, Hazaribagh',
        lat: 24.0412,
        lng: 85.2741,
        aliases: ['katkamsandi', 'hazaribagh', 'sanganer', 'jaipur', 'chc sanganer'],
      },
    ];

    const departmentsTemplate = [
      { code: 'MED', name: 'General Medicine', dailyCapacity: 100, roomNumber: 'OPD-101' },
      { code: 'CAR', name: 'Cardiology', dailyCapacity: 60, roomNumber: 'OPD-201' },
      { code: 'NEU', name: 'Neurology', dailyCapacity: 50, roomNumber: 'OPD-204' },
      { code: 'PED', name: 'Pediatrics', dailyCapacity: 80, roomNumber: 'OPD-105' },
      { code: 'ORT', name: 'Orthopedics', dailyCapacity: 70, roomNumber: 'OPD-110' },
      { code: 'GYN', name: 'Gynecology & Obstetrics', dailyCapacity: 80, roomNumber: 'OPD-112' },
      { code: 'ENT', name: 'Ear Nose Throat', dailyCapacity: 60, roomNumber: 'OPD-115' },
      { code: 'OPH', name: 'Ophthalmology', dailyCapacity: 60, roomNumber: 'OPD-118' },
    ];

    const insertFacility = this.db.prepare(`
      INSERT INTO facilities (
        id, code, name, short_name, district, state, type, address, geo, latitude, longitude, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const insertDept = this.db.prepare(`
      INSERT INTO departments (
        id, facility_id, code, name, daily_capacity, morning_hours, afternoon_hours, room_number, active
      ) VALUES (?, ?, ?, ?, ?, '09:00-13:00', '14:00-17:00', ?, 1)
    `);

    this.runInTransaction(() => {
      for (const fac of facilitiesSeed) {
        const geoJson = JSON.stringify({
          lat: fac.lat,
          lng: fac.lng,
          address: fac.address,
          aliases: fac.aliases,
        });
        insertFacility.run(
          fac.id,
          fac.code,
          fac.name,
          fac.shortName,
          fac.district,
          fac.state,
          fac.type,
          fac.address,
          geoJson,
          fac.lat,
          fac.lng,
          nowIso
        );

        for (const dept of departmentsTemplate) {
          const deptId = `dept_${fac.code.toLowerCase()}_${dept.code.toLowerCase()}`;
          insertDept.run(
            deptId,
            fac.id,
            dept.code,
            dept.name,
            dept.dailyCapacity,
            dept.roomNumber
          );
        }
      }

      // Seed default staff users
      const insertStaff = this.db.prepare(`
        INSERT INTO staff_users (id, username, display_name, facility_id, role, pin_hash, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `);
      insertStaff.run(
        'staff_counter_dhj01',
        'counter-dhj01',
        'OPD Counter Clerk (DHJ01)',
        'fac_dhj01',
        'COUNTER',
        hashConfirmCode('1234'),
        nowIso
      );
      insertStaff.run(
        'staff_supervisor_dhj01',
        'supervisor-dhj01',
        'OPD Supervisor (DHJ01)',
        'fac_dhj01',
        'SUPERVISOR',
        hashConfirmCode('5678'),
        nowIso
      );
      insertStaff.run(
        'staff_admin_medveda',
        'admin-medveda',
        'MedVeda System Admin',
        null,
        'ADMIN',
        hashConfirmCode('9999'),
        nowIso
      );
    });

    // Provision sessions for today and next 7 days across all facilities & departments
    const baseDate = new Date();
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const d = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dateStr = getTodayIstDateString(d);
      for (const fac of facilitiesSeed) {
        for (const dept of departmentsTemplate) {
          this.ensureSessionsForDate(fac.code, dept.code, dateStr);
        }
      }
    }
  }

  // ============================================================================
  // FACILITIES & DEPARTMENTS
  // ============================================================================

  public listFacilities(filter?: {
    district?: string;
    search?: string;
    activeOnly?: boolean;
  }): FacilityRecord[] {
    let sql = 'SELECT * FROM facilities WHERE 1=1';
    const params: any[] = [];

    if (filter?.activeOnly !== false) {
      sql += ' AND active = 1';
    }

    if (filter?.district) {
      const distTerm = filter.district.trim().toLowerCase();
      sql += ' AND (LOWER(district) = ? OR LOWER(state) = ? OR LOWER(geo) LIKE ?)';
      params.push(distTerm, distTerm, `%${distTerm}%`);
    }

    if (filter?.search) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      sql +=
        ' AND (LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(short_name) LIKE ? OR LOWER(district) LIKE ? OR LOWER(geo) LIKE ?)';
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY code ASC';
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapFacilityRow(r));
  }

  public getFacilityByCodeOrId(codeOrId: string): FacilityRecord | null {
    if (!codeOrId) return null;
    const clean = codeOrId.trim();
    const row = this.db
      .prepare('SELECT * FROM facilities WHERE UPPER(code) = UPPER(?) OR id = ?')
      .get(clean, clean) as any;
    return row ? this.mapFacilityRow(row) : null;
  }

  public listDepartments(facilityCodeOrId: string): DepartmentRecord[] {
    const facility = this.getFacilityByCodeOrId(facilityCodeOrId);
    if (!facility) return [];

    const rows = this.db
      .prepare('SELECT * FROM departments WHERE facility_id = ? AND active = 1 ORDER BY code ASC')
      .all(facility.id) as any[];

    return rows.map((r) => this.mapDepartmentRow(r, facility.code));
  }

  public getDepartment(
    facilityCodeOrId: string,
    deptCodeOrId: string
  ): DepartmentRecord | null {
    if (!deptCodeOrId) return null;
    const cleanDept = deptCodeOrId.trim();

    if (facilityCodeOrId) {
      const facility = this.getFacilityByCodeOrId(facilityCodeOrId);
      if (!facility) return null;
      const row = this.db
        .prepare(
          'SELECT * FROM departments WHERE facility_id = ? AND (UPPER(code) = UPPER(?) OR id = ?)'
        )
        .get(facility.id, cleanDept, cleanDept) as any;
      return row ? this.mapDepartmentRow(row, facility.code) : null;
    }

    const row = this.db
      .prepare(
        `SELECT d.*, f.code as facility_code
         FROM departments d
         JOIN facilities f ON f.id = d.facility_id
         WHERE d.id = ? OR UPPER(d.code) = UPPER(?)
         LIMIT 1`
      )
      .get(cleanDept, cleanDept) as any;
    return row ? this.mapDepartmentRow(row, row.facility_code) : null;
  }

  // ============================================================================
  // SESSIONS & HOLD EXPIRY
  // ============================================================================

  /**
   * Expires all `PENDING_CONFIRMATION` holds whose `hold_expires_at <= nowIso`,
   * releasing their held capacity back to the session pool and recording audit events.
   */
  public expireStaleHolds(nowIso: string = new Date().toISOString()): number {
    return this.runInTransaction(() => {
      const staleRows = this.db
        .prepare(
          `SELECT id, session_id, tracking_id, patient_id
           FROM bookings
           WHERE status = 'PENDING_CONFIRMATION'
             AND hold_expires_at IS NOT NULL
             AND hold_expires_at <= ?`
        )
        .all(nowIso) as Array<{
        id: string;
        session_id: string;
        tracking_id: string;
        patient_id: string;
      }>;

      if (staleRows.length === 0) {
        return 0;
      }

      const updateBooking = this.db.prepare(
        `UPDATE bookings
         SET status = 'EXPIRED', state = 'EXPIRED'
         WHERE id = ? AND status = 'PENDING_CONFIRMATION'`
      );

      const touchedSessions = new Set<string>();
      for (const row of staleRows) {
        updateBooking.run(row.id);
        touchedSessions.add(row.session_id);
        this.recordAuditEvent({
          actorType: 'SYSTEM',
          actorId: 'expiry-sweeper',
          action: 'HOLD_EXPIRED',
          entityType: 'BOOKING',
          entityId: row.id,
          payload: {
            trackingId: row.tracking_id,
            sessionId: row.session_id,
            expiredAt: nowIso,
          },
        });
      }

      for (const sessionId of touchedSessions) {
        this.syncSessionCounts(sessionId, nowIso);
      }

      return staleRows.length;
    });
  }

  private syncSessionCounts(
    sessionId: string,
    nowIso: string = new Date().toISOString()
  ): void {
    const bookedRow = this.db
      .prepare(
        `SELECT COUNT(*) as cnt
         FROM bookings
         WHERE session_id = ?
           AND status IN ('CONFIRMED', 'ARRIVED', 'COMPLETED')`
      )
      .get(sessionId) as { cnt: number };

    const heldRow = this.db
      .prepare(
        `SELECT COUNT(*) as cnt
         FROM bookings
         WHERE session_id = ?
           AND status = 'PENDING_CONFIRMATION'
           AND (hold_expires_at IS NULL OR hold_expires_at > ?)`
      )
      .get(sessionId, nowIso) as { cnt: number };

    const sessionRow = this.db
      .prepare('SELECT capacity FROM sessions WHERE id = ?')
      .get(sessionId) as { capacity: number } | undefined;

    if (!sessionRow) return;

    const bookedCount = bookedRow?.cnt || 0;
    const heldCount = heldRow?.cnt || 0;
    const newStatus =
      bookedCount + heldCount >= sessionRow.capacity ? 'FULL' : 'OPEN';

    this.db
      .prepare(
        `UPDATE sessions
         SET booked_count = ?, held_count = ?, status = ?
         WHERE id = ?`
      )
      .run(bookedCount, heldCount, newStatus, sessionId);
  }

  /**
   * Ensures `MORNING` (09:00-13:00) and `AFTERNOON` (14:00-17:00) sessions exist
   * for the specified facility, department, and YYYY-MM-DD date.
   */
  public ensureSessionsForDate(
    facilityCodeOrId: string,
    deptCodeOrId: string,
    date?: string
  ): SessionSlotRecord[] {
    const targetDate = date || getTodayIstDateString();
    const dept = this.getDepartment(facilityCodeOrId, deptCodeOrId);
    if (!dept) return [];

    const facility = this.getFacilityByCodeOrId(dept.facilityId);
    if (!facility) return [];

    const morningCap = Math.max(10, Math.round(dept.dailyCapacity * 0.6));
    const afternoonCap = Math.max(10, dept.dailyCapacity - morningCap);

    const morningSmsReserve = Math.max(2, Math.ceil(morningCap * DEFAULT_SMS_QUOTA_RATIO));
    const afternoonSmsReserve = Math.max(2, Math.ceil(afternoonCap * DEFAULT_SMS_QUOTA_RATIO));

    const [mStart, mEnd] = (dept.morningHours || '09:00-13:00').split('-');
    const [aStart, aEnd] = (dept.afternoonHours || '14:00-17:00').split('-');

    const insertSession = this.db.prepare(`
      INSERT INTO sessions (
        id, facility_id, department_id, date, session, start, end, capacity, walkin_reserve, booked_count, held_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'OPEN')
      ON CONFLICT(department_id, date, session) DO NOTHING
    `);

    const insertCounter = this.db.prepare(`
      INSERT INTO token_counters (session_id, last_token, updated_at)
      VALUES (?, 0, ?)
      ON CONFLICT(session_id) DO NOTHING
    `);

    const morningId = `sess_${facility.code.toLowerCase()}_${dept.code.toLowerCase()}_${targetDate}_morning`;
    const afternoonId = `sess_${facility.code.toLowerCase()}_${dept.code.toLowerCase()}_${targetDate}_afternoon`;
    const nowIso = new Date().toISOString();

    this.runInTransaction(() => {
      insertSession.run(
        morningId,
        facility.id,
        dept.id,
        targetDate,
        'MORNING',
        mStart || '09:00',
        mEnd || '13:00',
        morningCap,
        morningSmsReserve
      );
      insertCounter.run(morningId, nowIso);

      insertSession.run(
        afternoonId,
        facility.id,
        dept.id,
        targetDate,
        'AFTERNOON',
        aStart || '14:00',
        aEnd || '17:00',
        afternoonCap,
        afternoonSmsReserve
      );
      insertCounter.run(afternoonId, nowIso);
    });

    this.expireStaleHolds(nowIso);

    const rows = this.db
      .prepare(
        `SELECT s.*, f.code as facility_code, d.code as dept_code, d.name as department_name, d.room_number,
                COALESCE(tc.last_token, 0) as last_token
         FROM sessions s
         JOIN facilities f ON f.id = s.facility_id
         JOIN departments d ON d.id = s.department_id
         LEFT JOIN token_counters tc ON tc.session_id = s.id
         WHERE s.department_id = ? AND s.date = ?
         ORDER BY CASE s.session WHEN 'MORNING' THEN 1 WHEN 'AFTERNOON' THEN 2 ELSE 3 END`
      )
      .all(dept.id, targetDate) as any[];

    return rows.map((r) => this.mapSessionRow(r));
  }

  public listSessions(params: {
    facilityCodeOrId?: string;
    deptCodeOrId: string;
    date?: string;
  }): SessionSlotRecord[] {
    const targetDate = params.date || getTodayIstDateString();
    let facCodeOrId = params.facilityCodeOrId;

    if (!facCodeOrId) {
      const dept = this.getDepartment('', params.deptCodeOrId);
      if (dept) {
        facCodeOrId = dept.facilityId;
      } else {
        facCodeOrId = 'DHJ01';
      }
    }

    return this.ensureSessionsForDate(facCodeOrId, params.deptCodeOrId, targetDate);
  }

  public getSessionById(sessionId: string): SessionSlotRecord | null {
    if (!sessionId) return null;
    this.expireStaleHolds();
    const row = this.db
      .prepare(
        `SELECT s.*, f.code as facility_code, d.code as dept_code, d.name as department_name, d.room_number,
                COALESCE(tc.last_token, 0) as last_token
         FROM sessions s
         JOIN facilities f ON f.id = s.facility_id
         JOIN departments d ON d.id = s.department_id
         LEFT JOIN token_counters tc ON tc.session_id = s.id
         WHERE s.id = ?`
      )
      .get(sessionId) as any;

    return row ? this.mapSessionRow(row) : null;
  }

  // ============================================================================
  // PATIENTS
  // ============================================================================

  public upsertPatient(params: {
    msisdn: string;
    name?: string | null;
    abhaAddress?: string | null;
    abhaNumberHash?: string | null;
    preferredLanguage?: string;
  }): PatientRecord {
    const normalizedPhone = normalizeMsisdn(params.msisdn);
    if (!normalizedPhone) {
      throw new OpdBookingError('INVALID_PHONE', 'Valid phone number is required');
    }

    const phoneHash = hashMsisdn(normalizedPhone);
    const last4 = maskPhoneLast4(normalizedPhone);
    const nowIso = new Date().toISOString();

    const existing = this.db
      .prepare('SELECT * FROM patients WHERE msisdn = ?')
      .get(normalizedPhone) as any;

    if (existing) {
      const updatedName =
        params.name && params.name.trim() ? params.name.trim() : existing.name;
      const updatedAbha =
        params.abhaAddress !== undefined ? params.abhaAddress : existing.abha_address;
      const updatedAbhaHash =
        params.abhaNumberHash !== undefined
          ? params.abhaNumberHash
          : existing.abha_number_hash;

      this.db
        .prepare(
          `UPDATE patients
           SET name = ?, abha_address = ?, abha_number_hash = ?, consent_at = COALESCE(consent_at, ?)
           WHERE id = ?`
        )
        .run(updatedName, updatedAbha, updatedAbhaHash, nowIso, existing.id);

      const refreshed = this.db
        .prepare('SELECT * FROM patients WHERE id = ?')
        .get(existing.id) as any;
      return this.mapPatientRow(refreshed);
    }

    const patientId = `pat_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const cleanName = params.name && params.name.trim() ? params.name.trim() : null;

    this.db
      .prepare(
        `INSERT INTO patients (
          id, msisdn, msisdn_hash, phone_last4, name, abha_address, abha_number_hash, preferred_lang, consent_at, blocked, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
      )
      .run(
        patientId,
        normalizedPhone,
        phoneHash,
        last4,
        cleanName,
        params.abhaAddress || null,
        params.abhaNumberHash || null,
        params.preferredLanguage || 'en',
        nowIso,
        nowIso
      );

    const inserted = this.db
      .prepare('SELECT * FROM patients WHERE id = ?')
      .get(patientId) as any;
    return this.mapPatientRow(inserted);
  }

  public getPatientByMsisdn(msisdn: string): PatientRecord | null {
    const normalizedPhone = normalizeMsisdn(msisdn);
    if (!normalizedPhone) return null;
    const row = this.db
      .prepare('SELECT * FROM patients WHERE msisdn = ?')
      .get(normalizedPhone) as any;
    return row ? this.mapPatientRow(row) : null;
  }

  // ============================================================================
  // BOOKINGS: ATOMIC HOLD, IMMEDIATE CONFIRM, CONFIRM HOLD, CANCEL, LOOKUP
  // ============================================================================

  /**
   * Atomically creates either a 10-minute slot hold (`PENDING_CONFIRMATION`) or an
   * immediately confirmed booking (`CONFIRMED` with locked `token_counters` increment).
   * Enforces:
   * - One active booking per `(patient, department, date)`
   * - Session total capacity & 25% SMS/walk-in reserved quota
   * - Unique Crockford Base32 Tracking ID with modulo-32 check character
   */
  public createHoldOrBooking(input: CreateBookingInput): BookingRecord {
    return this.runInTransaction(() => {
      const now = new Date();
      const nowIso = now.toISOString();

      // 1. Expire stale holds first
      this.expireStaleHolds(nowIso);

      // 2. Upsert patient & check block status
      const patient = this.upsertPatient({
        msisdn: input.phone,
        name: input.patientName,
        abhaAddress: input.abhaAddress,
        abhaNumberHash: input.abhaNumberHash,
      });

      if (patient.blocked) {
        throw new OpdBookingError(
          'PATIENT_BLOCKED',
          'This phone number is blocked from creating OPD bookings.',
          403
        );
      }

      // 3. Resolve target session
      const channel = normalizeChannel(input.channel);
      let targetSession: SessionSlotRecord | null = null;

      if (input.sessionId) {
        targetSession = this.getSessionById(input.sessionId);
      } else {
        const facCode = input.facilityCode || input.facilityId || 'DHJ01';
        const deptCode = input.deptCode || input.departmentId || 'MED';
        const dateStr = input.date || getTodayIstDateString(now);
        const sessions = this.ensureSessionsForDate(facCode, deptCode, dateStr);
        if (sessions.length === 0) {
          throw new OpdBookingError(
            'INVALID_FACILITY_OR_DEPT',
            `Unknown facility '${facCode}' or department '${deptCode}'.`,
            404
          );
        }

        if (input.session) {
          targetSession =
            sessions.find((s) => s.session === input.session) || sessions[0];
        } else {
          // Pick MORNING if available, otherwise fall back to AFTERNOON
          const morning = sessions.find((s) => s.session === 'MORNING');
          const afternoon = sessions.find((s) => s.session === 'AFTERNOON');
          if (morning && morning.availableCount > 0) {
            targetSession = morning;
          } else if (afternoon && afternoon.availableCount > 0) {
            targetSession = afternoon;
          } else {
            targetSession = morning || sessions[0];
          }
        }
      }

      if (!targetSession) {
        throw new OpdBookingError('SESSION_NOT_FOUND', 'Requested OPD session not found', 404);
      }

      // 4. Enforce one active booking per (patient, department, slotDate)
      const existingActive = this.db
        .prepare(
          `SELECT * FROM bookings
           WHERE patient_id = ?
             AND department_id = ?
             AND slot_date = ?
             AND status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'ARRIVED')
           ORDER BY created_at DESC`
        )
        .all(patient.id, targetSession.departmentId, targetSession.date) as any[];

      for (const existing of existingActive) {
        if (existing.status === 'CONFIRMED' || existing.status === 'ARRIVED') {
          throw new OpdBookingError(
            'DUPLICATE_ACTIVE_BOOKING',
            `Patient already has an active booking (${existing.tracking_id}, Token #${existing.token_no}) for ${targetSession.deptCode} on ${targetSession.date}.`,
            409
          );
        }
        // If there is an existing PENDING_CONFIRMATION hold for this patient + dept + date,
        // cancel/replace the older hold so the new request cleanly succeeds without leaking capacity
        if (existing.status === 'PENDING_CONFIRMATION') {
          this.db
            .prepare(
              `UPDATE bookings
               SET status = 'CANCELLED', state = 'CANCELLED', cancelled_at = ?, cancel_reason = 'SUPERSEDED_BY_NEW_HOLD'
               WHERE id = ?`
            )
            .run(nowIso, existing.id);
          this.syncSessionCounts(existing.session_id, nowIso);
        }
      }

      // Refresh session counts after any superseded hold cleanup
      this.syncSessionCounts(targetSession.id, nowIso);
      const freshSession = this.getSessionById(targetSession.id)!;

      // 5. Enforce capacity & 25% SMS/walk-in quota equity
      const totalOccupied = freshSession.bookedCount + freshSession.heldCount;
      if (totalOccupied >= freshSession.totalCapacity) {
        throw new OpdBookingError(
          'SESSION_FULL',
          `All ${freshSession.totalCapacity} slots for ${freshSession.deptCode} (${freshSession.session}) on ${freshSession.date} are full.`,
          409
        );
      }

      const webCeiling = freshSession.totalCapacity - freshSession.reservedSmsQuota;
      if (
        channel === 'WEB' &&
        !input.allowReservedQuota &&
        totalOccupied >= webCeiling
      ) {
        throw new OpdBookingError(
          'WEB_QUOTA_FULL',
          `Online web quota (${webCeiling} slots) is full for ${freshSession.deptCode} (${freshSession.session}). Remaining ${freshSession.reservedSmsQuota} slots are reserved for SMS and hospital walk-in patients.`,
          409
        );
      }

      // 6. Generate unique Crockford Base32 Tracking ID
      let tracking = generateTrackingId(input.trackingIdSeed);
      for (let attempt = 0; attempt < 5; attempt++) {
        const collision = this.db
          .prepare('SELECT id FROM bookings WHERE tracking_id = ? OR tracking_id_raw = ?')
          .get(tracking.formatted, tracking.raw);
        if (!collision) break;
        tracking = generateTrackingId();
      }

      const bookingId = `bkg_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const mode =
        input.mode || (channel === 'SMS' ? 'HOLD' : 'IMMEDIATE_CONFIRM');

      if (mode === 'HOLD') {
        const ttlMs = input.holdTtlMs ?? DEFAULT_HOLD_TTL_MS;
        const holdExpiresAt = new Date(now.getTime() + ttlMs).toISOString();
        const confirmCode = input.customConfirmCode || generateConfirmCode();
        const confirmHash = hashConfirmCode(confirmCode);
        const estimatedToken = freshSession.nextEstimatedToken;
        const reportingWindow = computeReportingWindow(
          freshSession.session,
          estimatedToken
        );

        this.db
          .prepare(
            `INSERT INTO bookings (
              id, tracking_id, tracking_id_raw, facility_id, department_id, session_id, patient_id,
              slot_date, session_period, reporting_window, token_no, estimated_token_no,
              channel, status, state, hold_expires_at, confirm_code, confirm_code_hash,
              qr_payload, abha_verified, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'PENDING_CONFIRMATION', 'PENDING_CONFIRMATION', ?, ?, ?, NULL, ?, ?)`
          )
          .run(
            bookingId,
            tracking.formatted,
            tracking.raw,
            freshSession.facilityId,
            freshSession.departmentId,
            freshSession.id,
            patient.id,
            freshSession.date,
            freshSession.session,
            reportingWindow,
            estimatedToken,
            channel,
            holdExpiresAt,
            confirmCode,
            confirmHash,
            input.abhaVerified ? 1 : 0,
            nowIso
          );

        this.syncSessionCounts(freshSession.id, nowIso);

        this.recordAuditEvent({
          actorType: channel === 'SMS' ? 'SMS_GATEWAY' : 'PATIENT',
          actorId: input.actorId || patient.msisdnNormalized,
          action: 'BOOKING_HOLD_CREATED',
          entityType: 'BOOKING',
          entityId: bookingId,
          payload: {
            trackingId: tracking.formatted,
            facilityCode: freshSession.facilityCode,
            deptCode: freshSession.deptCode,
            date: freshSession.date,
            session: freshSession.session,
            channel,
            estimatedToken,
            holdExpiresAt,
          },
        });

        return this.getBookingById(bookingId)!;
      }

      // IMMEDIATE_CONFIRM mode: Atomically increment token_counters for session_id
      const tokenNumber = this.allocateNextTokenNumber(freshSession.id, nowIso);
      const reportingWindow = computeReportingWindow(
        freshSession.session,
        tokenNumber
      );

      const qrPayload = signQrPayload({
        type: 'BOOKING',
        id: bookingId,
        facilityCode: freshSession.facilityCode,
        deptCode: freshSession.deptCode,
        date: freshSession.date,
        tokenNumber,
        trackingId: tracking.formatted,
        session: freshSession.session,
        exp: Math.floor(now.getTime() / 1000) + 7 * 24 * 3600,
      });

      this.db
        .prepare(
          `INSERT INTO bookings (
            id, tracking_id, tracking_id_raw, facility_id, department_id, session_id, patient_id,
            slot_date, session_period, reporting_window, token_no, estimated_token_no,
            channel, status, state, hold_expires_at, confirm_code, confirm_code_hash,
            qr_payload, abha_verified, created_at, confirmed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', 'CONFIRMED', NULL, NULL, NULL, ?, ?, ?, ?)`
        )
        .run(
          bookingId,
          tracking.formatted,
          tracking.raw,
          freshSession.facilityId,
          freshSession.departmentId,
          freshSession.id,
          patient.id,
          freshSession.date,
          freshSession.session,
          reportingWindow,
          tokenNumber,
          tokenNumber,
          channel,
          qrPayload,
          input.abhaVerified ? 1 : 0,
          nowIso,
          nowIso
        );

      this.syncSessionCounts(freshSession.id, nowIso);

      this.recordAuditEvent({
        actorType: channel === 'COUNTER' ? 'STAFF' : 'PATIENT',
        actorId: input.actorId || patient.msisdnNormalized,
        action: 'BOOKING_CONFIRMED',
        entityType: 'BOOKING',
        entityId: bookingId,
        payload: {
          trackingId: tracking.formatted,
          tokenNumber,
          facilityCode: freshSession.facilityCode,
          deptCode: freshSession.deptCode,
          date: freshSession.date,
          session: freshSession.session,
          channel,
        },
      });

      return this.getBookingById(bookingId)!;
    });
  }

  /** Alias for createHoldOrBooking */
  public createBooking(input: CreateBookingInput): BookingRecord {
    return this.createHoldOrBooking(input);
  }

  /** Alias for creating a PENDING_CONFIRMATION hold */
  public createHold(input: CreateBookingInput): BookingRecord {
    return this.createHoldOrBooking({ ...input, mode: 'HOLD' });
  }

  private allocateNextTokenNumber(sessionId: string, nowIso: string): number {
    this.db
      .prepare(
        `INSERT INTO token_counters (session_id, last_token, updated_at)
         VALUES (?, 1, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           last_token = last_token + 1,
           updated_at = excluded.updated_at`
      )
      .run(sessionId, nowIso);

    const row = this.db
      .prepare('SELECT last_token FROM token_counters WHERE session_id = ?')
      .get(sessionId) as { last_token: number };

    return row.last_token;
  }

  /**
   * Confirms a `PENDING_CONFIRMATION` hold by `(msisdn, confirmCode)`, bare `msisdn`
   * (if exactly one pending hold exists for that phone), or `bookingId`.
   * Atomically allocates the next sequential `token_no` from `token_counters(session_id)`.
   */
  public confirmPendingBooking(params: {
    bookingId?: string;
    msisdn?: string;
    confirmCode?: string | null;
    actorId?: string;
  }): BookingRecord {
    return this.runInTransaction(() => {
      const now = new Date();
      const nowIso = now.toISOString();

      // First check if a matching hold existed but already expired so we can return a clear error
      let targetRow: any = null;

      if (params.bookingId) {
        targetRow = this.db
          .prepare('SELECT * FROM bookings WHERE id = ? OR tracking_id = ? OR tracking_id_raw = ?')
          .get(params.bookingId, params.bookingId, normalizeCrockford(params.bookingId)) as any;
      } else if (params.msisdn) {
        const patient = this.getPatientByMsisdn(params.msisdn);
        if (!patient) {
          throw new OpdBookingError(
            'HOLD_NOT_FOUND',
            'No pending appointment hold found for this phone number.',
            404
          );
        }

        const cleanCode = (params.confirmCode || '').trim();
        if (cleanCode) {
          const codeHash = hashConfirmCode(cleanCode);
          targetRow = this.db
            .prepare(
              `SELECT * FROM bookings
               WHERE patient_id = ?
                 AND (confirm_code = ? OR confirm_code_hash = ?)
               ORDER BY created_at DESC
               LIMIT 1`
            )
            .get(patient.id, cleanCode, codeHash) as any;
        } else {
          // Bare "Y" confirmation: allowed only if there is a single active pending hold
          this.expireStaleHolds(nowIso);
          const pendingRows = this.db
            .prepare(
              `SELECT * FROM bookings
               WHERE patient_id = ? AND status = 'PENDING_CONFIRMATION'
               ORDER BY created_at DESC`
            )
            .all(patient.id) as any[];

          if (pendingRows.length > 1) {
            throw new OpdBookingError(
              'AMBIGUOUS_PENDING_HOLD',
              'Multiple pending holds found. Please reply Y <4-digit code> to confirm.',
              400
            );
          }
          targetRow = pendingRows[0] || null;
        }
      }

      if (!targetRow) {
        throw new OpdBookingError(
          'HOLD_NOT_FOUND',
          'No matching pending hold found. Check your 4-digit confirmation code or text OPD <HOSPITAL> <DEPT> to book.',
          404
        );
      }

      if (targetRow.status === 'CONFIRMED') {
        return this.getBookingById(targetRow.id)!;
      }

      if (
        targetRow.status === 'EXPIRED' ||
        (targetRow.hold_expires_at && targetRow.hold_expires_at <= nowIso)
      ) {
        this.expireStaleHolds(nowIso);
        throw new OpdBookingError(
          'HOLD_EXPIRED',
          'Your 10-minute booking hold has expired. Please send a new booking request.',
          410
        );
      }

      if (targetRow.status !== 'PENDING_CONFIRMATION') {
        throw new OpdBookingError(
          'INVALID_BOOKING_STATE',
          `Cannot confirm booking in state '${targetRow.status}'.`,
          409
        );
      }

      // Allocate token number atomically
      const tokenNumber = this.allocateNextTokenNumber(targetRow.session_id, nowIso);
      const sessionInfo = this.getSessionById(targetRow.session_id)!;
      const reportingWindow = computeReportingWindow(
        sessionInfo.session,
        tokenNumber
      );

      const qrPayload = signQrPayload({
        type: 'BOOKING',
        id: targetRow.id,
        facilityCode: sessionInfo.facilityCode,
        deptCode: sessionInfo.deptCode,
        date: sessionInfo.date,
        tokenNumber,
        trackingId: targetRow.tracking_id,
        session: sessionInfo.session,
        exp: Math.floor(now.getTime() / 1000) + 7 * 24 * 3600,
      });

      this.db
        .prepare(
          `UPDATE bookings
           SET status = 'CONFIRMED',
               state = 'CONFIRMED',
               token_no = ?,
               reporting_window = ?,
               qr_payload = ?,
               confirmed_at = ?
           WHERE id = ?`
        )
        .run(tokenNumber, reportingWindow, qrPayload, nowIso, targetRow.id);

      this.syncSessionCounts(targetRow.session_id, nowIso);

      this.recordAuditEvent({
        actorType: targetRow.channel === 'SMS' ? 'SMS_GATEWAY' : 'PATIENT',
        actorId: params.actorId || targetRow.patient_id,
        action: 'BOOKING_CONFIRMED',
        entityType: 'BOOKING',
        entityId: targetRow.id,
        payload: {
          trackingId: targetRow.tracking_id,
          tokenNumber,
          sessionId: targetRow.session_id,
          confirmedAt: nowIso,
        },
      });

      return this.getBookingById(targetRow.id)!;
    });
  }

  /**
   * Cancels a pending or confirmed booking by `idOrTrackingId` OR by `(msisdn, confirmCode)`.
   * Releases session capacity and records an audit event.
   */
  public cancelBooking(params: {
    idOrTrackingId?: string;
    msisdn?: string;
    confirmCode?: string | null;
    reason?: string;
    actorId?: string;
  }): BookingRecord {
    return this.runInTransaction(() => {
      const nowIso = new Date().toISOString();
      let existing: BookingRecord | null = null;

      if (params.idOrTrackingId) {
        existing =
          this.getBookingById(params.idOrTrackingId) ||
          this.getBookingByTrackingId(params.idOrTrackingId);
      }

      if (!existing && params.msisdn) {
        const patient = this.getPatientByMsisdn(params.msisdn);
        if (patient) {
          const cleanCode = (params.confirmCode || '').trim();
          let row: any;
          if (cleanCode) {
            row = this.db
              .prepare(
                `SELECT id FROM bookings
                 WHERE patient_id = ?
                   AND (confirm_code = ? OR confirm_code_hash = ?)
                   AND status IN ('PENDING_CONFIRMATION', 'CONFIRMED')
                 ORDER BY created_at DESC LIMIT 1`
              )
              .get(patient.id, cleanCode, hashConfirmCode(cleanCode));
          } else {
            row = this.db
              .prepare(
                `SELECT id FROM bookings
                 WHERE patient_id = ?
                   AND status IN ('PENDING_CONFIRMATION', 'CONFIRMED')
                 ORDER BY created_at DESC LIMIT 1`
              )
              .get(patient.id);
          }
          if (row) {
            existing = this.getBookingById(row.id);
          }
        }
      }

      if (!existing) {
        throw new OpdBookingError('BOOKING_NOT_FOUND', 'Booking not found to cancel.', 404);
      }

      if (existing.status === 'CANCELLED') {
        return existing;
      }

      const cancelReason = params.reason || 'USER_CANCELLED';
      this.db
        .prepare(
          `UPDATE bookings
           SET status = 'CANCELLED',
               state = 'CANCELLED',
               cancelled_at = ?,
               cancel_reason = ?
           WHERE id = ?`
        )
        .run(nowIso, cancelReason, existing.id);

      this.syncSessionCounts(existing.sessionId, nowIso);

      this.recordAuditEvent({
        actorType: 'PATIENT',
        actorId: params.actorId || existing.msisdnNormalized,
        action: 'BOOKING_CANCELLED',
        entityType: 'BOOKING',
        entityId: existing.id,
        payload: {
          trackingId: existing.trackingId,
          previousStatus: existing.status,
          reason: cancelReason,
          cancelledAt: nowIso,
        },
      });

      return this.getBookingById(existing.id)!;
    });
  }

  public getBookingById(id: string): BookingRecord | null {
    if (!id) return null;
    const row = this.db
      .prepare(
        `SELECT b.*,
                f.code as facility_code, f.name as facility_name, f.short_name as facility_short_name,
                d.code as dept_code, d.name as department_name, d.room_number,
                p.name as patient_name, p.msisdn as patient_msisdn, p.phone_last4, p.abha_address
         FROM bookings b
         JOIN facilities f ON f.id = b.facility_id
         JOIN departments d ON d.id = b.department_id
         JOIN patients p ON p.id = b.patient_id
         WHERE b.id = ?`
      )
      .get(id) as any;

    return row ? this.mapBookingRow(row) : null;
  }

  public getBookingByTrackingId(trackingId: string): BookingRecord | null {
    if (!trackingId) return null;
    const norm = normalizeCrockford(trackingId);
    const rawMv = `MV${norm}`;
    const formatted =
      norm.length >= 6 ? `MV-${norm.slice(0, 4)}-${norm.slice(4)}` : trackingId.trim();

    const row = this.db
      .prepare(
        `SELECT b.*,
                f.code as facility_code, f.name as facility_name, f.short_name as facility_short_name,
                d.code as dept_code, d.name as department_name, d.room_number,
                p.name as patient_name, p.msisdn as patient_msisdn, p.phone_last4, p.abha_address
         FROM bookings b
         JOIN facilities f ON f.id = b.facility_id
         JOIN departments d ON d.id = b.department_id
         JOIN patients p ON p.id = b.patient_id
         WHERE b.tracking_id = ?
            OR b.tracking_id_raw = ?
            OR REPLACE(UPPER(b.tracking_id), '-', '') = ?
            OR b.id = ?
         LIMIT 1`
      )
      .get(formatted, rawMv, rawMv, trackingId.trim()) as any;

    return row ? this.mapBookingRow(row) : null;
  }

  public listBookingsByPhone(msisdn: string, limit = 10): BookingRecord[] {
    const patient = this.getPatientByMsisdn(msisdn);
    if (!patient) return [];

    const rows = this.db
      .prepare(
        `SELECT b.*,
                f.code as facility_code, f.name as facility_name, f.short_name as facility_short_name,
                d.code as dept_code, d.name as department_name, d.room_number,
                p.name as patient_name, p.msisdn as patient_msisdn, p.phone_last4, p.abha_address
         FROM bookings b
         JOIN facilities f ON f.id = b.facility_id
         JOIN departments d ON d.id = b.department_id
         JOIN patients p ON p.id = b.patient_id
         WHERE b.patient_id = ?
         ORDER BY b.created_at DESC
         LIMIT ?`
      )
      .all(patient.id, limit) as any[];

    return rows.map((r) => this.mapBookingRow(r));
  }

  // ============================================================================
  // COUNTER CONSOLE: LOOKUP, CHECK-CHAR VALIDATION, QR SCAN & MARK ARRIVED
  // ============================================================================

  public counterLookup(params: {
    trackingId?: string;
    qrToken?: string;
    phoneLast4?: string;
  }): CounterLookupResult {
    this.expireStaleHolds();

    if (params.qrToken) {
      const verified = verifyQrPayload(params.qrToken);
      if (!verified.valid || !verified.payload) {
        return {
          found: false,
          checksumValid: false,
          qrVerified: false,
          verificationMethod: 'QR_SIGNATURE',
          error: verified.error || 'Invalid QR signature',
        };
      }

      const booking =
        this.getBookingById(verified.payload.id) ||
        (verified.payload.trackingId
          ? this.getBookingByTrackingId(verified.payload.trackingId)
          : null);

      if (!booking) {
        return {
          found: false,
          checksumValid: true,
          qrVerified: true,
          verificationMethod: 'QR_SIGNATURE',
          error: 'No booking record found for this QR code',
        };
      }

      return {
        found: true,
        checksumValid: true,
        qrVerified: true,
        verificationMethod: 'QR_SIGNATURE',
        booking,
        slip: this.buildCounterSlip(booking),
      };
    }

    const rawTracking = (params.trackingId || '').trim();
    const validation = validateTrackingId(rawTracking);
    if (!validation.valid) {
      return {
        found: false,
        checksumValid: false,
        verificationMethod: 'TRACKING_ID',
        error: validation.reason || 'Invalid Tracking ID check character',
      };
    }

    const booking = this.getBookingByTrackingId(rawTracking);
    if (!booking) {
      return {
        found: false,
        checksumValid: true,
        verificationMethod: 'TRACKING_ID',
        error: `No booking found for Tracking ID ${validation.formatted}`,
      };
    }

    if (
      params.phoneLast4 &&
      params.phoneLast4.trim() &&
      booking.phoneLast4 !== params.phoneLast4.trim()
    ) {
      return {
        found: false,
        checksumValid: true,
        verificationMethod: 'TRACKING_ID',
        error: 'Phone last 4 digits do not match patient record',
      };
    }

    return {
      found: true,
      checksumValid: true,
      verificationMethod: 'TRACKING_ID',
      booking,
      slip: this.buildCounterSlip(booking),
    };
  }

  public markBookingArrived(
    idOrTrackingId: string,
    staffId = 'counter-dhj01',
    phoneLast4?: string
  ): CounterLookupResult {
    return this.runInTransaction(() => {
      const booking =
        this.getBookingById(idOrTrackingId) ||
        this.getBookingByTrackingId(idOrTrackingId);

      if (!booking) {
        return {
          found: false,
          checksumValid: false,
          verificationMethod: 'TRACKING_ID',
          error: 'Booking not found',
        };
      }

      if (
        phoneLast4 &&
        phoneLast4.trim() &&
        booking.phoneLast4 !== phoneLast4.trim()
      ) {
        return {
          found: false,
          checksumValid: true,
          verificationMethod: 'TRACKING_ID',
          error: 'Phone last 4 digits verification failed',
        };
      }

      if (booking.status !== 'CONFIRMED' && booking.status !== 'ARRIVED') {
        return {
          found: true,
          checksumValid: true,
          verificationMethod: 'TRACKING_ID',
          booking,
          error: `Booking cannot be marked ARRIVED from status '${booking.status}'`,
        };
      }

      const nowIso = new Date().toISOString();
      let tokenNo = booking.tokenNumber;
      if (!tokenNo) {
        tokenNo = this.allocateNextTokenNumber(booking.sessionId, nowIso);
      }

      this.db
        .prepare(
          `UPDATE bookings
           SET status = 'ARRIVED',
               state = 'ARRIVED',
               token_no = ?,
               arrived_at = COALESCE(arrived_at, ?)
           WHERE id = ?`
        )
        .run(tokenNo, nowIso, booking.id);

      this.recordAuditEvent({
        actorType: 'STAFF',
        actorId: staffId,
        action: 'COUNTER_ARRIVED',
        entityType: 'BOOKING',
        entityId: booking.id,
        payload: {
          trackingId: booking.trackingId,
          tokenNumber: tokenNo,
          arrivedAt: nowIso,
          staffId,
        },
      });

      const updated = this.getBookingById(booking.id)!;
      return {
        found: true,
        checksumValid: true,
        verificationMethod: 'TRACKING_ID',
        booking: updated,
        slip: this.buildCounterSlip(updated),
      };
    });
  }

  private buildCounterSlip(booking: BookingRecord): NonNullable<CounterLookupResult['slip']> {
    return {
      slipNumber: `SLIP-${booking.facilityCode}-${booking.deptCode}-${booking.tokenNumber || 0}`,
      trackingId: booking.trackingId,
      tokenNumber: booking.tokenNumber,
      facilityName: booking.facilityName || booking.facilityCode,
      facilityCode: booking.facilityCode,
      departmentName: booking.departmentName || booking.deptCode,
      deptCode: booking.deptCode,
      roomNumber: booking.roomNumber || 'OPD-101',
      slotDate: booking.slotDate,
      session: booking.session,
      reportingWindow: booking.reportingWindow,
      maskedPatientName: booking.maskedPatientName,
      phoneLast4: booking.phoneLast4,
      channel: booking.channel,
      status: booking.status,
      arrivedAt: booking.arrivedAt,
      printedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // SMS INBOX & OUTBOX (IDEMPOTENT DEDUPLICATION & DLR TRACKING)
  // ============================================================================

  public recordInboundSms(params: {
    providerMsgId: string;
    provider?: string;
    msisdn: string;
    body: string;
    receivedAt?: string;
    parsedJson?: SmsParseResult | null;
    bookingId?: string | null;
    status?: string;
  }): { deduplicated: boolean; record: SmsMessageRecord } {
    return this.runInTransaction(() => {
      const existing = this.db
        .prepare('SELECT * FROM sms_inbox WHERE provider_msg_id = ?')
        .get(params.providerMsgId) as any;

      if (existing) {
        return {
          deduplicated: true,
          record: this.mapSmsInboxRow(existing),
        };
      }

      const id = `in_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const normalizedMsisdn = normalizeMsisdn(params.msisdn);
      const receivedAt = params.receivedAt || new Date().toISOString();

      this.db
        .prepare(
          `INSERT INTO sms_inbox (
            id, provider_msg_id, provider, msisdn, body, received_at, parsed_json, booking_id, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          params.providerMsgId,
          params.provider || 'simulator',
          normalizedMsisdn,
          params.body,
          receivedAt,
          params.parsedJson ? JSON.stringify(params.parsedJson) : null,
          params.bookingId || null,
          params.status || 'RECEIVED'
        );

      const inserted = this.db
        .prepare('SELECT * FROM sms_inbox WHERE id = ?')
        .get(id) as any;

      return {
        deduplicated: false,
        record: this.mapSmsInboxRow(inserted),
      };
    });
  }

  public updateInboundSms(
    idOrProviderMsgId: string,
    updates: {
      parsedJson?: SmsParseResult | null;
      bookingId?: string | null;
      status?: string;
    }
  ): void {
    const existing = this.db
      .prepare('SELECT * FROM sms_inbox WHERE id = ? OR provider_msg_id = ?')
      .get(idOrProviderMsgId, idOrProviderMsgId) as any;
    if (!existing) return;

    const nextParsed =
      updates.parsedJson !== undefined
        ? updates.parsedJson
          ? JSON.stringify(updates.parsedJson)
          : null
        : existing.parsed_json;
    const nextBookingId =
      updates.bookingId !== undefined ? updates.bookingId : existing.booking_id;
    const nextStatus = updates.status || existing.status;

    this.db
      .prepare(
        `UPDATE sms_inbox
         SET parsed_json = ?, booking_id = ?, status = ?
         WHERE id = ?`
      )
      .run(nextParsed, nextBookingId, nextStatus, existing.id);
  }

  public recordOutboundSms(params: {
    bookingId?: string | null;
    msisdn: string;
    templateId?: string;
    rendered: string;
    provider?: string;
    providerMsgId?: string;
    status?: string;
    dlrStatus?: string | null;
  }): SmsMessageRecord {
    const id = `out_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const providerMsgId =
      params.providerMsgId || `mt-${crypto.randomUUID().slice(0, 12)}`;
    const normalizedMsisdn = normalizeMsisdn(params.msisdn);
    const nowIso = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO sms_outbox (
          id, booking_id, msisdn, template_id, rendered, provider, provider_msg_id, status, dlr_status, attempts, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(
        id,
        params.bookingId || null,
        normalizedMsisdn,
        params.templateId || 'OPD_GENERIC',
        params.rendered,
        params.provider || 'simulator',
        providerMsgId,
        params.status || 'SENT',
        params.dlrStatus || 'DELIVERED',
        nowIso,
        nowIso
      );

    const row = this.db
      .prepare('SELECT * FROM sms_outbox WHERE id = ?')
      .get(id) as any;
    return this.mapSmsOutboxRow(row);
  }

  public updateOutboundDlr(
    providerMsgId: string,
    dlrStatus: string,
    status?: string
  ): SmsMessageRecord | null {
    const nowIso = new Date().toISOString();
    const res = this.db
      .prepare(
        `UPDATE sms_outbox
         SET dlr_status = ?, status = COALESCE(?, status), updated_at = ?
         WHERE provider_msg_id = ? OR id = ?`
      )
      .run(dlrStatus, status || null, nowIso, providerMsgId, providerMsgId);

    if (res.changes === 0) return null;
    const row = this.db
      .prepare('SELECT * FROM sms_outbox WHERE provider_msg_id = ? OR id = ?')
      .get(providerMsgId, providerMsgId) as any;
    return row ? this.mapSmsOutboxRow(row) : null;
  }

  public listSmsMessages(filter?: {
    msisdn?: string;
    direction?: SmsDirection;
    limit?: number;
  }): SmsMessageRecord[] {
    const limit = filter?.limit || 50;
    const normalized = filter?.msisdn ? normalizeMsisdn(filter.msisdn) : null;
    const results: SmsMessageRecord[] = [];

    if (!filter?.direction || filter.direction === 'INBOUND') {
      const sql = normalized
        ? 'SELECT * FROM sms_inbox WHERE msisdn = ? ORDER BY received_at DESC LIMIT ?'
        : 'SELECT * FROM sms_inbox ORDER BY received_at DESC LIMIT ?';
      const rows = (
        normalized
          ? this.db.prepare(sql).all(normalized, limit)
          : this.db.prepare(sql).all(limit)
      ) as any[];
      results.push(...rows.map((r) => this.mapSmsInboxRow(r)));
    }

    if (!filter?.direction || filter.direction === 'OUTBOUND') {
      const sql = normalized
        ? 'SELECT * FROM sms_outbox WHERE msisdn = ? ORDER BY created_at DESC LIMIT ?'
        : 'SELECT * FROM sms_outbox ORDER BY created_at DESC LIMIT ?';
      const rows = (
        normalized
          ? this.db.prepare(sql).all(normalized, limit)
          : this.db.prepare(sql).all(limit)
      ) as any[];
      results.push(...rows.map((r) => this.mapSmsOutboxRow(r)));
    }

    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  // ============================================================================
  // ADMIN QUEUE & AUDIT EVENTS
  // ============================================================================

  public getAdminQueue(
    facilityCodeOrId: string,
    deptCodeOrId: string,
    date?: string
  ): AdminQueueSnapshot {
    const targetDate = date || getTodayIstDateString();
    const sessions = this.ensureSessionsForDate(
      facilityCodeOrId,
      deptCodeOrId,
      targetDate
    );

    const facility =
      this.getFacilityByCodeOrId(facilityCodeOrId) ||
      this.getFacilityByCodeOrId('DHJ01')!;
    const dept =
      this.getDepartment(facility.code, deptCodeOrId) ||
      this.getDepartment(facility.code, 'MED')!;

    const rows = this.db
      .prepare(
        `SELECT b.*,
                f.code as facility_code, f.name as facility_name, f.short_name as facility_short_name,
                d.code as dept_code, d.name as department_name, d.room_number,
                p.name as patient_name, p.msisdn as patient_msisdn, p.phone_last4, p.abha_address
         FROM bookings b
         JOIN facilities f ON f.id = b.facility_id
         JOIN departments d ON d.id = b.department_id
         JOIN patients p ON p.id = b.patient_id
         WHERE b.facility_id = ? AND b.department_id = ? AND b.slot_date = ?
         ORDER BY
           CASE WHEN b.token_no IS NULL THEN 999999 ELSE b.token_no END ASC,
           b.created_at ASC`
      )
      .all(facility.id, dept.id, targetDate) as any[];

    const bookings = rows.map((r) => this.mapBookingRow(r));

    const byChannel: Record<BookingChannel, number> = {
      WEB: 0,
      QR_WALKIN: 0,
      SMS: 0,
      COUNTER: 0,
    };

    let confirmedCount = 0;
    let pendingHoldCount = 0;
    let arrivedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let expiredCount = 0;
    let lastIssuedToken = 0;
    let currentServingToken: number | null = null;

    for (const b of bookings) {
      if (
        b.status === 'CONFIRMED' ||
        b.status === 'ARRIVED' ||
        b.status === 'COMPLETED' ||
        b.status === 'PENDING_CONFIRMATION'
      ) {
        byChannel[b.channel] = (byChannel[b.channel] || 0) + 1;
      }
      if (b.status === 'CONFIRMED') confirmedCount++;
      if (b.status === 'PENDING_CONFIRMATION') pendingHoldCount++;
      if (b.status === 'ARRIVED') {
        arrivedCount++;
        if (b.tokenNumber && (!currentServingToken || b.tokenNumber > currentServingToken)) {
          currentServingToken = b.tokenNumber;
        }
      }
      if (b.status === 'COMPLETED') completedCount++;
      if (b.status === 'CANCELLED') cancelledCount++;
      if (b.status === 'EXPIRED') expiredCount++;
      if (b.tokenNumber && b.tokenNumber > lastIssuedToken) {
        lastIssuedToken = b.tokenNumber;
      }
    }

    const totalCapacity = sessions.reduce((acc, s) => acc + s.totalCapacity, 0);
    const reservedSmsQuota = sessions.reduce((acc, s) => acc + s.reservedSmsQuota, 0);
    const availableSlots = sessions.reduce((acc, s) => acc + s.availableCount, 0);

    return {
      facilityCode: facility.code,
      facilityName: facility.name,
      deptCode: dept.code,
      departmentName: dept.name,
      roomNumber: dept.roomNumber,
      date: targetDate,
      generatedAt: new Date().toISOString(),
      summary: {
        totalCapacity,
        reservedSmsQuota,
        confirmedCount,
        pendingHoldCount,
        arrivedCount,
        completedCount,
        cancelledCount,
        expiredCount,
        availableSlots,
        lastIssuedToken,
        currentServingToken,
        byChannel,
      },
      sessions,
      queue: bookings,
    };
  }

  public recordAuditEvent(event: {
    actorType?: 'PATIENT' | 'STAFF' | 'SYSTEM' | 'SMS_GATEWAY';
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
  }): AuditEventRecord {
    const id = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const nowIso = new Date().toISOString();
    const actorType = event.actorType || 'SYSTEM';
    const payloadObj = event.payload || {};

    this.db
      .prepare(
        `INSERT INTO audit_events (id, actor_type, actor, action, entity, entity_id, payload, at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        actorType,
        event.actorId,
        event.action,
        event.entityType,
        event.entityId,
        JSON.stringify(payloadObj),
        nowIso
      );

    return {
      id,
      actorType,
      actorId: event.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: payloadObj,
      createdAt: nowIso,
    };
  }

  public listAuditEvents(filter?: {
    entityType?: string;
    entityId?: string;
    limit?: number;
  }): AuditEventRecord[] {
    let sql = 'SELECT * FROM audit_events WHERE 1=1';
    const params: any[] = [];

    if (filter?.entityType) {
      sql += ' AND entity = ?';
      params.push(filter.entityType);
    }
    if (filter?.entityId) {
      sql += ' AND entity_id = ?';
      params.push(filter.entityId);
    }
    sql += ' ORDER BY at DESC LIMIT ?';
    params.push(filter?.limit || 50);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      actorType: (r.actor_type || 'SYSTEM') as AuditEventRecord['actorType'],
      actorId: r.actor,
      action: r.action,
      entityType: r.entity,
      entityId: r.entity_id,
      payload: r.payload ? JSON.parse(r.payload) : {},
      createdAt: r.at,
    }));
  }

  public listStaffUsers(facilityCodeOrId?: string): StaffUserRecord[] {
    let sql = `
      SELECT s.*, f.code as facility_code
      FROM staff_users s
      LEFT JOIN facilities f ON f.id = s.facility_id
      WHERE s.active = 1
    `;
    const params: any[] = [];
    if (facilityCodeOrId) {
      const fac = this.getFacilityByCodeOrId(facilityCodeOrId);
      if (fac) {
        sql += ' AND (s.facility_id = ? OR s.facility_id IS NULL)';
        params.push(fac.id);
      }
    }
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      facilityId: r.facility_id,
      facilityCode: r.facility_code || null,
      role: r.role as StaffRole,
      active: Boolean(r.active),
      createdAt: r.created_at,
    }));
  }

  // ============================================================================
  // ROW MAPPERS
  // ============================================================================

  private mapFacilityRow(row: any): FacilityRecord {
    const geo = row.geo ? JSON.parse(row.geo) : null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      shortName: row.short_name || row.name,
      district: row.district,
      state: row.state,
      type: row.type,
      address: row.address || geo?.address,
      latitude: row.latitude ?? geo?.lat ?? null,
      longitude: row.longitude ?? geo?.lng ?? null,
      geo,
      active: Boolean(row.active),
      createdAt: row.created_at,
    };
  }

  private mapDepartmentRow(row: any, facilityCode?: string): DepartmentRecord {
    return {
      id: row.id,
      facilityId: row.facility_id,
      facilityCode,
      code: row.code,
      name: row.name,
      dailyCapacity: row.daily_capacity,
      morningHours: row.morning_hours,
      afternoonHours: row.afternoon_hours,
      roomNumber: row.room_number,
      active: Boolean(row.active),
    };
  }

  private mapSessionRow(row: any): SessionSlotRecord {
    const totalCapacity = Number(row.capacity);
    const reservedSmsQuota = Number(row.walkin_reserve);
    const bookedCount = Number(row.booked_count);
    const heldCount = Number(row.held_count);
    const occupied = bookedCount + heldCount;
    const availableCount = Math.max(0, totalCapacity - occupied);
    const lastToken = Number(row.last_token || 0);

    return {
      id: row.id,
      facilityId: row.facility_id,
      facilityCode: row.facility_code,
      departmentId: row.department_id,
      deptCode: row.dept_code,
      departmentName: row.department_name,
      roomNumber: row.room_number,
      date: row.date,
      session: row.session as SessionPeriod,
      startTime: row.start,
      endTime: row.end,
      totalCapacity,
      reservedSmsQuota,
      bookedCount,
      heldCount,
      availableCount,
      smsAvailableCount: availableCount,
      nextEstimatedToken: Math.max(lastToken + heldCount + 1, bookedCount + heldCount + 1),
      status: availableCount === 0 ? 'FULL' : (row.status as 'OPEN' | 'FULL' | 'CLOSED'),
    };
  }

  private mapPatientRow(row: any): PatientRecord {
    return {
      id: row.id,
      msisdnNormalized: row.msisdn,
      msisdnHash: row.msisdn_hash,
      phoneLast4: row.phone_last4,
      fullName: row.name,
      maskedName: maskName(row.name || 'SMS Patient'),
      abhaAddress: row.abha_address,
      abhaNumberHash: row.abha_number_hash,
      preferredLanguage: row.preferred_lang,
      consentTimestamp: row.consent_at,
      blocked: Boolean(row.blocked),
      createdAt: row.created_at,
    };
  }

  private mapBookingRow(row: any): BookingRecord {
    const patientDisplayName = row.patient_name || 'OPD Patient';
    return {
      id: row.id,
      trackingId: row.tracking_id,
      trackingIdRaw: row.tracking_id_raw,
      facilityId: row.facility_id,
      facilityCode: row.facility_code,
      facilityName: row.facility_short_name || row.facility_name,
      departmentId: row.department_id,
      deptCode: row.dept_code,
      departmentName: row.department_name,
      roomNumber: row.room_number,
      sessionId: row.session_id,
      slotDate: row.slot_date,
      session: row.session_period as SessionPeriod,
      reportingWindow: row.reporting_window,
      patientId: row.patient_id,
      patientName: row.patient_name,
      maskedPatientName: maskName(patientDisplayName),
      msisdnNormalized: row.patient_msisdn,
      phoneLast4: row.phone_last4 || maskPhoneLast4(row.patient_msisdn),
      abhaVerified: Boolean(row.abha_verified),
      abhaAddress: row.abha_address || null,
      channel: row.channel as BookingChannel,
      status: (row.status || row.state) as BookingStatus,
      tokenNumber: row.token_no ?? null,
      estimatedTokenNumber: row.estimated_token_no ?? row.token_no ?? null,
      confirmCode: row.confirm_code ?? null,
      holdExpiresAt: row.hold_expires_at ?? null,
      qrPayload: row.qr_payload ?? null,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at ?? null,
      arrivedAt: row.arrived_at ?? null,
      cancelledAt: row.cancelled_at ?? null,
      completedAt: row.completed_at ?? null,
      cancelReason: row.cancel_reason ?? null,
    };
  }

  private mapSmsInboxRow(row: any): SmsMessageRecord {
    return {
      id: row.id,
      providerMessageId: row.provider_msg_id,
      provider: row.provider,
      direction: 'INBOUND',
      msisdn: row.msisdn,
      body: row.body,
      parsedJson: row.parsed_json ? JSON.parse(row.parsed_json) : null,
      bookingId: row.booking_id,
      status: row.status,
      createdAt: row.received_at,
    };
  }

  private mapSmsOutboxRow(row: any): SmsMessageRecord {
    return {
      id: row.id,
      providerMessageId: row.provider_msg_id,
      provider: row.provider,
      direction: 'OUTBOUND',
      msisdn: row.msisdn,
      body: row.rendered,
      bookingId: row.booking_id,
      templateId: row.template_id,
      status: row.status,
      dlrStatus: row.dlr_status,
      attempts: row.attempts,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

let sharedOpdStoreInstance: SqliteOpdBookingStore | null = null;

export function getOpdBookingStore(dbPath?: string): SqliteOpdBookingStore {
  if (dbPath) {
    return new SqliteOpdBookingStore(dbPath);
  }
  if (!sharedOpdStoreInstance) {
    sharedOpdStoreInstance = new SqliteOpdBookingStore();
  }
  return sharedOpdStoreInstance;
}
