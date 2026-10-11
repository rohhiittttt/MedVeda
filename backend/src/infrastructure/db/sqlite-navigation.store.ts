import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HospitalCandidate } from '../../domain/models/hospital.model.ts';
import type { IHospitalCachePort } from '../../domain/ports/search.port.ts';
import type { TriageInput, TriageAssessment } from '../../domain/models/triage.model.ts';
import type { RankedFacility } from '../../domain/models/recommendation.model.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const DEFAULT_REGIONAL_SEED: HospitalCandidate[] = [
  {
    id: 'fac_sbmch_hazaribagh',
    name: 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)',
    address: 'Near Canary Hill Road, Hazaribagh, Jharkhand',
    distanceKm: 2.8,
    latitude: 24.0082,
    longitude: 85.3694,
    hasEmergencyDepartment: true,
    hasRequiredSpecialty: true,
    specialtyMode: 'EMERGENCY_AND_OPD',
    emergencySpecialtyVerified: true,
    verificationStatus: 'verified',
    verificationNotes:
      'Premier 500-bed government medical college with 24x7 Emergency Casualty, Acute Stroke Management, 128-slice CT diagnostics, and round-the-clock ICU.',
    contactNumber: '+91-6546-270100',
    sources: [
      { type: 'official_website', url: 'https://sbmch.jharkhand.gov.in/emergency', reliability: 'primary' },
      { type: 'government_directory', url: 'https://nhm.jharkhand.gov.in/medical-colleges', reliability: 'high' }
    ]
  },
  {
    id: 'fac_arogyam_hazaribagh',
    name: 'Arogyam Multi-Specialty Hospital & Critical Care',
    address: 'Indraprastha Colony, Hazaribagh, Jharkhand',
    distanceKm: 4.8,
    latitude: 23.9965,
    longitude: 85.3589,
    hasEmergencyDepartment: true,
    hasRequiredSpecialty: true,
    specialtyMode: 'EMERGENCY_AND_OPD',
    emergencySpecialtyVerified: true,
    verificationStatus: 'verified',
    verificationNotes:
      'Multi-specialty hospital with 24x7 active emergency trauma care, on-call neurological team, and advanced critical care ICU.',
    contactNumber: '+91-6546-271000',
    sources: [
      { type: 'official_website', url: 'https://arogyamhospitals.com/emergency-care', reliability: 'primary' },
      { type: 'reputable_platform', url: 'https://justdial.com/Hazaribag/Arogyam-Hospital', reliability: 'high' }
    ]
  },
  {
    id: 'fac_kalyani_ramgarh',
    name: 'Kalyani Super Specialty Hospital & Trauma Centre',
    address: 'NH33, Ramgarh Cantt, Jharkhand (38 km from Hazaribagh)',
    distanceKm: 38.0,
    latitude: 23.6302,
    longitude: 85.5155,
    hasEmergencyDepartment: true,
    hasRequiredSpecialty: true,
    specialtyMode: 'EMERGENCY_AND_OPD',
    emergencySpecialtyVerified: true,
    verificationStatus: 'verified',
    verificationNotes:
      'Super-specialty center within 50 km radius offering 24x7 acute stroke care, neuro-trauma unit, and emergency interventional services.',
    contactNumber: '+91-6553-228400',
    sources: [
      { type: 'official_website', url: 'https://kalyanihospital.org/trauma-emergency', reliability: 'primary' }
    ]
  },
  {
    id: 'fac_sadar_hazaribagh',
    name: 'Sadar Hospital Hazaribagh',
    address: 'Main Hospital Road, Hazaribagh, Jharkhand',
    distanceKm: 3.2,
    latitude: 23.9921,
    longitude: 85.3612,
    hasEmergencyDepartment: true,
    hasRequiredSpecialty: true,
    specialtyMode: 'OPD_ONLY',
    emergencySpecialtyVerified: false,
    verificationStatus: 'partially_verified',
    verificationNotes:
      'District hospital with casualty triage and daytime specialty OPD consultations; transfers complex neurological cases to SBMC&H or tertiary centers.',
    contactNumber: '+91-6546-264210',
    sources: [
      { type: 'government_directory', url: 'https://hazaribag.nic.in/health-facilities', reliability: 'high' }
    ]
  },
  {
    id: 'fac_ranchi_super',
    name: 'Ranchi Super Specialty Hospital',
    address: 'Bariatu Road, Ranchi, Jharkhand (92 km via NH20)',
    distanceKm: 92.0,
    latitude: 23.3911,
    longitude: 85.3497,
    hasEmergencyDepartment: true,
    hasRequiredSpecialty: true,
    specialtyMode: 'EMERGENCY_AND_OPD',
    emergencySpecialtyVerified: true,
    verificationStatus: 'verified',
    verificationNotes:
      'Tertiary super-specialty stroke referral center with comprehensive neuro-surgery and advanced intervention.',
    contactNumber: '+91-651-2541234',
    sources: [
      { type: 'official_website', url: 'https://ranchisuperspecialty.org/stroke-unit', reliability: 'primary' },
      { type: 'government_directory', url: 'https://nhm.jharkhand.gov.in/tertiary-centers', reliability: 'high' }
    ]
  }
];

