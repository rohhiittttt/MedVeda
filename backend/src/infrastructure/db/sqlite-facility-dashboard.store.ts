import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  FacilityAlert,
  FacilityResourceStatus,
  AlertStatus,
  ResourceType
} from '../../domain/models/facility-dashboard.model.ts';
import { isResourceStale, checkResourceAlertThreshold } from '../../domain/rules/dashboard-aggregation.rules.ts';
import { InMemoryFacilityDashboardStore } from '../cache/facility-dashboard.store.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SqliteFacilityDashboardStore extends InMemoryFacilityDashboardStore {
  private readonly db: DatabaseSync;

  constructor(dbPath?: string) {
    super();
    const resolvedPath =
      dbPath ||
      (process.env.SQLITE_PERSIST_DISK === 'true'
        ? path.resolve(__dirname, '../../../data/facility_dashboard.db')
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
      CREATE TABLE IF NOT EXISTS dashboard_facilities (
        facility_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        district TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS facility_alerts (
        alert_id TEXT PRIMARY KEY,
        facility_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_fd_alerts_fac ON facility_alerts(facility_id);

      CREATE TABLE IF NOT EXISTS facility_resources (
        id TEXT PRIMARY KEY,
        facility_id TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_fd_res_fac ON facility_resources(facility_id);
    `);

    const facCount = this.db
      .prepare('SELECT COUNT(*) as count FROM dashboard_facilities')
      .get() as { count: number };

    if (!facCount || facCount.count === 0) {
      const insertFac = this.db.prepare(
        'INSERT INTO dashboard_facilities (facility_id, name, type, district) VALUES (?, ?, ?, ?)'
      );
      for (const f of this.facilities) {
        insertFac.run(f.facilityId, f.name, f.type, f.district);
      }

      for (const alert of this.alerts.values()) {
        this.saveAlertRow(alert);
      }

      for (const [facId, resList] of this.resources.entries()) {
        for (const res of resList) {
          this.saveResourceRow(facId, res);
        }
      }
    }
  }

  private saveAlertRow(alert: FacilityAlert): void {
    this.db
      .prepare(
        `INSERT INTO facility_alerts (alert_id, facility_id, created_at, payload_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(alert_id) DO UPDATE SET payload_json = excluded.payload_json`
      )
      .run(alert.alertId, alert.facilityId, alert.createdAt, JSON.stringify(alert));
  }

  private saveResourceRow(facilityId: string, res: FacilityResourceStatus): void {
    const id = `${facilityId}:${res.resourceType}`;
    this.db
      .prepare(
        `INSERT INTO facility_resources (id, facility_id, resource_type, payload_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json`
      )
      .run(id, facilityId, res.resourceType, JSON.stringify(res));
  }

  override getAlertsByFacility(facilityId: string): FacilityAlert[] {
    if (!this.db) return super.getAlertsByFacility(facilityId);
    const rows = this.db
      .prepare('SELECT payload_json FROM facility_alerts WHERE facility_id = ? ORDER BY created_at DESC')
      .all(facilityId) as Array<{ payload_json: string }>;
    return rows
      .map((r) => JSON.parse(r.payload_json) as FacilityAlert)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  override addAlert(alert: FacilityAlert): FacilityAlert {
    super.addAlert(alert);
    if (this.db) {
      this.saveAlertRow(alert);
    }
    return alert;
  }

  override updateAlertStatus(
    alertId: string,
    status: AlertStatus,
    actorId = 'admin_user'
  ): FacilityAlert | null {
    if (!this.db) return super.updateAlertStatus(alertId, status, actorId);
    const row = this.db
      .prepare('SELECT payload_json FROM facility_alerts WHERE alert_id = ?')
      .get(alertId) as { payload_json: string } | undefined;
    if (!row) return null;

    const alert = JSON.parse(row.payload_json) as FacilityAlert;
    alert.status = status;
    if (status === 'acknowledged') {
      alert.acknowledgedAt = new Date().toISOString();
    } else if (status === 'resolved') {
      alert.resolvedAt = new Date().toISOString();
      alert.resolvedBy = actorId;
    }

    this.saveAlertRow(alert);
    this.alerts.set(alertId, alert);
    return alert;
  }

  override getResourcesByFacility(facilityId: string): FacilityResourceStatus[] {
    if (!this.db) return super.getResourcesByFacility(facilityId);
    const rows = this.db
      .prepare('SELECT payload_json FROM facility_resources WHERE facility_id = ?')
      .all(facilityId) as Array<{ payload_json: string }>;
    return rows.map((r) => {
      const parsed = JSON.parse(r.payload_json) as FacilityResourceStatus;
      return {
        ...parsed,
        isStale: isResourceStale(parsed.lastUpdated)
      };
    });
  }

  override updateResourceCount(
    facilityId: string,
    resourceType: ResourceType,
    totalCount: number,
    availableCount: number
  ): FacilityResourceStatus {
    const existingList = this.getResourcesByFacility(facilityId);
    let target = existingList.find((r) => r.resourceType === resourceType);

    const names: Record<ResourceType, string> = {
      bed: 'General Inpatient Beds',
      icu_bed: 'ICU & Critical Beds',
      ventilator: 'Mechanical Ventilators',
      oxygen: 'Oxygen Cylinders',
      ambulance: 'Ambulances'
    };

    target = {
      facilityId,
      resourceType,
      resourceName: target?.resourceName || names[resourceType] || resourceType,
      totalCount: Number(totalCount),
      availableCount: Number(availableCount),
      lastUpdated: new Date().toISOString(),
      isStale: false
    };

    if (this.db) {
      this.saveResourceRow(facilityId, target);
    }

    const alert = checkResourceAlertThreshold(target);
    if (alert) {
      this.addAlert(alert);
    }

    return target;
  }

  override getAllFacilities(): Array<{ facilityId: string; name: string; type: string; district: string }> {
    if (!this.db) return super.getAllFacilities();
    const rows = this.db.prepare('SELECT * FROM dashboard_facilities').all() as Array<{
      facility_id: string;
      name: string;
      type: string;
      district: string;
    }>;
    return rows.map((r) => ({
      facilityId: r.facility_id,
      name: r.name,
      type: r.type,
      district: r.district
    }));
  }
}
