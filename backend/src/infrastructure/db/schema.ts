import {
  pgTable,
  uuid,
  varchar,
  integer,
  real,
  text,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
  index
} from 'drizzle-orm/pg-core';

// ==========================================
// 1. Enums (Clinical & Operational)
// ==========================================
export const urgencyEnum = pgEnum('urgency_level', ['CRITICAL', 'URGENT', 'NON_URGENT', 'ROUTINE']);
export const specialtyModeEnum = pgEnum('specialty_mode', [
  'EMERGENCY_AND_OPD',
  'OPD_ONLY',
  'EMERGENCY_ONLY',
  'UNKNOWN'
]);
export const verificationStatusEnum = pgEnum('verification_status', [
  'verified',
  'partially_verified',
  'unverified'
]);

// ==========================================
// 2. Feature 01: Smart Care Navigation & Triage
// ==========================================
export const triageSessions = pgTable(
  'triage_sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    sessionToken: varchar('session_token', { length: 64 }).notNull(),
    age: integer('age').notNull(),
    sex: varchar('sex', { length: 16 }).notNull(),
    locationName: varchar('location_name', { length: 128 }).notNull(),
    latitude: real('latitude'),
    longitude: real('longitude'),
    primarySymptoms: text('primary_symptoms').notNull(),
    additionalSymptoms: text('additional_symptoms'),
    severity: varchar('severity', { length: 32 }).notNull(),
    duration: varchar('duration', { length: 64 }).notNull(),
    vitals: jsonb('vitals').default({}).notNull(),
    medicalHistory: jsonb('medical_history').default([]).notNull(),
    urgency: urgencyEnum('urgency').notNull(),
    emergencyRequired: boolean('emergency_required').notNull(),
    requiredSpecialty: varchar('required_specialty', { length: 64 }).notNull(),
    conditionCategory: varchar('condition_category', { length: 128 }).notNull(),
    clinicalRoutingAdvice: text('clinical_routing_advice').notNull(),
    searchQueries: jsonb('search_queries').default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    sessionTokenIdx: index('idx_triage_sessions_token').on(table.sessionToken),
    locationIdx: index('idx_triage_sessions_location').on(table.locationName)
  })
);

export const hospitalResearchCache = pgTable(
  'hospital_research_cache',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    facilityName: varchar('facility_name', { length: 255 }).notNull(),
    normalizedName: varchar('normalized_name', { length: 255 }).notNull(),
    address: text('address').notNull(),
    cityDistrict: varchar('city_district', { length: 128 }).notNull(),
    latitude: real('latitude'),
    longitude: real('longitude'),
    distanceKm: real('distance_km').default(0).notNull(),
    contactNumber: varchar('contact_number', { length: 32 }),
    hasEmergencyDepartment: boolean('has_emergency_department').default(false).notNull(),
    hasRequiredSpecialty: boolean('has_required_specialty').default(true).notNull(),
    specialtyMode: specialtyModeEnum('specialty_mode').default('UNKNOWN').notNull(),
    emergencySpecialtyVerified: boolean('emergency_specialty_verified').default(false).notNull(),
    specialtyAvailability: jsonb('specialty_availability').default({}).notNull(),
    verificationStatus: verificationStatusEnum('verification_status').default('unverified').notNull(),
    verificationNotes: text('verification_notes'),
    sources: jsonb('sources').default([]).notNull(),
    lastResearchedAt: timestamp('last_researched_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    districtIdx: index('idx_hospitals_district').on(table.cityDistrict),
    expiresIdx: index('idx_hospitals_expires').on(table.expiresAt)
  })
);

