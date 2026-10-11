import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  CommandFacility,
  BedSnapshot,
  StockSnapshot,
  ThresholdRule,
  SyndromicCount,
  CommandAlert,
  CommandRequest,
  CommandAuditLog,
  AlertStatus,
  RequestStatus,
  SymptomCluster
} from '../../domain/models/command-center.model.ts';
import { InMemoryCommandCenterStore } from '../cache/command-center.store.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SqliteCommandCenterStore extends InMemoryCommandCenterStore {
  private readonly db: DatabaseSync;

  constructor(dbPath?: string) {
    super();
    const isMemory = dbPath === ':memory:';
    const resolvedPath = isMemory
      ? ':memory:'
      : dbPath || path.resolve(__dirname, '../../../data/command_center.db');

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
      CREATE TABLE IF NOT EXISTS command_facilities (
        id TEXT PRIMARY KEY,
        district_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cc_fac_dist ON command_facilities(district_id);

      CREATE TABLE IF NOT EXISTS command_alerts (
        id TEXT PRIMARY KEY,
        district_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cc_alerts_dist ON command_alerts(district_id);

      CREATE TABLE IF NOT EXISTS command_requests (
        id TEXT PRIMARY KEY,
        district_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cc_reqs_dist ON command_requests(district_id);

      CREATE TABLE IF NOT EXISTS command_audit_logs (
        id TEXT PRIMARY KEY,
        district_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cc_audit_dist ON command_audit_logs(district_id);

      CREATE TABLE IF NOT EXISTS command_threshold_rules (
        id TEXT PRIMARY KEY,
        district_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
    `);

    const countRow = this.db
      .prepare('SELECT COUNT(*) as count FROM command_facilities')
      .get() as { count: number };

    if (!countRow || countRow.count === 0) {
      for (const f of super.getAllFacilities()) {
        this.saveFacilityRow(f);
      }
      for (const f of super.getAllFacilities()) {
        const distAlerts = super.getAlertsByDistrict(f.districtId);
        for (const a of distAlerts) {
          this.saveAlertRow(a);
        }
        const distReqs = super.getRequestsByDistrict(f.districtId);
        for (const r of distReqs) {
          this.saveRequestRow(r);
        }
        const distRules = super.getThresholdRules(f.districtId);
        for (const rule of distRules) {
          this.saveRuleRow(rule);
        }
      }
    } else {
      this.hydrateFromSqlite();
    }
  }

  private hydrateFromSqlite(): void {
    const facRows = this.db
      .prepare('SELECT payload_json FROM command_facilities')
      .all() as Array<{ payload_json: string }>;
    for (const r of facRows) {
      super.registerFacility(JSON.parse(r.payload_json) as CommandFacility);
    }

    const alertRows = this.db
      .prepare('SELECT payload_json FROM command_alerts')
      .all() as Array<{ payload_json: string }>;
    for (const r of alertRows) {
      super.addAlert(JSON.parse(r.payload_json) as CommandAlert);
    }

    const reqRows = this.db
      .prepare('SELECT payload_json FROM command_requests')
      .all() as Array<{ payload_json: string }>;
    for (const r of reqRows) {
      super.createRequest(JSON.parse(r.payload_json) as CommandRequest);
    }

    const ruleRows = this.db
      .prepare('SELECT payload_json FROM command_threshold_rules')
      .all() as Array<{ payload_json: string }>;
    for (const r of ruleRows) {
      super.upsertThresholdRule(JSON.parse(r.payload_json) as ThresholdRule);
    }
  }

  private saveFacilityRow(facility: CommandFacility): void {
    if (!this.db) return;
    this.db
      .prepare(
        `INSERT INTO command_facilities (id, district_id, payload_json)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET district_id = excluded.district_id, payload_json = excluded.payload_json`
      )
      .run(facility.id, facility.districtId, JSON.stringify(facility));
  }

  private saveAlertRow(alert: CommandAlert): void {
    if (!this.db) return;
    this.db
      .prepare(
        `INSERT INTO command_alerts (id, district_id, status, created_at, payload_json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, payload_json = excluded.payload_json`
      )
      .run(alert.id, alert.districtId, alert.status, alert.createdAt, JSON.stringify(alert));
  }

  private saveRequestRow(req: CommandRequest): void {
    if (!this.db) return;
    this.db
      .prepare(
        `INSERT INTO command_requests (id, district_id, status, created_at, payload_json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, payload_json = excluded.payload_json`
      )
      .run(req.id, req.districtId, req.status, req.createdAt, JSON.stringify(req));
  }

  private saveRuleRow(rule: ThresholdRule): void {
    if (!this.db) return;
    this.db
      .prepare(
        `INSERT INTO command_threshold_rules (id, district_id, payload_json)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json`
      )
      .run(rule.id, rule.districtId, JSON.stringify(rule));
  }

  override registerFacility(facility: CommandFacility): CommandFacility {
    const res = super.registerFacility(facility);
    this.saveFacilityRow(res);
    return res;
  }

  override updateFacilityStress(facilityId: string, stressLevel: CommandFacility['stressLevel']): void {
    super.updateFacilityStress(facilityId, stressLevel);
    const updated = super.getFacility(facilityId);
    if (updated) this.saveFacilityRow(updated);
  }

  override ingestBedSnapshot(snapshot: BedSnapshot): void {
    super.ingestBedSnapshot(snapshot);
    const updated = super.getFacility(snapshot.facilityId);
    if (updated) this.saveFacilityRow(updated);
  }

  override ingestStockSnapshot(snapshot: StockSnapshot): void {
    super.ingestStockSnapshot(snapshot);
    const updated = super.getFacility(snapshot.facilityId);
    if (updated) this.saveFacilityRow(updated);
  }

  override upsertThresholdRule(rule: ThresholdRule): ThresholdRule {
    const res = super.upsertThresholdRule(rule);
    this.saveRuleRow(res);
    return res;
  }

  override deleteThresholdRule(districtId: string, ruleId: string): boolean {
    const deleted = super.deleteThresholdRule(districtId, ruleId);
    if (deleted && this.db) {
      this.db.prepare('DELETE FROM command_threshold_rules WHERE id = ?').run(ruleId);
    }
    return deleted;
  }

  override addAlert(alert: CommandAlert): CommandAlert {
    const res = super.addAlert(alert);
    this.saveAlertRow(res);
    return res;
  }

  override updateAlertStatus(
    id: string,
    status: AlertStatus,
    actor: string,
    snoozeReason?: string,
    snoozeUntil?: string
  ): CommandAlert | null {
    const updated = super.updateAlertStatus(id, status, actor, snoozeReason, snoozeUntil);
    if (updated) this.saveAlertRow(updated);
    return updated;
  }

  override createRequest(request: CommandRequest): CommandRequest {
    const res = super.createRequest(request);
    this.saveRequestRow(res);
    return res;
  }

  override updateRequestStatus(
    id: string,
    status: RequestStatus,
    actor: string,
    notes?: string
  ): CommandRequest | null {
    const updated = super.updateRequestStatus(id, status, actor, notes);
    if (updated) this.saveRequestRow(updated);
    return updated;
  }

  override addAuditLog(log: CommandAuditLog): void {
    super.addAuditLog(log);
    if (this.db) {
      this.db
        .prepare(
          `INSERT INTO command_audit_logs (id, district_id, timestamp, payload_json)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json`
        )
        .run(log.id, log.districtId, log.timestamp, JSON.stringify(log));
    }
  }
}
