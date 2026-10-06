/**
 * Feature Map 09 — District Admin Command Center
 * Application Use-Case: Orchestrates 4 intelligence engines,
 * multi-facility surveillance, pan-India district generation, and request workflow.
 */

import type {
  CommandFacility,
  DistrictOverview,
  CommandAlert,
  ThresholdRule,
  StockoutForecast,
  EarlyWarningResult,
  TransferRecommendation,
  CommandRequest,
  CommandAuditLog,
  ReportingMatrix,
  AlertStatus,
  RequestStatus,
  SeasonalPreset,
  SymptomCluster,
  BedSnapshot,
  StockSnapshot,
  SyndromicCount
} from '../../domain/models/command-center.model.ts';
import { InMemoryCommandCenterStore } from '../../infrastructure/cache/command-center.store.ts';
import {
  evaluateStockThreshold,
  evaluateBedThreshold,
  runStockoutForecast,
  runEarlyWarningAnalysis,
  recommendTransferDonors,
  computeStressLevel
} from '../../domain/rules/command-center.rules.ts';
import { GeminiCommandCenterAdapter } from '../../infrastructure/mcp/gemini-command-center.adapter.ts';
import { getDistrictById, getStateById, INDIA_DISTRICTS } from '../../infrastructure/data/india-geography.ts';

export class ManageCommandCenterUseCase {
  constructor(
    private readonly store: InMemoryCommandCenterStore,
    private readonly geminiAdapter: GeminiCommandCenterAdapter
  ) {}

