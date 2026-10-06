/**
 * Feature Map 09 — District Admin Command Center
 * In-Memory Store: Production-grade with time-indexed snapshots,
 * deduplication, cooldown tracking, and audit logs.
 */

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
import { INDIA_DISTRICTS, getDistrictsByState, INDIA_STATES } from '../data/india-geography.ts';

// ─── Helper ───────────────────────────────────────────────────────────────────

function nowIso(): string { return new Date().toISOString(); }
function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class InMemoryCommandCenterStore {
  /** Registered facility nodes per district */
  private facilities: Map<string, CommandFacility> = new Map();

  /** Timeseries bed snapshots: facilityId → list of snapshots (kept last 90 days) */
  private bedSnapshots: Map<string, BedSnapshot[]> = new Map();

  /** Timeseries stock snapshots: `${facilityId}:${resourceId}` → list */
  private stockSnapshots: Map<string, StockSnapshot[]> = new Map();

  /** Per-district threshold configuration rules */
  private thresholdRules: Map<string, ThresholdRule[]> = new Map();

  /** Aggregated syndromic surveillance counts */
  private syndromicCounts: Map<string, SyndromicCount[]> = new Map();

  /** Alerts: id → alert */
  private alerts: Map<string, CommandAlert> = new Map();

  /** Requests: id → request */
  private requests: Map<string, CommandRequest> = new Map();

  /** Audit logs: id → log */
  private auditLogs: CommandAuditLog[] = [];

  /** Alert dedup cooldown: dedupKey → last alert createdAt ISO */
  private alertCooldowns: Map<string, string> = new Map();

  constructor() {
    this.seedInitialData();
  }

  // ─── Facility CRUD ──────────────────────────────────────────────────────────

  registerFacility(facility: CommandFacility): CommandFacility {
    this.facilities.set(facility.id, { ...facility, registeredAt: facility.registeredAt || nowIso() });
    return facility;
  }

  getFacility(id: string): CommandFacility | undefined {
    return this.facilities.get(id);
  }

  getFacilitiesByDistrict(districtId: string): CommandFacility[] {
    return Array.from(this.facilities.values()).filter(f => f.districtId === districtId);
  }

  getAllFacilities(): CommandFacility[] {
    return Array.from(this.facilities.values());
  }

  updateFacilityStress(facilityId: string, stressLevel: CommandFacility['stressLevel']): void {
    const facility = this.facilities.get(facilityId);
    if (facility) {
      facility.stressLevel = stressLevel;
      facility.lastReportedAt = nowIso();
      facility.isStale = false;
    }
  }

  // ─── Bed Snapshots ──────────────────────────────────────────────────────────

  ingestBedSnapshot(snapshot: BedSnapshot): void {
    const key = snapshot.facilityId;
    const list = this.bedSnapshots.get(key) || [];
    list.push(snapshot);
    // Trim to last 90 days
    const cutoff = Date.now() - 90 * 86400000;
    const trimmed = list.filter(s => new Date(s.timestamp).getTime() >= cutoff);
    this.bedSnapshots.set(key, trimmed);

    // Update facility last reported
    const facility = this.facilities.get(snapshot.facilityId);
    if (facility) {
      facility.lastReportedAt = nowIso();
      facility.isStale = false;
      if (snapshot.wardType === 'general') {
        facility.bedsTotal = snapshot.totalCapacity;
        facility.bedsOccupied = snapshot.occupied;
      }
      if (snapshot.wardType === 'icu') {
        facility.icuTotal = snapshot.totalCapacity;
        facility.icuOccupied = snapshot.occupied;
      }
    }
  }

  getBedSnapshots(facilityId: string, sinceMs?: number): BedSnapshot[] {
    const list = this.bedSnapshots.get(facilityId) || [];
    if (!sinceMs) return list;
    return list.filter(s => new Date(s.timestamp).getTime() >= sinceMs);
  }

  getLatestBedSnapshot(facilityId: string, wardType: string): BedSnapshot | undefined {
    const list = this.bedSnapshots.get(facilityId) || [];
    return list.filter(s => s.wardType === wardType).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  }

  // ─── Stock Snapshots ────────────────────────────────────────────────────────

  ingestStockSnapshot(snapshot: StockSnapshot): void {
    const key = `${snapshot.facilityId}:${snapshot.resourceId}`;
    const list = this.stockSnapshots.get(key) || [];
    list.push(snapshot);
    const cutoff = Date.now() - 90 * 86400000;
    this.stockSnapshots.set(key, list.filter(s => new Date(s.timestamp).getTime() >= cutoff));
    // Update facility last reported
    const facility = this.facilities.get(snapshot.facilityId);
    if (facility) { facility.lastReportedAt = nowIso(); facility.isStale = false; }
  }

  getStockSnapshots(facilityId: string, resourceId: string): StockSnapshot[] {
    return this.stockSnapshots.get(`${facilityId}:${resourceId}`) || [];
  }

  getAllLatestStock(districtId: string): StockSnapshot[] {
    const latest: StockSnapshot[] = [];
    for (const [key, list] of this.stockSnapshots.entries()) {
      const [fid] = key.split(':');
      const facility = this.facilities.get(fid);
      if (!facility || facility.districtId !== districtId) continue;
      if (list.length === 0) continue;
      latest.push(list.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]);
    }
    return latest;
  }

  getStockHistory(facilityId: string, resourceId: string, days: number = 90): number[] {
    const snapshots = this.getStockSnapshots(facilityId, resourceId);
    const cutoff = Date.now() - days * 86400000;
    return snapshots
      .filter(s => new Date(s.timestamp).getTime() >= cutoff)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(s => s.dailyUsageEst);
  }

  // ─── Threshold Rules ────────────────────────────────────────────────────────

  getThresholdRules(districtId: string): ThresholdRule[] {
    return this.thresholdRules.get(districtId) || [];
  }

  upsertThresholdRule(rule: ThresholdRule): ThresholdRule {
    const rules = this.thresholdRules.get(rule.districtId) || [];
    const idx = rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) rules[idx] = rule;
    else rules.push(rule);
    this.thresholdRules.set(rule.districtId, rules);
    return rule;
  }

  deleteThresholdRule(districtId: string, ruleId: string): boolean {
    const rules = this.thresholdRules.get(districtId) || [];
    const filtered = rules.filter(r => r.id !== ruleId);
    this.thresholdRules.set(districtId, filtered);
    return filtered.length < rules.length;
  }

  // ─── Syndromic Surveillance ─────────────────────────────────────────────────

  ingestSyndromicCount(count: SyndromicCount): void {
    const key = `${count.districtId}:${count.symptomCluster}`;
    const list = this.syndromicCounts.get(key) || [];
    list.push(count);
    this.syndromicCounts.set(key, list.sort((a, b) => a.date.localeCompare(b.date)));
  }

  getSyndromicHistory(districtId: string, cluster: SymptomCluster, days: number = 30): SyndromicCount[] {
    const key = `${districtId}:${cluster}`;
    const list = this.syndromicCounts.get(key) || [];
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return list.filter(c => c.date >= cutoff);
  }

  getSyndromicByFacility(districtId: string, cluster: SymptomCluster, days: number = 14): SyndromicCount[] {
    // Aggregate all facility-level counts for the district
    const result: SyndromicCount[] = [];
    for (const [key, list] of this.syndromicCounts.entries()) {
      if (!key.startsWith(districtId)) {
        // Also check by districtId in the data
      }
      for (const c of list) {
        if (c.districtId === districtId && c.symptomCluster === cluster) {
          const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
          if (c.date >= cutoff) result.push(c);
        }
      }
    }
    return result;
  }

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  addAlert(alert: CommandAlert): CommandAlert {
    this.alerts.set(alert.id, alert);
    this.alertCooldowns.set(alert.dedupKey, alert.createdAt);
    return alert;
  }

  getAlert(id: string): CommandAlert | undefined { return this.alerts.get(id); }

  getAlertsByDistrict(districtId: string, status?: AlertStatus): CommandAlert[] {
    return Array.from(this.alerts.values())
      .filter(a => a.districtId === districtId && (!status || a.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  updateAlertStatus(
    id: string,
    status: AlertStatus,
    actor: string,
    snoozeReason?: string,
    snoozeUntil?: string
  ): CommandAlert | null {
    const alert = this.alerts.get(id);
    if (!alert) return null;
    alert.status = status;
    if (status === 'acknowledged') {
      alert.acknowledgedBy = actor;
      alert.acknowledgedAt = nowIso();
    }
    if (status === 'resolved') {
      alert.resolvedBy = actor;
      alert.resolvedAt = nowIso();
    }
    if (status === 'snoozed' && snoozeReason && snoozeUntil) {
      alert.snoozeReason = snoozeReason;
      alert.snoozeUntil = snoozeUntil;
    }
    this.alerts.set(id, alert);
    return alert;
  }

  checkCooldown(dedupKey: string, cooldownMinutes: number): boolean {
    const lastTriggered = this.alertCooldowns.get(dedupKey);
    if (!lastTriggered) return false; // not in cooldown
    return (Date.now() - new Date(lastTriggered).getTime()) < cooldownMinutes * 60 * 1000;
  }

  // ─── Requests ───────────────────────────────────────────────────────────────

  createRequest(request: CommandRequest): CommandRequest {
    this.requests.set(request.id, request);
    return request;
  }

  getRequest(id: string): CommandRequest | undefined { return this.requests.get(id); }

  getRequestsByDistrict(districtId: string, status?: RequestStatus): CommandRequest[] {
    return Array.from(this.requests.values())
      .filter(r => r.districtId === districtId && (!status || r.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  updateRequestStatus(
    id: string,
    status: RequestStatus,
    actor: string,
    notes?: string
  ): CommandRequest | null {
    const req = this.requests.get(id);
    if (!req) return null;
    req.status = status;
    req.updatedAt = nowIso();
    req.statusTimeline.push({ status, timestamp: nowIso(), actor, notes });
    if (status === 'approved') req.approvedBy = actor;
    this.requests.set(id, req);
    return req;
  }

  // ─── Audit Log ──────────────────────────────────────────────────────────────

  addAuditLog(log: CommandAuditLog): void {
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 10000) this.auditLogs.length = 10000;
  }

  getAuditLogs(districtId: string, limit: number = 100): CommandAuditLog[] {
    return this.auditLogs.filter(l => l.districtId === districtId).slice(0, limit);
  }

  // ─── Seed Data ───────────────────────────────────────────────────────────────

  private seedInitialData(): void {
    const now = Date.now();
    const ago = (h: number) => new Date(now - h * 3600000).toISOString();

    // Seed District Sadar Hospital Hazaribagh (fac_01) as command center facility
    const seedFacilities: CommandFacility[] = [
      {
        id: 'fac_01',
        districtId: 'dist_jhk_hazaribagh',
        stateId: 'jharkhand',
        name: 'District Sadar Hospital (Hazaribagh)',
        type: 'DH',
        taluka: 'Hazaribagh Sadar',
        lat: 23.9975,
        lng: 85.3637,
        contactPerson: 'Dr. Ramakant Prasad',
        phone: '06546-222001',
        email: 'sadar.hazaribagh@jharkhand.gov.in',
        bedsTotal: 200,
        bedsOccupied: 152,
        icuTotal: 20,
        icuOccupied: 17,
        stressLevel: 'critical',
        lastReportedAt: ago(0.5),
        isStale: false,
        registeredAt: ago(720)
      },
      {
        id: 'fac_02',
        districtId: 'dist_jhk_hazaribagh',
        stateId: 'jharkhand',
        name: 'Katkamsandi CHC',
        type: 'CHC',
        taluka: 'Katkamsandi',
        lat: 24.0841,
        lng: 85.1312,
        contactPerson: 'Dr. Anita Verma',
        phone: '06546-260112',
        bedsTotal: 30,
        bedsOccupied: 22,
        icuTotal: 2,
        icuOccupied: 2,
        stressLevel: 'critical',
        lastReportedAt: ago(1),
        isStale: false,
        registeredAt: ago(720)
      },
      {
        id: 'fac_03',
        districtId: 'dist_jhk_hazaribagh',
        stateId: 'jharkhand',
        name: 'Sheikh Bhikhari Medical College & Hospital',
        type: 'MC',
        taluka: 'Hazaribagh Sadar',
        lat: 24.0071,
        lng: 85.3754,
        contactPerson: 'Dr. Sanjay Mishra',
        phone: '06546-235000',
        email: 'sbmch@jharkhand.gov.in',
        bedsTotal: 400,
        bedsOccupied: 312,
        icuTotal: 40,
        icuOccupied: 31,
        stressLevel: 'moderate',
        lastReportedAt: ago(2),
        isStale: false,
        registeredAt: ago(720)
      },
      {
        id: 'fac_04',
        districtId: 'dist_jhk_hazaribagh',
        stateId: 'jharkhand',
        name: 'Churchu PHC',
        type: 'PHC',
        taluka: 'Churchu',
        lat: 23.8711,
        lng: 85.6284,
        contactPerson: 'Dr. Priti Sinha',
        phone: '06546-271001',
        bedsTotal: 10,
        bedsOccupied: 6,
        icuTotal: 0,
        icuOccupied: 0,
        stressLevel: 'moderate',
        lastReportedAt: ago(3),
        isStale: false,
        registeredAt: ago(720)
      },
      {
        id: 'fac_05',
        districtId: 'dist_jhk_hazaribagh',
        stateId: 'jharkhand',
        name: 'Barhi Sub-Divisional Hospital',
        type: 'SDH',
        taluka: 'Barhi',
        lat: 24.3011,
        lng: 85.4171,
        contactPerson: 'Dr. Ravi Kumar',
        phone: '06546-252001',
        bedsTotal: 50,
        bedsOccupied: 29,
        icuTotal: 4,
        icuOccupied: 2,
        stressLevel: 'normal',
        lastReportedAt: ago(25),
        isStale: true,
        registeredAt: ago(720)
      }
    ];

    seedFacilities.forEach(f => this.facilities.set(f.id, f));

    // Seed bed snapshots
    const seedBeds = [
      { facilityId: 'fac_01', wardType: 'general' as const, total: 200, occupied: 152 },
      { facilityId: 'fac_01', wardType: 'icu' as const, total: 20, occupied: 17 },
      { facilityId: 'fac_02', wardType: 'general' as const, total: 30, occupied: 22 },
      { facilityId: 'fac_02', wardType: 'icu' as const, total: 2, occupied: 2 },
      { facilityId: 'fac_03', wardType: 'general' as const, total: 400, occupied: 312 },
      { facilityId: 'fac_03', wardType: 'icu' as const, total: 40, occupied: 31 },
      { facilityId: 'fac_04', wardType: 'general' as const, total: 10, occupied: 6 },
      { facilityId: 'fac_05', wardType: 'general' as const, total: 50, occupied: 29 },
      { facilityId: 'fac_05', wardType: 'icu' as const, total: 4, occupied: 2 }
    ];

    for (const b of seedBeds) {
      const free = b.total - b.occupied;
      const snap: BedSnapshot = {
        id: uid('BED'),
        facilityId: b.facilityId,
        districtId: 'dist_jhk_hazaribagh',
        timestamp: ago(Math.random() * 2),
        wardType: b.wardType,
        totalCapacity: b.total,
        occupied: b.occupied,
        free,
        occupancyRatePct: +((b.occupied / b.total) * 100).toFixed(1),
        sourceUserId: 'system_seed'
      };
      this.ingestBedSnapshot(snap);
    }

    // Seed stock snapshots
    const seedStocks: Array<Omit<StockSnapshot, 'id' | 'timestamp' | 'daysOfCoverRemaining'>> = [
      { facilityId: 'fac_01', districtId: 'dist_jhk_hazaribagh', resourceId: 'oxygen_cylinders', resourceName: 'Oxygen Cylinders (B-type)', category: 'oxygen', unit: 'cylinders', currentQuantity: 8, dailyUsageEst: 12, sourceUserId: 'system_seed' },
      { facilityId: 'fac_01', districtId: 'dist_jhk_hazaribagh', resourceId: 'paracetamol_500mg', resourceName: 'Paracetamol 500mg Tabs', category: 'medicine', unit: 'strips of 10', currentQuantity: 340, dailyUsageEst: 45, sourceUserId: 'system_seed' },
      { facilityId: 'fac_01', districtId: 'dist_jhk_hazaribagh', resourceId: 'blood_o_pos', resourceName: 'Blood O+ Units', category: 'blood', unit: 'units', currentQuantity: 4, dailyUsageEst: 3.5, sourceUserId: 'system_seed' },
      { facilityId: 'fac_02', districtId: 'dist_jhk_hazaribagh', resourceId: 'oxygen_cylinders', resourceName: 'Oxygen Cylinders (B-type)', category: 'oxygen', unit: 'cylinders', currentQuantity: 3, dailyUsageEst: 2, sourceUserId: 'system_seed' },
      { facilityId: 'fac_02', districtId: 'dist_jhk_hazaribagh', resourceId: 'iv_fluids_ns', resourceName: 'IV Normal Saline (500ml)', category: 'medicine', unit: 'bags', currentQuantity: 25, dailyUsageEst: 8, sourceUserId: 'system_seed' },
      { facilityId: 'fac_03', districtId: 'dist_jhk_hazaribagh', resourceId: 'oxygen_cylinders', resourceName: 'Oxygen Cylinders (B-type)', category: 'oxygen', unit: 'cylinders', currentQuantity: 55, dailyUsageEst: 20, sourceUserId: 'system_seed' },
      { facilityId: 'fac_04', districtId: 'dist_jhk_hazaribagh', resourceId: 'artesunate_inj', resourceName: 'Artesunate Injection (Malaria)', category: 'medicine', unit: 'vials', currentQuantity: 5, dailyUsageEst: 3, sourceUserId: 'system_seed' },
      { facilityId: 'fac_05', districtId: 'dist_jhk_hazaribagh', resourceId: 'oxygen_cylinders', resourceName: 'Oxygen Cylinders (B-type)', category: 'oxygen', unit: 'cylinders', currentQuantity: 18, dailyUsageEst: 4, sourceUserId: 'system_seed' }
    ];

    for (const s of seedStocks) {
      const snap: StockSnapshot = {
        id: uid('STK'),
        timestamp: ago(Math.random() * 3),
        daysOfCoverRemaining: s.dailyUsageEst > 0 ? +(s.currentQuantity / s.dailyUsageEst).toFixed(1) : 999,
        ...s
      };
      this.ingestStockSnapshot(snap);
    }

    // Seed threshold rules for district
    const defaultRules: ThresholdRule[] = [
      { id: 'rule_oxygen_district', districtId: 'dist_jhk_hazaribagh', facilityId: null, resourceId: 'oxygen_cylinders', resourceName: 'Oxygen Cylinders', wardType: null, minimumLevel: 5, reorderLevel: 15, targetBuffer: 40, daysOfCoverMin: 7, severity: 'critical', cooldownMinutes: 60, seasonalPreset: 'standard', isActive: true, updatedBy: 'district_admin_01', updatedAt: ago(24) },
      { id: 'rule_paracetamol_district', districtId: 'dist_jhk_hazaribagh', facilityId: null, resourceId: 'paracetamol_500mg', resourceName: 'Paracetamol 500mg', wardType: null, minimumLevel: 100, reorderLevel: 300, targetBuffer: 800, daysOfCoverMin: 10, severity: 'warning', cooldownMinutes: 120, seasonalPreset: 'standard', isActive: true, updatedBy: 'district_admin_01', updatedAt: ago(24) },
      { id: 'rule_blood_op_district', districtId: 'dist_jhk_hazaribagh', facilityId: null, resourceId: 'blood_o_pos', resourceName: 'Blood O+ Units', wardType: null, minimumLevel: 3, reorderLevel: 6, targetBuffer: 15, daysOfCoverMin: 5, severity: 'critical', cooldownMinutes: 30, seasonalPreset: 'standard', isActive: true, updatedBy: 'district_admin_01', updatedAt: ago(24) },
      { id: 'rule_artesunate_tribal', districtId: 'dist_jhk_hazaribagh', facilityId: 'fac_04', resourceId: 'artesunate_inj', resourceName: 'Artesunate Injection', wardType: null, minimumLevel: 4, reorderLevel: 10, targetBuffer: 20, daysOfCoverMin: 7, severity: 'critical', cooldownMinutes: 60, seasonalPreset: 'monsoon_fevers', isActive: true, updatedBy: 'district_admin_01', updatedAt: ago(24) }
    ];

    defaultRules.forEach(r => {
      const rules = this.thresholdRules.get(r.districtId) || [];
      rules.push(r);
      this.thresholdRules.set(r.districtId, rules);
    });

    // Seed syndromic surveillance counts (dengue-like surge)
    const clusters: SymptomCluster[] = ['acute_fever_rash', 'acute_diarrhoeal', 'malaria_like'];
    const facilityIds = ['fac_01', 'fac_02', 'fac_04'];
    for (const cluster of clusters) {
      for (const fid of facilityIds) {
        for (let d = 14; d >= 0; d--) {
          const date = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
          const baseline = cluster === 'acute_fever_rash' ? 5 : 3;
          const surge = d <= 4 ? (cluster === 'acute_fever_rash' ? 18 + Math.floor(Math.random() * 8) : 8 + Math.floor(Math.random() * 4)) : baseline + Math.floor(Math.random() * 3);
          this.ingestSyndromicCount({
            id: uid('SYN'),
            date,
            facilityId: fid,
            districtId: 'dist_jhk_hazaribagh',
            symptomCluster: cluster,
            caseCount: surge,
            reportedBy: 'system_seed',
            reportedAt: date + 'T09:00:00.000Z'
          });
        }
      }
    }

    // Seed pre-existing alerts
    const seedAlerts: CommandAlert[] = [
      {
        id: 'CALT-001',
        districtId: 'dist_jhk_hazaribagh',
        facilityId: 'fac_01',
        facilityName: 'District Sadar Hospital',
        type: 'threshold',
        severity: 'critical',
        resourceId: 'oxygen_cylinders',
        headline: 'CRITICAL: Oxygen cylinders at Sadar Hospital critically low (8 cylinders — 0.67 days cover)',
        summaryText: '8 cylinders remaining at current rate of 12/day — 0.67 days of supply.',
        whyFlagged: 'Current stock of 8 cylinders is below minimum threshold of 15. At 12 cylinders/day consumption, stock will exhaust in approximately 16 hours.',
        suggestedAction: 'Immediately contact Medical Store Depot or initiate transfer from fac_03 (55 cylinders surplus). Escalate to District CMO.',
        status: 'open',
        createdAt: ago(0.25),
        dedupKey: 'threshold:dist_jhk_hazaribagh:fac_01:oxygen_cylinders'
      },
      {
        id: 'CALT-002',
        districtId: 'dist_jhk_hazaribagh',
        facilityId: 'fac_02',
        facilityName: 'Katkamsandi CHC',
        type: 'threshold',
        severity: 'critical',
        headline: 'ICU Bed Capacity CRITICAL: Katkamsandi CHC at 100% ICU occupancy',
        summaryText: 'ICU ward: 2/2 beds occupied. No ICU capacity available.',
        whyFlagged: 'ICU occupancy is 100%. Any new critical patient will require emergency transfer.',
        suggestedAction: 'Immediately divert next critical case to fac_01 or fac_03. Contact receiving hospital for advance bed reservation.',
        status: 'open',
        createdAt: ago(1),
        dedupKey: 'bed:dist_jhk_hazaribagh:fac_02:icu'
      },
      {
        id: 'CALT-003',
        districtId: 'dist_jhk_hazaribagh',
        facilityId: 'fac_05',
        facilityName: 'Barhi SDH',
        type: 'missing_report',
        severity: 'warning',
        headline: 'MISSING REPORT: Barhi Sub-Divisional Hospital has not submitted daily stock update in 25 hours',
        summaryText: 'Last report: 25 hours ago. Facility contact: Dr. Ravi Kumar (06546-252001)',
        whyFlagged: 'No bed or stock snapshot received from fac_05 in the last 25 hours, exceeding the 24-hour SLA.',
        suggestedAction: 'Call facility contact immediately. If unreachable, escalate to Block Medical Officer for on-site verification.',
        status: 'open',
        createdAt: ago(1),
        dedupKey: 'missing_report:dist_jhk_hazaribagh:fac_05'
      },
      {
        id: 'CALT-004',
        districtId: 'dist_jhk_hazaribagh',
        facilityId: null,
        facilityName: null,
        type: 'outbreak',
        severity: 'critical',
        headline: 'OUTBREAK SIGNAL: Acute fever with rash surge detected across 3 Hazaribagh PHCs — suspected Dengue cluster',
        summaryText: 'Z-score 4.12 (C2 threshold exceeded). DBSCAN spatial cluster: fac_01, fac_02, fac_04 within 15km.',
        whyFlagged: 'Syndromic counts of acute fever with rash have risen to 3.8x baseline over 4 consecutive days. Spatial DBSCAN analysis confirms geographic clustering indicating active transmission.',
        suggestedAction: 'Dispatch vector control (fogging) teams to Katkamsandi, Churchu, and Sadar areas. Pre-position IV fluid and paracetamol stock. Notify State Disease Surveillance Officer.',
        status: 'open',
        createdAt: ago(0.1),
        dedupKey: 'outbreak:dist_jhk_hazaribagh:acute_fever_rash'
      }
    ];

    seedAlerts.forEach(a => {
      this.alerts.set(a.id, a);
      this.alertCooldowns.set(a.dedupKey, a.createdAt);
    });

    // Seed a sample transfer request
    this.createRequest({
      id: 'REQ-001',
      districtId: 'dist_jhk_hazaribagh',
      type: 'transfer',
      fromFacilityId: 'fac_03',
      fromFacilityName: 'Sheikh Bhikhari Medical College',
      toFacilityId: 'fac_01',
      toFacilityName: 'District Sadar Hospital',
      resourceId: 'oxygen_cylinders',
      resourceName: 'Oxygen Cylinders (B-type)',
      quantityRequested: 20,
      urgency: 'emergency',
      notes: 'Immediate transfer required. Sadar Hospital has < 1 day oxygen cover.',
      status: 'submitted',
      statusTimeline: [
        { status: 'draft', timestamp: ago(0.75), actor: 'district_admin_01' },
        { status: 'submitted', timestamp: ago(0.5), actor: 'district_admin_01', notes: 'Submitted for CMO approval.' }
      ],
      linkedAlertId: 'CALT-001',
      createdBy: 'district_admin_01',
      createdAt: ago(0.75),
      updatedAt: ago(0.5)
    });
  }
}