export const triageRecommendations = pgTable(
  'triage_recommendations',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    triageSessionId: varchar('triage_session_id', { length: 64 })
      .references(() => triageSessions.id, { onDelete: 'cascade' })
      .notNull(),
    rank: integer('rank').notNull(),
    facilityId: varchar('facility_id', { length: 128 }).references(() => hospitalResearchCache.id),
    facilityName: varchar('facility_name', { length: 255 }).notNull(),
    address: text('address').notNull(),
    distanceKm: real('distance_km').notNull(),
    distanceDisplay: varchar('distance_display', { length: 64 }).notNull(),
    emergencyDeptVerified: boolean('emergency_dept_verified').notNull(),
    specialtyEmergencyVerified: boolean('specialty_emergency_verified').notNull(),
    specialtyMode: specialtyModeEnum('specialty_mode').notNull(),
    verificationStatus: verificationStatusEnum('verification_status').notNull(),
    clinicalSuitabilityScore: real('clinical_suitability_score').notNull(),
    distanceScore: real('distance_score').notNull(),
    totalScore: real('total_score').notNull(),
    explanation: text('explanation').notNull(),
    contactNumber: varchar('contact_number', { length: 32 }),
    navigationUri: text('navigation_uri'),
    sources: jsonb('sources').default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    sessionIdx: index('idx_recommendations_session').on(table.triageSessionId)
  })
);

// ==========================================
// 3. Feature 02: Teleconsultation & Queue
// ==========================================
export const doctors = pgTable('doctors', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  qualification: varchar('qualification', { length: 255 }).notNull(),
  registrationNumber: varchar('registration_number', { length: 64 }).notNull(),
  specialties: jsonb('specialties').default([]).notNull(),
  facilityIds: jsonb('facility_ids').default([]).notNull(),
  availabilityWindows: jsonb('availability_windows').default([]).notNull(),
  maxDailyLoad: integer('max_daily_load').default(25).notNull(),
  isAvailableOnline: boolean('is_available_online').default(true).notNull(),
  currentActiveConsultations: integer('current_active_consultations').default(0).notNull()
});

export const teleconsultAppointments = pgTable('teleconsult_appointments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  patientId: varchar('patient_id', { length: 64 }).notNull(),
  patientName: varchar('patient_name', { length: 255 }).notNull(),
  patientAge: integer('patient_age').notNull(),
  patientSex: varchar('patient_sex', { length: 16 }).notNull(),
  doctorId: varchar('doctor_id', { length: 64 }).notNull(),
  doctorName: varchar('doctor_name', { length: 255 }).notNull(),
  specialty: varchar('specialty', { length: 128 }).notNull(),
  facilityId: varchar('facility_id', { length: 64 }).notNull(),
  facilityName: varchar('facility_name', { length: 255 }).notNull(),
  scheduledTime: varchar('scheduled_time', { length: 64 }).notNull(),
  urgencyTier: varchar('urgency_tier', { length: 32 }).notNull(),
  bookedBy: varchar('booked_by', { length: 32 }).notNull(),
  workerName: varchar('worker_name', { length: 255 }),
  status: varchar('status', { length: 32 }).default('booked').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const teleconsultQueue = pgTable('teleconsult_queue', {
  id: varchar('id', { length: 64 }).primaryKey(),
  appointmentId: varchar('appointment_id', { length: 64 }),
  patientId: varchar('patient_id', { length: 64 }).notNull(),
  patientName: varchar('patient_name', { length: 255 }).notNull(),
  patientAge: integer('patient_age').notNull(),
  patientSex: varchar('patient_sex', { length: 16 }).notNull(),
  doctorId: varchar('doctor_id', { length: 64 }).notNull(),
  doctorName: varchar('doctor_name', { length: 255 }).notNull(),
  specialty: varchar('specialty', { length: 128 }).notNull(),
  priorityScore: real('priority_score').notNull(),
  urgencyTier: varchar('urgency_tier', { length: 32 }).notNull(),
  highRiskFlags: jsonb('high_risk_flags').default([]).notNull(),
  bookedBy: varchar('booked_by', { length: 32 }).notNull(),
  workerName: varchar('worker_name', { length: 255 }),
  joinedAt: varchar('joined_at', { length: 64 }).notNull(),
  scheduledTime: varchar('scheduled_time', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).default('waiting').notNull()
});

export const teleconsultSessions = pgTable('teleconsult_sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  queueEntryId: varchar('queue_entry_id', { length: 64 }).notNull(),
  patientId: varchar('patient_id', { length: 64 }).notNull(),
  patientName: varchar('patient_name', { length: 255 }).notNull(),
  doctorId: varchar('doctor_id', { length: 64 }).notNull(),
  doctorName: varchar('doctor_name', { length: 255 }).notNull(),
  specialty: varchar('specialty', { length: 128 }).notNull(),
  mode: varchar('mode', { length: 32 }).default('video').notNull(),
  status: varchar('status', { length: 32 }).default('active').notNull(),
  payloadJson: jsonb('payload_json').default({}).notNull(),
  startedAt: varchar('started_at', { length: 64 }).notNull(),
  endedAt: varchar('ended_at', { length: 64 })
});