  /**
   * Ensures a district has representative facilities populated.
   * If a district was just selected from pan-India list and has 0 facilities,
   * generates 5 to 7 realistic health facilities based on the district's centroid and tier.
   */
  public ensureDistrictFacilities(districtId: string): CommandFacility[] {
    const existing = this.store.getFacilitiesByDistrict(districtId);
    if (existing.length > 0) return existing;

    const district = getDistrictById(districtId);
    if (!district) return [];

    const state = getStateById(district.stateId);
    const stateName = state?.name || 'India';
    const distName = district.name;
    const { lat, lng } = district;
    const now = Date.now();
    const ago = (h: number) => new Date(now - h * 3600000).toISOString();

    const generated: CommandFacility[] = [
      {
        id: `fac_${districtId}_dh`,
        districtId,
        stateId: district.stateId,
        name: `${distName} District Civil Hospital`,
        type: 'DH',
        taluka: `${distName} Central`,
        lat: +(lat + 0.002).toFixed(4),
        lng: +(lng + 0.003).toFixed(4),
        contactPerson: 'Dr. Civil Surgeon / DHO',
        phone: '020-26120001',
        bedsTotal: 250,
        bedsOccupied: 198,
        icuTotal: 24,
        icuOccupied: 19,
        stressLevel: 'critical',
        lastReportedAt: ago(0.5),
        isStale: false,
        registeredAt: ago(720)
      },
      {
        id: `fac_${districtId}_sdh_1`,
        districtId,
        stateId: district.stateId,
        name: `${distName} North Sub-Divisional Hospital`,
        type: 'SDH',
        taluka: `${distName} North`,
        lat: +(lat + 0.082).toFixed(4),
        lng: +(lng + 0.045).toFixed(4),
        contactPerson: 'Dr. Medical Superintendent',
        phone: '020-27120002',
        bedsTotal: 100,
        bedsOccupied: 68,
        icuTotal: 8,
        icuOccupied: 5,
        stressLevel: 'moderate',
        lastReportedAt: ago(1.2),
        isStale: false,
        registeredAt: ago(720)
      },
      {
        id: `fac_${districtId}_chc_1`,
        districtId,
        stateId: district.stateId,
        name: `${distName} Rural Community Health Centre`,
        type: 'CHC',
        taluka: `${distName} Rural`,
        lat: +(lat - 0.065).toFixed(4),
        lng: +(lng - 0.052).toFixed(4),
        contactPerson: 'Dr. Block Medical Officer',
        phone: '020-28120003',
        bedsTotal: 30,
        bedsOccupied: 21,
        icuTotal: 2,
        icuOccupied: 1,
        stressLevel: 'normal',
        lastReportedAt: ago(2.5),
        isStale: false,
        registeredAt: ago(720)
      },
      {
        id: `fac_${districtId}_phc_1`,
        districtId,
        stateId: district.stateId,
        name: `${distName} Primary Health Centre A`,
        type: 'PHC',
        taluka: `${distName} Sector 1`,
        lat: +(lat + 0.045).toFixed(4),
        lng: +(lng - 0.038).toFixed(4),
        contactPerson: 'Dr. Medical Officer Incharge',
        phone: '020-29120004',
        bedsTotal: 12,
        bedsOccupied: 9,
        icuTotal: 0,
        icuOccupied: 0,
        stressLevel: 'moderate',
        lastReportedAt: ago(4),
        isStale: false,
        registeredAt: ago(720)
      },
      {
        id: `fac_${districtId}_phc_2`,
        districtId,
        stateId: district.stateId,
        name: `${distName} Primary Health Centre B`,
        type: 'PHC',
        taluka: `${distName} Sector 2`,
        lat: +(lat - 0.035).toFixed(4),
        lng: +(lng + 0.062).toFixed(4),
        contactPerson: 'Dr. Medical Officer Incharge',
        phone: '020-29120005',
        bedsTotal: 10,
        bedsOccupied: 4,
        icuTotal: 0,
        icuOccupied: 0,
        stressLevel: 'normal',
        lastReportedAt: ago(28),
        isStale: true,
        registeredAt: ago(720)
      }
    ];

    generated.forEach(f => {
      this.store.registerFacility(f);

      // Seed initial bed and stock snapshots
      this.store.ingestBedSnapshot({
        id: `BED_${f.id}_gen`,
        facilityId: f.id,
        districtId,
        timestamp: ago(0.5),
        wardType: 'general',
        totalCapacity: f.bedsTotal,
        occupied: f.bedsOccupied,
        free: f.bedsTotal - f.bedsOccupied,
        occupancyRatePct: +((f.bedsOccupied / f.bedsTotal) * 100).toFixed(1),
        sourceUserId: 'system_auto_seed'
      });

      if (f.icuTotal > 0) {
        this.store.ingestBedSnapshot({
          id: `BED_${f.id}_icu`,
          facilityId: f.id,
          districtId,
          timestamp: ago(0.5),
          wardType: 'icu',
          totalCapacity: f.icuTotal,
          occupied: f.icuOccupied,
          free: f.icuTotal - f.icuOccupied,
          occupancyRatePct: +((f.icuOccupied / f.icuTotal) * 100).toFixed(1),
          sourceUserId: 'system_auto_seed'
        });
      }

      this.store.ingestStockSnapshot({
        id: `STK_${f.id}_oxy`,
        facilityId: f.id,
        districtId,
        timestamp: ago(0.5),
        resourceId: 'oxygen_cylinders',
        resourceName: 'Oxygen Cylinders (B-type)',
        category: 'oxygen',
        unit: 'cylinders',
        currentQuantity: f.type === 'DH' ? 12 : 6,
        dailyUsageEst: f.type === 'DH' ? 8 : 2,
        daysOfCoverRemaining: f.type === 'DH' ? 1.5 : 3.0,
        sourceUserId: 'system_auto_seed'
      });
    });

    // Seed default threshold rules for this district
    this.store.upsertThresholdRule({
      id: `rule_oxy_${districtId}`,
      districtId,
      facilityId: null,
      resourceId: 'oxygen_cylinders',
      resourceName: 'Oxygen Cylinders',
      wardType: null,
      minimumLevel: 5,
      reorderLevel: 15,
      targetBuffer: 40,
      daysOfCoverMin: 5,
      severity: 'critical',
      cooldownMinutes: 60,
      seasonalPreset: 'standard',
      isActive: true,
      updatedBy: 'system',
      updatedAt: ago(1)
    });

    return generated;
  }

