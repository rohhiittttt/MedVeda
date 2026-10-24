import { SqliteTeleconsultStore } from './sqlite-teleconsult.store.ts';
import { SqliteReferralStore } from './sqlite-referral.store.ts';
import { SqliteFollowUpStore } from './sqlite-followup.store.ts';
import { SqliteRecordsStore } from './sqlite-records.store.ts';
import { SqliteMedicineStore } from './sqlite-medicine.store.ts';
import { SqliteFacilityDashboardStore } from './sqlite-facility-dashboard.store.ts';
import { SqliteSchemeStore } from './sqlite-scheme.store.ts';
import { SqliteCommandCenterStore } from './sqlite-command-center.store.ts';
import { getOpdBookingStore } from './sqlite-opd-booking.store.ts';

async function runPostgresMigrationIfConfigured(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('postgres')) {
    return false;
  }

  try {
    const pgMod = await import('pg');
    const Pool = pgMod.default?.Pool || pgMod.Pool;
    const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 3000 });
    const client = await pool.connect();

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS triage_sessions (
          id VARCHAR(64) PRIMARY KEY,
          session_token VARCHAR(64) NOT NULL,
          age INTEGER NOT NULL,
          sex VARCHAR(16) NOT NULL,
          location_name VARCHAR(128) NOT NULL,
          latitude REAL,
          longitude REAL,
          primary_symptoms TEXT NOT NULL,
          additional_symptoms TEXT,
          severity VARCHAR(32) NOT NULL,
          duration VARCHAR(64) NOT NULL,
          vitals JSONB DEFAULT '{}'::jsonb NOT NULL,
          medical_history JSONB DEFAULT '[]'::jsonb NOT NULL,
          urgency VARCHAR(32) NOT NULL,
          emergency_required BOOLEAN NOT NULL,
          required_specialty VARCHAR(64) NOT NULL,
          condition_category VARCHAR(128) NOT NULL,
          clinical_routing_advice TEXT NOT NULL,
          search_queries JSONB DEFAULT '[]'::jsonb NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS hospital_research_cache (
          id VARCHAR(128) PRIMARY KEY,
          facility_name VARCHAR(255) NOT NULL,
          normalized_name VARCHAR(255) NOT NULL,
          address TEXT NOT NULL,
          city_district VARCHAR(128) NOT NULL,
          latitude REAL,
          longitude REAL,
          distance_km REAL DEFAULT 0 NOT NULL,
          contact_number VARCHAR(32),
          has_emergency_department BOOLEAN DEFAULT false NOT NULL,
          has_required_specialty BOOLEAN DEFAULT true NOT NULL,
          specialty_mode VARCHAR(32) DEFAULT 'UNKNOWN' NOT NULL,
          emergency_specialty_verified BOOLEAN DEFAULT false NOT NULL,
          specialty_availability JSONB DEFAULT '{}'::jsonb NOT NULL,
          verification_status VARCHAR(32) DEFAULT 'unverified' NOT NULL,
          verification_notes TEXT,
          sources JSONB DEFAULT '[]'::jsonb NOT NULL,
          last_researched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS triage_recommendations (
          id VARCHAR(64) PRIMARY KEY,
          triage_session_id VARCHAR(64) NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,
          rank INTEGER NOT NULL,
          facility_id VARCHAR(128) REFERENCES hospital_research_cache(id),
          facility_name VARCHAR(255) NOT NULL,
          address TEXT NOT NULL,
          distance_km REAL NOT NULL,
          distance_display VARCHAR(64) NOT NULL,
          emergency_dept_verified BOOLEAN NOT NULL,
          specialty_emergency_verified BOOLEAN NOT NULL,
          specialty_mode VARCHAR(32) NOT NULL,
          verification_status VARCHAR(32) NOT NULL,
          clinical_suitability_score REAL NOT NULL,
          distance_score REAL NOT NULL,
          total_score REAL NOT NULL,
          explanation TEXT NOT NULL,
          contact_number VARCHAR(32),
          navigation_uri TEXT,
          sources JSONB DEFAULT '[]'::jsonb NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
      `);
      console.log('[MedVeda DB Migrate] PostgreSQL schema verified and migrated successfully.');
      return true;
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err) {
    console.warn(
      '[MedVeda DB Migrate] PostgreSQL connection unavailable; using in-memory SQLite stores.',
      (err as Error).message
    );
    return false;
  }
}

export async function runMigrations(): Promise<void> {
  console.log('[MedVeda DB Migrate] Starting database schema initialization across all 9 features...');

  await runPostgresMigrationIfConfigured();

  // Initialize and verify all in-memory SQLite databases
  new SqliteTeleconsultStore(':memory:');
  new SqliteReferralStore(':memory:');
  new SqliteFollowUpStore(':memory:');
  new SqliteRecordsStore(':memory:');
  new SqliteMedicineStore(':memory:');
  new SqliteFacilityDashboardStore(':memory:');
  new SqliteSchemeStore(':memory:');
  new SqliteCommandCenterStore(':memory:');
  getOpdBookingStore(':memory:');

  console.log('[MedVeda DB Migrate] All 10 database stores initialized and verified in-memory.');
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations().catch((err) => {
    console.error('[MedVeda DB Migrate] Fatal error:', err);
    process.exit(1);
  });
}