// ==========================================
// 4. Feature 05: Interoperable Health Records
// ==========================================
export const patientProfiles = pgTable('patient_profiles', {
  internalMedicalId: varchar('internal_medical_id', { length: 64 }).primaryKey(),
  abhaId: varchar('abha_id', { length: 64 }),
  name: varchar('name', { length: 255 }).notNull(),
  age: integer('age').notNull(),
  sex: varchar('sex', { length: 16 }).notNull(),
  phone: varchar('phone', { length: 32 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  bloodGroup: varchar('blood_group', { length: 16 }),
  emergencyContact: jsonb('emergency_contact'),
  createdAt: varchar('created_at', { length: 64 }).notNull()
});

export const healthRecords = pgTable('health_records', {
  id: varchar('id', { length: 64 }).primaryKey(),
  internalMedicalId: varchar('internal_medical_id', { length: 64 }).notNull(),
  source: varchar('source', { length: 32 }).notNull(),
  recordType: varchar('record_type', { length: 64 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  summary: text('summary').notNull(),
  facilityName: varchar('facility_name', { length: 255 }).notNull(),
  doctorName: varchar('doctor_name', { length: 255 }),
  recordedAt: varchar('recorded_at', { length: 64 }).notNull(),
  verificationStatus: varchar('verification_status', { length: 32 }).notNull(),
  verifiedBy: varchar('verified_by', { length: 255 }),
  extractedData: jsonb('extracted_data').default({}).notNull()
});

export const consentRequests = pgTable('consent_requests', {
  consentId: varchar('consent_id', { length: 64 }).primaryKey(),
  internalMedicalId: varchar('internal_medical_id', { length: 64 }).notNull(),
  requestedBy: varchar('requested_by', { length: 64 }).notNull(),
  requesterName: varchar('requester_name', { length: 255 }).notNull(),
  requesterRole: varchar('requester_role', { length: 64 }).notNull(),
  purpose: text('purpose').notNull(),
  scope: varchar('scope', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  expiresAt: varchar('expires_at', { length: 64 }).notNull(),
  grantedAt: varchar('granted_at', { length: 64 })
});

// ==========================================
// 5. Feature 07, 08 & 09: Facility Dashboard, Schemes & Command Center
// ==========================================
export const facilityResources = pgTable('facility_resources', {
  id: varchar('id', { length: 128 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 64 }).notNull(),
  resourceType: varchar('resource_type', { length: 32 }).notNull(),
  resourceName: varchar('resource_name', { length: 255 }).notNull(),
  totalCount: integer('total_count').notNull(),
  availableCount: integer('available_count').notNull(),
  lastUpdated: varchar('last_updated', { length: 64 }).notNull()
});

export const governmentSchemes = pgTable('government_schemes', {
  schemeId: varchar('scheme_id', { length: 64 }).primaryKey(),
  schemeName: varchar('scheme_name', { length: 255 }).notNull(),
  shortCode: varchar('short_code', { length: 64 }).notNull(),
  issuingBody: varchar('issuing_body', { length: 64 }).notNull(),
  payloadJson: jsonb('payload_json').notNull(),
  lastVerifiedDate: varchar('last_verified_date', { length: 64 }).notNull()
});

export const schemeAssessments = pgTable('scheme_assessments', {
  assessmentId: varchar('assessment_id', { length: 64 }).primaryKey(),
  patientId: varchar('patient_id', { length: 64 }),
  payloadJson: jsonb('payload_json').notNull(),
  createdAt: varchar('created_at', { length: 64 }).notNull()
});