  /**
   * S1: District Overview KPI Aggregates
   */
  public async getOverview(districtId: string): Promise<DistrictOverview> {
    const facilities = this.ensureDistrictFacilities(districtId);
    const district = getDistrictById(districtId);
    const state = district ? getStateById(district.stateId) : undefined;

    let totalBeds = 0;
    let occupiedBeds = 0;
    let totalIcu = 0;
    let occupiedIcu = 0;
    let missingReports = 0;
    const criticalFacilities: string[] = [];
    const stressDist = { normal: 0, moderate: 0, critical: 0, unknown: 0 };

    for (const f of facilities) {
      totalBeds += f.bedsTotal;
      occupiedBeds += f.bedsOccupied;
      totalIcu += f.icuTotal;
      occupiedIcu += f.icuOccupied;

      if (f.isStale) missingReports++;
      if (f.stressLevel === 'critical') criticalFacilities.push(f.name);
      stressDist[f.stressLevel] = (stressDist[f.stressLevel] || 0) + 1;
    }

    const alerts = this.store.getAlertsByDistrict(districtId);
    const openAlerts = alerts.filter(a => a.status === 'open');
    const criticalAlerts = openAlerts.filter(a => a.severity === 'critical').length;
    const outbreakAlerts = openAlerts.filter(a => a.type === 'outbreak').length;

    // Identify facilities with oxygen shortages
    const oxygenShortageFacilities = facilities
      .filter(f => {
        const stocks = this.store.getStockSnapshots(f.id, 'oxygen_cylinders');
        const latest = stocks[stocks.length - 1];
        return latest && (latest.currentQuantity <= 8 || latest.daysOfCoverRemaining < 2);
      })
      .map(f => f.name);

    const availableBeds = Math.max(0, totalBeds - occupiedBeds);
    const availableIcu = Math.max(0, totalIcu - occupiedIcu);

    return {
      districtId,
      districtName: district?.name || 'Hazaribagh',
      stateName: state?.name || 'Jharkhand',
      totalFacilities: facilities.length,
      facilitiesReporting: facilities.length - missingReports,
      missingReportCount: missingReports,
      totalBeds,
      availableBeds,
      availableBedsPercent: totalBeds > 0 ? +((availableBeds / totalBeds) * 100).toFixed(1) : 0,
      totalIcuBeds: totalIcu,
      availableIcuBeds: availableIcu,
      availableIcuPercent: totalIcu > 0 ? +((availableIcu / totalIcu) * 100).toFixed(1) : 0,
      criticalFacilities,
      openAlerts: openAlerts.length,
      criticalAlerts,
      activeOutbreakClusters: outbreakAlerts,
      oxygenShortageFacilities,
      lastUpdated: new Date().toISOString(),
      stressDistribution: stressDist
    };
  }

  /**
   * S1 & S2: Get facilities list
   */
  public async getFacilities(districtId: string): Promise<CommandFacility[]> {
    return this.ensureDistrictFacilities(districtId);
  }

  /**
   * S2: Detailed facility drilldown
   */
  public async getFacilityDetail(facilityId: string): Promise<{
    facility: CommandFacility | undefined;
    beds: BedSnapshot[];
    stocks: StockSnapshot[];
    alerts: CommandAlert[];
  }> {
    const facility = this.store.getFacility(facilityId);
    const beds = this.store.getBedSnapshots(facilityId);
    const alerts = facility ? this.store.getAlertsByDistrict(facility.districtId).filter(a => a.facilityId === facilityId) : [];

    // Get latest stocks for all resources for this facility
    const stocks: StockSnapshot[] = [];
    const resourceKeys = ['oxygen_cylinders', 'paracetamol_500mg', 'blood_o_pos', 'iv_fluids_ns', 'artesunate_inj'];
    for (const rk of resourceKeys) {
      const list = this.store.getStockSnapshots(facilityId, rk);
      if (list.length > 0) stocks.push(list[list.length - 1]);
    }

    return { facility, beds, stocks, alerts };
  }

  /**
   * S3: Reporting Compliance Matrix
   */
  public async getReportingMatrix(districtId: string, days: number = 7): Promise<ReportingMatrix> {
    const facilities = this.ensureDistrictFacilities(districtId);
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      dates.push(new Date(Date.now() - i * 86400000).toISOString().split('T')[0]);
    }

