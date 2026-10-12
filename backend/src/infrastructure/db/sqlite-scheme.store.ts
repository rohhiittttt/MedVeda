import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  InMemorySchemeStore,
  type GovernmentSchemeDto,
  type SchemeAssessmentDto
} from '../cache/scheme.store.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SqliteSchemeStore extends InMemorySchemeStore {
  private readonly db: DatabaseSync;

  constructor(dbPath?: string) {
    super();
    const resolvedPath =
      dbPath ||
      (process.env.SQLITE_PERSIST_DISK === 'true'
        ? path.resolve(__dirname, '../../../data/schemes.db')
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
      CREATE TABLE IF NOT EXISTS government_schemes (
        scheme_id TEXT PRIMARY KEY,
        short_code TEXT NOT NULL,
        issuing_body TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scheme_assessments (
        assessment_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
    `);

    const countRow = this.db
      .prepare('SELECT COUNT(*) as count FROM government_schemes')
      .get() as { count: number };

    if (!countRow || countRow.count === 0) {
      const stmt = this.db.prepare(
        'INSERT INTO government_schemes (scheme_id, short_code, issuing_body, payload_json) VALUES (?, ?, ?, ?)'
      );
      for (const s of super.getAllSchemes()) {
        stmt.run(s.scheme_id, s.short_code, s.issuing_body, JSON.stringify(s));
      }
    }
  }

  override getAllSchemes(): GovernmentSchemeDto[] {
    if (!this.db) return super.getAllSchemes();
    const rows = this.db
      .prepare('SELECT payload_json FROM government_schemes')
      .all() as Array<{ payload_json: string }>;
    return rows.map((r) => JSON.parse(r.payload_json) as GovernmentSchemeDto);
  }

  override getSchemeById(id: string): GovernmentSchemeDto | undefined {
    if (!this.db) return super.getSchemeById(id);
    const row = this.db
      .prepare('SELECT payload_json FROM government_schemes WHERE scheme_id = ?')
      .get(id) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as GovernmentSchemeDto) : undefined;
  }

  override saveAssessment(assessment: SchemeAssessmentDto): void {
    super.saveAssessment(assessment);
    if (!this.db) return;
    this.db
      .prepare(
        `INSERT INTO scheme_assessments (assessment_id, created_at, payload_json)
         VALUES (?, ?, ?)
         ON CONFLICT(assessment_id) DO UPDATE SET payload_json = excluded.payload_json`
      )
      .run(
        assessment.assessment_id,
        assessment.created_at || new Date().toISOString(),
        JSON.stringify(assessment)
      );
  }

  override getAssessmentById(id: string): SchemeAssessmentDto | undefined {
    if (!this.db) return super.getAssessmentById(id);
    const row = this.db
      .prepare('SELECT payload_json FROM scheme_assessments WHERE assessment_id = ?')
      .get(id) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as SchemeAssessmentDto) : undefined;
  }
}