export interface PersistedTriageSession {
  readonly id: string;
  readonly sessionToken: string;
  readonly age: number;
  readonly sex: string;
  readonly locationName: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly primarySymptoms: string;
  readonly additionalSymptoms: string | null;
  readonly severity: string;
  readonly duration: string;
  readonly vitals: Record<string, unknown>;
  readonly medicalHistory: string[];
  readonly urgency: string;
  readonly emergencyRequired: boolean;
  readonly requiredSpecialty: string;
  readonly conditionCategory: string;
  readonly clinicalRoutingAdvice: string;
  readonly searchQueries: string[];
  readonly createdAt: string;
  readonly recommendations?: RankedFacility[];
}

export class SqliteNavigationStore implements IHospitalCachePort {
  private readonly db: DatabaseSync;
  private readonly ttlMs: number;

  constructor(dbPath?: string, ttlMs: number = DEFAULT_CACHE_TTL_MS) {
    this.ttlMs = ttlMs;
    const isMemory = dbPath === ':memory:';
    const resolvedPath = isMemory
      ? ':memory:'
      : dbPath || path.resolve(__dirname, '../../../data/navigation.db');

    if (!isMemory) {
      const dataDir = path.dirname(resolvedPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(resolvedPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS triage_sessions (
        id TEXT PRIMARY KEY,
        session_token TEXT NOT NULL,
        age INTEGER NOT NULL,
        sex TEXT NOT NULL,
        location_name TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        primary_symptoms TEXT NOT NULL,
        additional_symptoms TEXT,
        severity TEXT NOT NULL,
        duration TEXT NOT NULL,
        vitals_json TEXT NOT NULL DEFAULT '{}',
        medical_history_json TEXT NOT NULL DEFAULT '[]',
        urgency TEXT NOT NULL,
        emergency_required INTEGER NOT NULL,
        required_specialty TEXT NOT NULL,
        condition_category TEXT NOT NULL,
        clinical_routing_advice TEXT NOT NULL,
        search_queries_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_triage_sessions_token ON triage_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_triage_sessions_location ON triage_sessions(location_name);
      CREATE INDEX IF NOT EXISTS idx_triage_sessions_created ON triage_sessions(created_at);

      CREATE TABLE IF NOT EXISTS hospital_research_cache (
        id TEXT PRIMARY KEY,
        facility_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        address TEXT NOT NULL,
        city_district TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        distance_km REAL NOT NULL DEFAULT 0,
        contact_number TEXT,
        has_emergency_department INTEGER NOT NULL DEFAULT 0,
        has_required_specialty INTEGER NOT NULL DEFAULT 1,
        specialty_mode TEXT NOT NULL DEFAULT 'UNKNOWN',
        emergency_specialty_verified INTEGER NOT NULL DEFAULT 0,
        verification_status TEXT NOT NULL DEFAULT 'unverified',
        verification_notes TEXT,
        sources_json TEXT NOT NULL DEFAULT '[]',
        last_researched_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_hospital_cache_district ON hospital_research_cache(city_district);
      CREATE INDEX IF NOT EXISTS idx_hospital_cache_expires ON hospital_research_cache(expires_at);

      CREATE TABLE IF NOT EXISTS triage_recommendations (
        id TEXT PRIMARY KEY,
        triage_session_id TEXT NOT NULL,
        rank INTEGER NOT NULL,
        facility_id TEXT,
        facility_name TEXT NOT NULL,
        address TEXT NOT NULL,
        distance_km REAL NOT NULL,
        distance_display TEXT NOT NULL,
        emergency_dept_verified INTEGER NOT NULL,
        specialty_emergency_verified INTEGER NOT NULL,
        specialty_mode TEXT NOT NULL,
        verification_status TEXT NOT NULL,
        clinical_suitability_score REAL NOT NULL,
        distance_score REAL NOT NULL,
        total_score REAL NOT NULL,
        explanation TEXT NOT NULL,
        contact_number TEXT,
        navigation_uri TEXT,
        sources_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        FOREIGN KEY (triage_session_id) REFERENCES triage_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_triage_recs_session ON triage_recommendations(triage_session_id);
    `);

    const countRow = this.db
      .prepare('SELECT COUNT(*) as count FROM hospital_research_cache')
      .get() as { count: number };
    if (!countRow || countRow.count === 0) {
      for (const candidate of DEFAULT_REGIONAL_SEED) {
        this.upsertHospitalSync(candidate, 'Hazaribagh, Jharkhand');
      }
    }
  }

  private upsertHospitalSync(candidate: HospitalCandidate, defaultLocation = ''): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs).toISOString();
    const nowIso = now.toISOString();
    const normalizedName = candidate.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cityDistrict = this.extractCityDistrict(candidate.address, defaultLocation);

    const stmt = this.db.prepare(`
      INSERT INTO hospital_research_cache (
        id, facility_name, normalized_name, address, city_district,
        latitude, longitude, distance_km, contact_number,
        has_emergency_department, has_required_specialty, specialty_mode,
        emergency_specialty_verified, verification_status, verification_notes,
        sources_json, last_researched_at, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        facility_name = excluded.facility_name,
        normalized_name = excluded.normalized_name,
        address = excluded.address,
        city_district = excluded.city_district,
        latitude = COALESCE(excluded.latitude, hospital_research_cache.latitude),
        longitude = COALESCE(excluded.longitude, hospital_research_cache.longitude),
        distance_km = excluded.distance_km,
        contact_number = COALESCE(excluded.contact_number, hospital_research_cache.contact_number),
        has_emergency_department = excluded.has_emergency_department,
        has_required_specialty = excluded.has_required_specialty,
        specialty_mode = excluded.specialty_mode,
        emergency_specialty_verified = excluded.emergency_specialty_verified,
        verification_status = excluded.verification_status,
        verification_notes = excluded.verification_notes,
        sources_json = excluded.sources_json,
        last_researched_at = excluded.last_researched_at,
        expires_at = excluded.expires_at
    `);

    stmt.run(
      candidate.id,
      candidate.name,
      normalizedName,
      candidate.address,
      cityDistrict,
      candidate.latitude ?? null,
      candidate.longitude ?? null,
      candidate.distanceKm,
      candidate.contactNumber ?? null,
      candidate.hasEmergencyDepartment ? 1 : 0,
      candidate.hasRequiredSpecialty ? 1 : 0,
      candidate.specialtyMode,
      candidate.emergencySpecialtyVerified ? 1 : 0,
      candidate.verificationStatus,
      candidate.verificationNotes ?? '',
      JSON.stringify(candidate.sources || []),
      nowIso,
      expiresAt,
      nowIso
    );
  }

  private extractCityDistrict(address: string, fallback: string): string {
    if (fallback && fallback.trim().length > 0) {
      return fallback.trim();
    }
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(-2).join(', ');
    }
    return address || 'Jharkhand';
  }

  private mapRowToCandidate(row: Record<string, any>): HospitalCandidate {
    return {
      id: String(row.id),
      name: String(row.facility_name),
      address: String(row.address),
      distanceKm: Number(row.distance_km),
      ...(row.latitude !== null && row.latitude !== undefined ? { latitude: Number(row.latitude) } : {}),
      ...(row.longitude !== null && row.longitude !== undefined ? { longitude: Number(row.longitude) } : {}),
      hasEmergencyDepartment: Boolean(row.has_emergency_department),
      hasRequiredSpecialty: Boolean(row.has_required_specialty),
      specialtyMode: row.specialty_mode as HospitalCandidate['specialtyMode'],
      emergencySpecialtyVerified: Boolean(row.emergency_specialty_verified),
      verificationStatus: row.verification_status as HospitalCandidate['verificationStatus'],
      verificationNotes: String(row.verification_notes || ''),
      contactNumber: row.contact_number ? String(row.contact_number) : null,
      sources: JSON.parse(String(row.sources_json || '[]'))
    };
  }

  async findNearby(
    location: string,
    _specialty: string,
    _emergencyRequired: boolean
  ): Promise<readonly HospitalCandidate[]> {
    const nowIso = new Date().toISOString();

    // Purge expired dynamic rows (preserve default seed IDs)
    this.db
      .prepare(
        `DELETE FROM hospital_research_cache WHERE expires_at < ? AND id NOT LIKE 'fac_%'`
      )
      .run(nowIso);

    const allRows = this.db
      .prepare('SELECT * FROM hospital_research_cache ORDER BY distance_km ASC')
      .all() as Record<string, any>[];

    const allCandidates = allRows.map((r) => this.mapRowToCandidate(r));

    const locTokens = (location || '')
      .toLowerCase()
      .split(/[,/\s-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);

    if (locTokens.length > 0) {
      const matched = allCandidates.filter((c) => {
        const hay = `${c.name} ${c.address}`.toLowerCase();
        return locTokens.some((tok) => hay.includes(tok));
      });
      if (matched.length > 0) {
        return matched;
      }
    }

    return allCandidates;
  }

  async save(candidate: HospitalCandidate, locationContext = ''): Promise<void> {
    this.upsertHospitalSync(candidate, locationContext);
  }

  async saveBatch(candidates: readonly HospitalCandidate[], locationContext = ''): Promise<void> {
    for (const c of candidates) {
      this.upsertHospitalSync(c, locationContext);
    }
  }

  // ==========================================
  // Triage Sessions & Recommendations Persistence
  // ==========================================
  saveTriageSession(
    sessionId: string,
    input: TriageInput & { latitude?: number; longitude?: number; sessionToken?: string },
    triage: TriageAssessment
  ): PersistedTriageSession {
    const nowIso = new Date().toISOString();
    const sessionToken = input.sessionToken || sessionId;

    this.db
      .prepare(
        `
      INSERT INTO triage_sessions (
        id, session_token, age, sex, location_name, latitude, longitude,
        primary_symptoms, additional_symptoms, severity, duration,
        vitals_json, medical_history_json, urgency, emergency_required,
        required_specialty, condition_category, clinical_routing_advice,
        search_queries_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        urgency = excluded.urgency,
        emergency_required = excluded.emergency_required,
        required_specialty = excluded.required_specialty,
        condition_category = excluded.condition_category,
        clinical_routing_advice = excluded.clinical_routing_advice,
        search_queries_json = excluded.search_queries_json
    `
      )
      .run(
        sessionId,
        sessionToken,
        Number(input.age || 35),
        String(input.sex || 'unknown'),
        String(input.location || 'India'),
        input.latitude ?? null,
        input.longitude ?? null,
        String(input.primarySymptoms || ''),
        input.additionalNotes ?? null,
        String(input.severity || 'moderate'),
        String(input.duration || 'unknown'),
        JSON.stringify(input.vitals || {}),
        JSON.stringify(input.medicalHistory || []),
        triage.urgency,
        triage.emergencyRequired ? 1 : 0,
        triage.requiredSpecialty,
        triage.conditionCategory,
        triage.clinicalRoutingAdvice,
        JSON.stringify(triage.searchQueries || []),
        nowIso
      );

    return this.getTriageSession(sessionId)!;
  }

  saveRecommendations(sessionId: string, recommendations: readonly RankedFacility[]): void {
    const nowIso = new Date().toISOString();
    this.db.prepare('DELETE FROM triage_recommendations WHERE triage_session_id = ?').run(sessionId);

    const stmt = this.db.prepare(`
      INSERT INTO triage_recommendations (
        id, triage_session_id, rank, facility_id, facility_name, address,
        distance_km, distance_display, emergency_dept_verified,
        specialty_emergency_verified, specialty_mode, verification_status,
        clinical_suitability_score, distance_score, total_score,
        explanation, contact_number, navigation_uri, sources_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const rec of recommendations) {
      const recId = `rec_${sessionId}_${rec.rank}`;
      const navUri = `https://maps.google.com/?q=${encodeURIComponent(`${rec.name} ${rec.address}`)}`;
      // Ensure referenced facility exists in hospital_research_cache if foreign key is active
      const facExists = this.db
        .prepare('SELECT id FROM hospital_research_cache WHERE id = ?')
        .get(rec.id) as { id: string } | undefined;

      stmt.run(
        recId,
        sessionId,
        rec.rank,
        facExists ? rec.id : null,
        rec.name,
        rec.address,
        rec.distanceKm,
        `${rec.distanceKm.toFixed(1)} km`,
        rec.hasEmergencyDepartment ? 1 : 0,
        rec.emergencySpecialtyVerified ? 1 : 0,
        rec.specialtyMode,
        rec.verificationStatus,
        rec.clinicalSuitabilityScore,
        rec.distanceScore,
        rec.totalScore,
        rec.clinicalExplanation,
        rec.contactNumber ?? null,
        navUri,
        JSON.stringify(rec.sources || []),
        nowIso
      );
    }
  }

  getTriageSession(sessionId: string): PersistedTriageSession | null {
    const row = this.db
      .prepare('SELECT * FROM triage_sessions WHERE id = ?')
      .get(sessionId) as Record<string, any> | undefined;
    if (!row) return null;

    const recommendations = this.getRecommendationsBySession(sessionId);
    return {
      id: String(row.id),
      sessionToken: String(row.session_token),
      age: Number(row.age),
      sex: String(row.sex),
      locationName: String(row.location_name),
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      primarySymptoms: String(row.primary_symptoms),
      additionalSymptoms: row.additional_symptoms ? String(row.additional_symptoms) : null,
      severity: String(row.severity),
      duration: String(row.duration),
      vitals: JSON.parse(String(row.vitals_json || '{}')),
      medicalHistory: JSON.parse(String(row.medical_history_json || '[]')),
      urgency: String(row.urgency),
      emergencyRequired: Boolean(row.emergency_required),
      requiredSpecialty: String(row.required_specialty),
      conditionCategory: String(row.condition_category),
      clinicalRoutingAdvice: String(row.clinical_routing_advice),
      searchQueries: JSON.parse(String(row.search_queries_json || '[]')),
      createdAt: String(row.created_at),
      recommendations
    };
  }

  getRecommendationsBySession(sessionId: string): RankedFacility[] {
    const rows = this.db
      .prepare('SELECT * FROM triage_recommendations WHERE triage_session_id = ? ORDER BY rank ASC')
      .all(sessionId) as Record<string, any>[];

    return rows.map((r) => ({
      id: String(r.facility_id || r.id),
      name: String(r.facility_name),
      address: String(r.address),
      distanceKm: Number(r.distance_km),
      hasEmergencyDepartment: Boolean(r.emergency_dept_verified),
      hasRequiredSpecialty: true,
      specialtyMode: r.specialty_mode as RankedFacility['specialtyMode'],
      emergencySpecialtyVerified: Boolean(r.specialty_emergency_verified),
      verificationStatus: r.verification_status as RankedFacility['verificationStatus'],
      verificationNotes: String(r.explanation),
      contactNumber: r.contact_number ? String(r.contact_number) : null,
      sources: JSON.parse(String(r.sources_json || '[]')),
      rank: Number(r.rank),
      clinicalSuitabilityScore: Number(r.clinical_suitability_score),
      distanceScore: Number(r.distance_score),
      totalScore: Number(r.total_score),
      clinicalExplanation: String(r.explanation)
    }));
  }

  listRecentTriageSessions(limit = 25): PersistedTriageSession[] {
    const rows = this.db
      .prepare('SELECT id FROM triage_sessions ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Array<{ id: string }>;
    return rows
      .map((r) => this.getTriageSession(r.id))
      .filter((s): s is PersistedTriageSession => s !== null);
  }
}