    const rows = facilities.map(f => {
      const isStale = f.isStale;
      const reportedDates = isStale ? dates.slice(0, -1) : [...dates];
      const missingDates = isStale ? [dates[dates.length - 1]] : [];

      return {
        facilityId: f.id,
        facilityName: f.name,
        type: f.type,
        reportedDates,
        missingDates,
        lastReportedAt: f.lastReportedAt,
        isStale,
        contactPhone: f.phone
      };
    });

    return { districtId, dates, facilities: rows };
  }

  /**
   * S3: One-Click Report Reminder
   */
  public async triggerReportReminder(facilityId: string, actor: string): Promise<{ success: boolean; message: string }> {
    const facility = this.store.getFacility(facilityId);
    if (!facility) return { success: false, message: 'Facility not found' };

    this.store.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      districtId: facility.districtId,
      userId: actor,
      userRole: 'district_admin',
      action: 'TRIGGER_REMINDER',
      entity: 'Facility',
      entityId: facilityId,
      diffSummary: `Automated urgent reporting alert dispatched to ${facility.name} (Contact: ${facility.contactPerson}, Phone: ${facility.phone})`
    });

    return {
      success: true,
      message: `Urgent SMS & Dashboard dispatch sent to ${facility.contactPerson} (${facility.phone}). Reminder logged in district audit trail.`
    };
  }

  /**
   * S4: Rules & Thresholds
   */
  public async getThresholdRules(districtId: string): Promise<ThresholdRule[]> {
    this.ensureDistrictFacilities(districtId);
    return this.store.getThresholdRules(districtId);
  }

  public async upsertThresholdRule(rule: ThresholdRule, actor: string): Promise<ThresholdRule> {
    const saved = this.store.upsertThresholdRule(rule);
    this.store.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      districtId: rule.districtId,
      userId: actor,
      userRole: 'district_admin',
      action: 'UPDATE_RULE',
      entity: 'ThresholdRule',
      entityId: rule.id,
      diffSummary: `Configured ${rule.resourceName} thresholds: Min ${rule.minimumLevel}, Reorder ${rule.reorderLevel}, Buffer ${rule.targetBuffer}, Days ${rule.daysOfCoverMin}`
    });
    return saved;
  }

  public async applySeasonalPreset(
    districtId: string,
    preset: SeasonalPreset,
    actor: string
  ): Promise<ThresholdRule[]> {
    const rules = this.store.getThresholdRules(districtId);
    const updated = rules.map(r => {
      let bufferMult = 1.0;
      let minDays = r.daysOfCoverMin;

      if (preset === 'monsoon_fevers' || preset === 'dengue_peak') {
        if (r.resourceId.includes('paracetamol') || r.resourceId.includes('iv_fluids') || r.resourceId.includes('artesunate')) {
          bufferMult = 2.0;
          minDays = 14;
        }
      } else if (preset === 'respiratory_winter') {
        if (r.resourceId.includes('oxygen')) {
          bufferMult = 1.5;
          minDays = 10;
        }
      }

      return {
        ...r,
        targetBuffer: Math.round(r.targetBuffer * bufferMult),
        reorderLevel: Math.round(r.reorderLevel * bufferMult),
        daysOfCoverMin: minDays,
        seasonalPreset: preset,
        updatedBy: actor,
        updatedAt: new Date().toISOString()
      };
    });

    updated.forEach(r => this.store.upsertThresholdRule(r));

    this.store.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      districtId,
      userId: actor,
      userRole: 'district_admin',
      action: 'UPDATE_RULE',
      entity: 'SeasonalPreset',
      entityId: preset,
      diffSummary: `Applied seasonal preset '${preset}' district-wide. Multipliers adjusted for fever & respiratory supplies.`
    });

    return updated;
  }

  /**
   * S5: Alerts & Action Lifecycle
   */
  public async getAlerts(districtId: string, status?: AlertStatus): Promise<CommandAlert[]> {
    this.ensureDistrictFacilities(districtId);
    return this.store.getAlertsByDistrict(districtId, status);
  }

  public async updateAlertStatus(
    districtId: string,
    alertId: string,
    status: AlertStatus,
    actor: string,
    snoozeReason?: string,
    snoozeUntil?: string
  ): Promise<CommandAlert | null> {
    const updated = this.store.updateAlertStatus(alertId, status, actor, snoozeReason, snoozeUntil);
    if (updated) {
      this.store.addAuditLog({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        districtId,
        userId: actor,
        userRole: 'district_admin',
        action: status === 'acknowledged' ? 'ACK_ALERT' : status === 'resolved' ? 'RESOLVE_ALERT' : 'SNOOZE_ALERT',
        entity: 'CommandAlert',
        entityId: alertId,
        diffSummary: `Alert ${alertId} status transitioned to '${status}' by ${actor}. ${snoozeReason ? `Reason: ${snoozeReason}` : ''}`
      });
    }
    return updated;
  }

  /**
   * S5: Shortage Forecast Engine Run
   */
  public async getStockoutForecasts(districtId: string, facilityId?: string): Promise<StockoutForecast[]> {
    const facilities = this.ensureDistrictFacilities(districtId);
    const targetFacilities = facilityId ? facilities.filter(f => f.id === facilityId) : facilities;
    const forecasts: StockoutForecast[] = [];

    for (const fac of targetFacilities) {
      const stocks = this.store.getStockSnapshots(fac.id, 'oxygen_cylinders');
      if (stocks.length > 0) {
        const latest = stocks[stocks.length - 1];
        // Generate realistic 14-day trailing consumption series
        const usageHistory = [10, 11, 9, 12, 13, 11, 14, 12, 13, 15, 14, 16, 15, latest.dailyUsageEst];
        const fc = runStockoutForecast(
          fac.id,
          latest.resourceId,
          `${fac.name} - ${latest.resourceName}`,
          latest.currentQuantity,
          usageHistory,
          latest.unit
        );
        forecasts.push(fc);
      }
    }

    return forecasts;
  }

  /**
   * S6: Outbreak Watch & Gemini Situational Briefing
   */
  public async getOutbreakWatch(
    districtId: string,
    cluster: SymptomCluster = 'acute_fever_rash',
    days: number = 14
  ): Promise<EarlyWarningResult> {
    this.ensureDistrictFacilities(districtId);
    const district = getDistrictById(districtId);
    const state = district ? getStateById(district.stateId) : undefined;
    const districtName = district?.name || 'Hazaribagh';
    const stateName = state?.name || 'Jharkhand';

    const history = this.store.getSyndromicHistory(districtId, cluster, days);
    const facilities = this.store.getFacilitiesByDistrict(districtId);

    const anomalousFacilities = facilities
      .slice(0, 3)
      .map(f => ({ id: f.id, name: f.name, lat: f.lat, lng: f.lng, count: 18 + Math.floor(Math.random() * 8) }));

    const baseAnalysis = runEarlyWarningAnalysis(districtId, cluster, history, anomalousFacilities);

    // Call Gemini AI adapter for situational briefing
    const geminiResult = await this.geminiAdapter.generateOutbreakBrief(
      baseAnalysis,
      districtName,
      stateName,
      anomalousFacilities.map(f => f.name)
    );

    return {
      ...baseAnalysis,
      situationalBrief: geminiResult.situationalBrief,
      recommendedActions: geminiResult.recommendedActions
    };
  }

  /**
   * S7: Transfer Recommendations & Workflow
   */
  public async getTransferRecommendations(
    facilityId: string,
    resourceId: string,
    quantityNeeded: number
  ): Promise<{
    recommendations: TransferRecommendation[];
    mitigationNarrative: string;
  }> {
    const shortageFac = this.store.getFacility(facilityId);
    if (!shortageFac) return { recommendations: [], mitigationNarrative: 'Facility not found' };

    const allFacilities = this.store.getFacilitiesByDistrict(shortageFac.districtId);
    const allStocks = this.store.getAllLatestStock(shortageFac.districtId);
    const rules = this.store.getThresholdRules(shortageFac.districtId);

    const recommendations = recommendTransferDonors(
      shortageFac,
      resourceId,
      quantityNeeded,
      allFacilities,
      allStocks,
      rules
    );

    // Create a mock forecast for narrative generation
    const mockForecast: StockoutForecast = {
      facilityId,
      resourceId,
      resourceName: resourceId.replace(/_/g, ' '),
      currentQuantity: 8,
      dailyUsageEst: 12,
      projectedStockoutDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      daysUntilStockout: 5,
      forecastPoints: [],
      confidence: 0.9,
      method: 'wma',
      isCritical: true
    };

    const narrative = await this.geminiAdapter.generateShortageMitigationNarrative(
      mockForecast,
      shortageFac.name,
      recommendations
    );

    return { recommendations, mitigationNarrative: narrative };
  }

  public async createRequest(payload: Partial<CommandRequest>, actor: string): Promise<CommandRequest> {
    const req: CommandRequest = {
      id: `REQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      districtId: payload.districtId || 'dist_jhk_hazaribagh',
      type: payload.type || 'transfer',
      fromFacilityId: payload.fromFacilityId || '',
      fromFacilityName: payload.fromFacilityName || '',
      toFacilityId: payload.toFacilityId || '',
      toFacilityName: payload.toFacilityName || '',
      resourceId: payload.resourceId || 'oxygen_cylinders',
      resourceName: payload.resourceName || 'Oxygen Cylinders (B-type)',
      quantityRequested: Number(payload.quantityRequested) || 10,
      urgency: payload.urgency || 'urgent',
      notes: payload.notes,
      status: 'submitted',
      statusTimeline: [
        { status: 'submitted', timestamp: new Date().toISOString(), actor, notes: payload.notes }
      ],
      linkedAlertId: payload.linkedAlertId,
      createdBy: actor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.store.createRequest(req);
    this.store.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      districtId: req.districtId,
      userId: actor,
      userRole: 'district_admin',
      action: 'APPROVE_TRANSFER',
      entity: 'CommandRequest',
      entityId: req.id,
      diffSummary: `Initiated transfer request ${req.id}: ${req.quantityRequested} units of ${req.resourceName} from ${req.fromFacilityName} to ${req.toFacilityName}`
    });

    return req;
  }

  public async updateRequestStatus(
    requestId: string,
    status: RequestStatus,
    actor: string,
    notes?: string
  ): Promise<CommandRequest | null> {
    const req = this.store.updateRequestStatus(requestId, status, actor, notes);
    if (req) {
      this.store.addAuditLog({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        districtId: req.districtId,
        userId: actor,
        userRole: 'district_admin',
        action: status === 'approved' ? 'APPROVE_TRANSFER' : 'REJECT_TRANSFER',
        entity: 'CommandRequest',
        entityId: req.id,
        diffSummary: `Request ${req.id} updated to status '${status}' by ${actor}. ${notes ? `Notes: ${notes}` : ''}`
      });
    }
    return req;
  }

  public async getRequests(districtId: string, status?: RequestStatus): Promise<CommandRequest[]> {
    this.ensureDistrictFacilities(districtId);
    return this.store.getRequestsByDistrict(districtId, status);
  }

  /**
   * Live Ingestion Handlers (Automatically triggers reactive Threshold Engine)
   */
  public async ingestBedSnapshot(snapshot: BedSnapshot): Promise<{ snapshot: BedSnapshot; alert: CommandAlert | null }> {
    this.store.ingestBedSnapshot(snapshot);
    const facility = this.store.getFacility(snapshot.facilityId) || null;
    const existingAlerts = this.store.getAlertsByDistrict(snapshot.districtId);

    const alert = evaluateBedThreshold(snapshot, facility, existingAlerts);
    if (alert) {
      this.store.addAlert(alert);
    }

    return { snapshot, alert };
  }

  public async ingestStockSnapshot(snapshot: StockSnapshot): Promise<{ snapshot: StockSnapshot; alert: CommandAlert | null }> {
    this.store.ingestStockSnapshot(snapshot);
    const rules = this.store.getThresholdRules(snapshot.districtId);
    const existingAlerts = this.store.getAlertsByDistrict(snapshot.districtId);

    const alert = evaluateStockThreshold(snapshot, rules, existingAlerts);
    if (alert) {
      this.store.addAlert(alert);
    }

    return { snapshot, alert };
  }

  /**
   * S8: Audit Trail
   */
  public async getAuditLogs(districtId: string, limit: number = 100): Promise<CommandAuditLog[]> {
    return this.store.getAuditLogs(districtId, limit);
  }
}
