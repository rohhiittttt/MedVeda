import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Referral, ReferralStatusHistoryItem, UserRole } from '../../domain/models/referral.model.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SqliteReferralStore {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const resolvedPath =
      dbPath || path.resolve(__dirname, '../../../data/referrals.db');
    
    const dataDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new DatabaseSync(resolvedPath);
    this.initTables();
  }

  private initTables(): void {
    // 1. Referrals Table (Multi-tenant scoped by hospital, doctor, patient)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS referrals (
        id TEXT PRIMARY KEY,
        referral_id TEXT UNIQUE NOT NULL,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        patient_age INTEGER NOT NULL,
        patient_sex TEXT NOT NULL,
        patient_phone TEXT,
        patient_location TEXT NOT NULL,
        patient_latitude REAL,
        patient_longitude REAL,
        referring_doctor_id TEXT NOT NULL,
        referring_doctor_name TEXT NOT NULL,
        referring_facility_id TEXT NOT NULL,
        referring_facility_name TEXT NOT NULL,
        receiving_facility_id TEXT NOT NULL,
        receiving_facility_name TEXT NOT NULL,
        receiving_facility_address TEXT,
        department_referred_to TEXT NOT NULL,
        specialty TEXT NOT NULL,
        reason TEXT NOT NULL,
        clinical_summary TEXT,
        urgency TEXT NOT NULL DEFAULT 'Normal',
        icu_patient INTEGER NOT NULL DEFAULT 0,
        current_step INTEGER NOT NULL DEFAULT 1,
        priority_rank INTEGER NOT NULL DEFAULT 2,
        status TEXT NOT NULL DEFAULT 'REFERRAL_INITIATED',
        treating_doctor_json TEXT,
        bed_allocation_json TEXT,
        digital_signature_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_ref_doctor ON referrals(referring_doctor_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_rec_facility ON referrals(receiving_facility_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_ref_facility ON referrals(referring_facility_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

      CREATE TABLE IF NOT EXISTS referral_history (
        id TEXT PRIMARY KEY,
        referral_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        user_role TEXT NOT NULL,
        remarks TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (referral_id) REFERENCES referrals(referral_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_history_ref ON referral_history(referral_id);
    `);

    // Seed benchmark entries if empty
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM referrals');
    const result = countStmt.get() as { count: number };
    if (!result || result.count === 0) {
      this.seedInitialData();
    }
  }

  private seedInitialData(): void {
    const seedData: Referral[] = [
      {
        id: 'ref_seed_1',
        referralId: 'REF-2026-00125',
        patientId: 'PAT-1024',
        patientName: 'Ramesh Mahto',
        patientAge: 48,
        patientSex: 'male',
        patientPhone: '+91-94311-28901',
        patientLocation: 'Katkamsandi, Hazaribagh',
        referringDoctorId: 'doc_1',
        referringDoctorName: 'Dr. Priya Sharma',
        referringFacilityId: 'fac_phc_katkamsandi',
        referringFacilityName: 'Katkamsandi Primary Health Centre',
        receivingFacilityId: 'fac_sbmch',
        receivingFacilityName: 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)',
        departmentReferredTo: 'Cardiology',
        specialty: 'Cardiology',
        reason: 'Severe exertional angina and ST depression on field ECG',
        clinicalSummary: '48M presenting with progressive retrosternal pain for 3 days. SBP 154/96 mmHg. Initial aspirin and nitrates administered. Referred for emergency coronary evaluation.',
        urgency: 'Emergency',
        icuPatient: true,
        currentStep: 1,
        treatingDoctor: null,
        digitalSignature: { doctorName: 'Dr. Priya Sharma', signedAt: '2026-08-31T10:20:00.000Z', imageOrInitialsSVG: 'P.S.' },
        bedAllocation: null,
        priorityRank: 1,
        status: 'REFERRAL_INITIATED',
        createdAt: '2026-08-31T10:20:00.000Z',
        updatedAt: '2026-08-31T12:30:00.000Z',
        statusHistory: [
          {
            id: 'hist_1',
            referralId: 'REF-2026-00125',
            fromStatus: null,
            toStatus: 'REFERRAL_INITIATED',
            updatedBy: 'Dr. Priya Sharma',
            userRole: 'doctor',
            remarks: 'Digital referral initiated via MedVeda.',
            timestamp: '2026-08-31T10:20:00.000Z'
          }
        ]
      },
      {
        id: 'ref_seed_2',
        referralId: 'REF-2026-00126',
        patientId: 'PAT-1056',
        patientName: 'Sunita Soren',
        patientAge: 32,
        patientSex: 'female',
        patientPhone: '+91-98350-11234',
        patientLocation: 'Barkagaon, Hazaribagh',
        referringDoctorId: 'doc_4',
        referringDoctorName: 'Dr. Kavita Murmu',
        referringFacilityId: 'fac_chc_barkagaon',
        referringFacilityName: 'Barkagaon Community Health Centre',
        receivingFacilityId: 'fac_sadar',
        receivingFacilityName: 'Sadar Hospital Hazaribagh',
        departmentReferredTo: 'Maternity Wing',
        specialty: 'Obstetrics & Gynecology',
        reason: 'High-risk primigravida at 34 weeks with severe pre-eclampsia',
        clinicalSummary: 'BP 160/105 mmHg, bilateral pedal edema +++, 2+ proteinuria on dipstick. Needs urgent maternal ICU monitoring.',
        urgency: 'Emergency',
        icuPatient: true,
        currentStep: 2,
        treatingDoctor: null,
        digitalSignature: { doctorName: 'Dr. Kavita Murmu', signedAt: '2026-08-31T11:00:00.000Z', imageOrInitialsSVG: 'K.M.' },
        bedAllocation: null,
        priorityRank: 1,
        status: 'ACCEPTED',
        createdAt: '2026-08-31T11:00:00.000Z',
        updatedAt: '2026-08-31T11:05:00.000Z',
        statusHistory: [
          {
            id: 'hist_4',
            referralId: 'REF-2026-00126',
            fromStatus: null,
            toStatus: 'REFERRAL_INITIATED',
            updatedBy: 'Dr. Kavita Murmu',
            userRole: 'doctor',
            remarks: 'High-risk antenatal referral created.',
            timestamp: '2026-08-31T11:00:00.000Z'
          },
          {
            id: 'hist_5',
            referralId: 'REF-2026-00126',
            fromStatus: 'REFERRAL_INITIATED',
            toStatus: 'ACCEPTED',
            updatedBy: 'Sadar Admission Desk',
            userRole: 'facility',
            remarks: 'Accepted by Sadar Hospital Maternity Wing.',
            timestamp: '2026-08-31T11:05:00.000Z'
          }
        ]
      },
      {
        id: 'ref_seed_3',
        referralId: 'REF-2026-00127',
        patientId: 'PAT-1088',
        patientName: 'Kishore Gope',
        patientAge: 62,
        patientSex: 'male',
        patientPhone: '+91-94301-44556',
        patientLocation: 'Mandu, Ramgarh',
        referringDoctorId: 'doc_2',
        referringDoctorName: 'Dr. Rajesh Verma',
        referringFacilityId: 'fac_sadar',
        referringFacilityName: 'Sadar Hospital Hazaribagh',
        receivingFacilityId: 'fac_kalyani',
        receivingFacilityName: 'Kalyani Super Specialty Hospital & Trauma Centre',
        departmentReferredTo: 'Neurology',
        specialty: 'Neurology',
        reason: 'Ischemic stroke rehabilitation & advanced neuro-imaging evaluation',
        clinicalSummary: 'Post acute stroke day 12, recovering right hemiparesis. Referred for neuro-rehabilitation assessment.',
        urgency: 'Normal',
        icuPatient: false,
        currentStep: 6,
        treatingDoctor: { id: 'doc_kalyani_1', name: 'Dr. S. K. Mukherjee', specialty: 'Neurology' },
        digitalSignature: { doctorName: 'Dr. Rajesh Verma', signedAt: '2026-08-30T09:00:00.000Z', imageOrInitialsSVG: 'R.V.' },
        bedAllocation: { bedId: 'BED-304', ward: 'Neuro Ward B', reservedAt: '2026-08-30T10:00:00.000Z', allottedAt: '2026-08-30T14:30:00.000Z' },
        priorityRank: 3,
        status: 'COMPLETED',
        createdAt: '2026-08-30T09:00:00.000Z',
        updatedAt: '2026-08-30T16:00:00.000Z',
        statusHistory: [
          {
            id: 'hist_6',
            referralId: 'REF-2026-00127',
            fromStatus: null,
            toStatus: 'REFERRAL_INITIATED',
            updatedBy: 'Dr. Rajesh Verma',
            userRole: 'doctor',
            remarks: 'Neuro rehab referral created.',
            timestamp: '2026-08-30T09:00:00.000Z'
          },
          {
            id: 'hist_10',
            referralId: 'REF-2026-00127',
            fromStatus: 'TREATMENT_ONGOING',
            toStatus: 'COMPLETED',
            updatedBy: 'Dr. S. K. Mukherjee (Kalyani)',
            userRole: 'facility',
            remarks: 'Neuro assessment completed. MRI Brain performed. Physical therapy initiated.',
            timestamp: '2026-08-30T16:00:00.000Z'
          }
        ]
      }
    ];

    for (const ref of seedData) {
      this.save(ref);
      for (const h of ref.statusHistory) {
        this.appendHistory(h);
      }
    }
  }

  public save(referral: Referral): Referral {
    const insertOrReplace = this.db.prepare(`
      INSERT INTO referrals (
        id, referral_id, patient_id, patient_name, patient_age, patient_sex, patient_phone,
        patient_location, patient_latitude, patient_longitude,
        referring_doctor_id, referring_doctor_name, referring_facility_id, referring_facility_name,
        receiving_facility_id, receiving_facility_name, receiving_facility_address,
        department_referred_to, specialty, reason, clinical_summary, urgency, icu_patient,
        current_step, priority_rank, status, treating_doctor_json, bed_allocation_json,
        digital_signature_json, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
      ON CONFLICT(referral_id) DO UPDATE SET
        patient_name = excluded.patient_name,
        patient_age = excluded.patient_age,
        patient_sex = excluded.patient_sex,
        patient_phone = excluded.patient_phone,
        patient_location = excluded.patient_location,
        patient_latitude = excluded.patient_latitude,
        patient_longitude = excluded.patient_longitude,
        current_step = excluded.current_step,
        priority_rank = excluded.priority_rank,
        status = excluded.status,
        treating_doctor_json = excluded.treating_doctor_json,
        bed_allocation_json = excluded.bed_allocation_json,
        digital_signature_json = excluded.digital_signature_json,
        updated_at = excluded.updated_at;
    `);

    insertOrReplace.run(
      referral.id,
      referral.referralId,
      referral.patientId,
      referral.patientName,
      referral.patientAge,
      referral.patientSex,
      referral.patientPhone || null,
      referral.patientLocation,
      (referral as any).patientLatitude || null,
      (referral as any).patientLongitude || null,
      referral.referringDoctorId,
      referral.referringDoctorName,
      referral.referringFacilityId,
      referral.referringFacilityName,
      referral.receivingFacilityId,
      referral.receivingFacilityName,
      (referral as any).receivingFacilityAddress || null,
      referral.departmentReferredTo,
      referral.specialty,
      referral.reason,
      referral.clinicalSummary || null,
      referral.urgency || 'Normal',
      referral.icuPatient ? 1 : 0,
      referral.currentStep || 1,
      referral.priorityRank || 2,
      referral.status,
      referral.treatingDoctor ? JSON.stringify(referral.treatingDoctor) : null,
      referral.bedAllocation ? JSON.stringify(referral.bedAllocation) : null,
      referral.digitalSignature ? JSON.stringify(referral.digitalSignature) : null,
      referral.createdAt,
      referral.updatedAt
    );

    return referral;
  }

  public findByReferralId(referralId: string): Referral | null {
    const row = this.db.prepare('SELECT * FROM referrals WHERE referral_id = ?').get(referralId) as any;
    if (!row) return null;
    return this.mapRowToReferral(row);
  }

  public findById(id: string): Referral | null {
    const row = this.db.prepare('SELECT * FROM referrals WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRowToReferral(row);
  }

  /**
   * Multi-tenant query: filters referrals so data doesn't overlap across hospitals, doctors, or patients.
   */
  public findAll(tenantFilter?: { facilityId?: string; doctorId?: string; patientId?: string; search?: string }): Referral[] {
    let sql = 'SELECT * FROM referrals WHERE 1=1';
    const params: any[] = [];

    if (tenantFilter?.facilityId) {
      sql += ' AND (receiving_facility_id = ? OR referring_facility_id = ?)';
      params.push(tenantFilter.facilityId, tenantFilter.facilityId);
    }

    if (tenantFilter?.doctorId) {
      sql += ' AND referring_doctor_id = ?';
      params.push(tenantFilter.doctorId);
    }

    if (tenantFilter?.patientId) {
      sql += ' AND (patient_id = ? OR LOWER(patient_name) = LOWER(?))';
      params.push(tenantFilter.patientId, tenantFilter.patientId);
    }

    if (tenantFilter?.search) {
      sql += ' AND (LOWER(referral_id) LIKE ? OR LOWER(patient_name) LIKE ? OR LOWER(specialty) LIKE ? OR LOWER(receiving_facility_name) LIKE ?)';
      const term = `%${tenantFilter.search.toLowerCase()}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapRowToReferral(r));
  }

  public appendHistory(item: ReferralStatusHistoryItem): void {
    const insertHistory = this.db.prepare(`
      INSERT INTO referral_history (id, referral_id, from_status, to_status, updated_by, user_role, remarks, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertHistory.run(
      item.id,
      item.referralId,
      item.fromStatus,
      item.toStatus,
      item.updatedBy,
      item.userRole,
      item.remarks,
      item.timestamp
    );
  }

  public getHistoryByReferralId(referralId: string): ReferralStatusHistoryItem[] {
    const rows = this.db.prepare(
      'SELECT * FROM referral_history WHERE referral_id = ? ORDER BY timestamp ASC'
    ).all(referralId) as any[];

    return rows.map((r) => ({
      id: r.id,
      referralId: r.referral_id,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      updatedBy: r.updated_by,
      userRole: r.user_role as UserRole,
      remarks: r.remarks,
      timestamp: r.timestamp
    }));
  }

  public getNextSequenceNumber(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM referrals').get() as { count: number };
    return (row?.count || 0) + 128;
  }

  public delete(referralId: string): boolean {
    const res = this.db.prepare('DELETE FROM referrals WHERE referral_id = ?').run(referralId);
    this.db.prepare('DELETE FROM referral_history WHERE referral_id = ?').run(referralId);
    return res.changes > 0;
  }

  private mapRowToReferral(row: any): Referral {
    const history = this.getHistoryByReferralId(row.referral_id);

    return {
      id: row.id,
      referralId: row.referral_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientAge: row.patient_age,
      patientSex: row.patient_sex,
      patientPhone: row.patient_phone || undefined,
      patientLocation: row.patient_location,
      referringDoctorId: row.referring_doctor_id,
      referringDoctorName: row.referring_doctor_name,
      referringFacilityId: row.referring_facility_id,
      referringFacilityName: row.referring_facility_name,
      receivingFacilityId: row.receiving_facility_id,
      receivingFacilityName: row.receiving_facility_name,
      departmentReferredTo: row.department_referred_to,
      specialty: row.specialty,
      reason: row.reason,
      clinicalSummary: row.clinical_summary || '',
      urgency: row.urgency,
      icuPatient: Boolean(row.icu_patient),
      currentStep: row.current_step,
      treatingDoctor: row.treating_doctor_json ? JSON.parse(row.treating_doctor_json) : null,
      digitalSignature: row.digital_signature_json ? JSON.parse(row.digital_signature_json) : null,
      bedAllocation: row.bed_allocation_json ? JSON.parse(row.bed_allocation_json) : null,
      priorityRank: row.priority_rank,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      statusHistory: history
    };
  }
}
