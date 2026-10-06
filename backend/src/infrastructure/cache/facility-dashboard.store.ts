/**
 * Feature Map 07 — Facility Dashboard Infrastructure Store
 * In-Memory persistence for facility alerts, resource statuses, and mock telemetry
 */

import type {
  FacilityAlert,
  FacilityResourceStatus,
  AlertStatus,
  ResourceType
} from '../../domain/models/facility-dashboard.model.ts';
import { isResourceStale, checkResourceAlertThreshold } from '../../domain/rules/dashboard-aggregation.rules.ts';

export class InMemoryFacilityDashboardStore {
  public alerts: Map<string, FacilityAlert>;
  public resources: Map<string, FacilityResourceStatus[]>;
  public facilities: Array<{ facilityId: string; name: string; type: string; district: string }>;

  constructor() {
    this.alerts = new Map();
    this.resources = new Map();
    this.facilities = [
      {
        facilityId: 'fac_01',
        name: 'District Sadar Hospital (Hazaribagh)',
        type: 'District Hospital (DH)',
        district: 'Hazaribagh'
      },
      {
        facilityId: 'fac_02',
        name: 'Katkamsandi Community Health Centre (CHC)',
        type: 'Community Health Centre (CHC)',
        district: 'Hazaribagh'
      },
      {
        facilityId: 'fac_03',
        name: 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)',
        type: 'Tertiary Medical College',
        district: 'Hazaribagh'
      }
    ];

    this.seedInitialData();
  }

  private seedInitialData(): void {
    // --- Seed Alerts for District Sadar Hospital (fac_01) ---
    const sadarAlerts: FacilityAlert[] = [
      {
        alertId: 'ALT-2026-001',
        facilityId: 'fac_01',
        alertType: 'emergency_case',
        severity: 'critical',
        relatedEntityId: 'PAT-2026-1024',
        message: 'CRITICAL Emergency Alert: Acute STEMI / severe chest pain patient (Ramesh Mahto) triaged and en route to Emergency ICU.',
        status: 'active',
        createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString()
      },
      {
        alertId: 'ALT-2026-002',
        facilityId: 'fac_01',
        alertType: 'high_risk_patient',
        severity: 'critical',
        relatedEntityId: 'PAT-2026-2048',
        message: 'High-Risk Deterioration Alert: Dynamic risk score jumped to 82/100 (HIGH) for Sunita Soren. BP 168/104 mmHg recorded by ASHA Anita Devi.',
        status: 'active',
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString()
      },
      {
        alertId: 'ALT-2026-003',
        facilityId: 'fac_01',
        alertType: 'critical_resource',
        severity: 'warning',
        relatedEntityId: 'res_icu_bed',
        message: 'Critical Resource Warning: Available ICU Beds is down to 2 of 12 (17% capacity). Coordinate step-down transfers if influx occurs.',
        status: 'active',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
      },
      {
        alertId: 'ALT-2026-004',
        facilityId: 'fac_01',
        alertType: 'missed_follow_up',
        severity: 'warning',
        relatedEntityId: 'PAT-2026-3091',
        message: 'Missed Follow-Up Notice: Scheduled hypertensive home check for Birju Soren is 2 days overdue in Katkamsandi sector.',
        status: 'acknowledged',
        createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        acknowledgedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
      },
      {
        alertId: 'ALT-2026-005',
        facilityId: 'fac_01',
        alertType: 'system_data_update',
        severity: 'info',
        relatedEntityId: 'sync_abdm_44',
        message: 'ABDM Health Data Sync Complete: 52 FHIR diagnostic and consultation bundles verified and linked to ABHA consent manager.',
        status: 'resolved',
        createdAt: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
        resolvedBy: 'Admin (System)'
      }
    ];

    // --- Seed Alerts for Katkamsandi CHC (fac_02) ---
    const chcAlerts: FacilityAlert[] = [
      {
        alertId: 'ALT-2026-006',
        facilityId: 'fac_02',
        alertType: 'critical_resource',
        severity: 'warning',
        relatedEntityId: 'res_icu_bed_chc',
        message: 'Stabilization Bed Warning: Only 1 of 2 stabilization beds available at Katkamsandi CHC.',
        status: 'active',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      },
      {
        alertId: 'ALT-2026-007',
        facilityId: 'fac_02',
        alertType: 'missed_follow_up',
        severity: 'warning',
        relatedEntityId: 'PAT-2026-3091',
        message: 'Overdue Field Visit: Post-natal follow-up visit overdue by 24h in Sector 3 (ASHA Sita Devi).',
        status: 'active',
        createdAt: new Date(Date.now() - 75 * 60 * 1000).toISOString()
      }
    ];

    // --- Seed Alerts for Sheikh Bhikhari Medical College (fac_03) ---
    const sbmchAlerts: FacilityAlert[] = [
      {
        alertId: 'ALT-2026-008',
        facilityId: 'fac_03',
        alertType: 'emergency_case',
        severity: 'critical',
        relatedEntityId: 'PAT-2026-9921',
        message: 'CRITICAL Trauma Influx: Multi-trauma highway accident patient arriving via 108 ALS Ambulance.',
        status: 'active',
        createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
      },
      {
        alertId: 'ALT-2026-009',
        facilityId: 'fac_03',
        alertType: 'critical_resource',
        severity: 'warning',
        relatedEntityId: 'res_icu_sbmch',
        message: 'Cardiology ICU Capacity Alert: 8 of 35 ICU beds remaining (77% occupied).',
        status: 'active',
        createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString()
      },
      {
        alertId: 'ALT-2026-010',
        facilityId: 'fac_03',
        alertType: 'system_data_update',
        severity: 'info',
        relatedEntityId: 'sync_abdm_sbmch',
        message: 'ABDM HL7 FHIR Pipeline: 120 electronic records securely synchronized with National Health Stack.',
        status: 'resolved',
        createdAt: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        resolvedBy: 'Admin (System)'
      }
    ];

    for (const a of [...sadarAlerts, ...chcAlerts, ...sbmchAlerts]) {
      this.alerts.set(a.alertId, a);
    }

    // --- Seed Resources for All 3 Facilities ---
    this.resources.set('fac_01', [
      {
        facilityId: 'fac_01',
        resourceType: 'bed',
        resourceName: 'General Inpatient Beds',
        totalCount: 120,
        availableCount: 34,
        lastUpdated: new Date(Date.now() - 35 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_01',
        resourceType: 'icu_bed',
        resourceName: 'ICU & High-Dependency Beds',
        totalCount: 12,
        availableCount: 2,
        lastUpdated: new Date(Date.now() - 20 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_01',
        resourceType: 'ventilator',
        resourceName: 'Mechanical Ventilators',
        totalCount: 8,
        availableCount: 3,
        lastUpdated: new Date(Date.now() - 50 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_01',
        resourceType: 'oxygen',
        resourceName: 'High-Pressure Oxygen Cylinders (D-Type)',
        totalCount: 45,
        availableCount: 18,
        lastUpdated: new Date(Date.now() - 15 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_01',
        resourceType: 'ambulance',
        resourceName: '108 / Emergency Ambulances',
        totalCount: 6,
        availableCount: 2,
        lastUpdated: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      }
    ]);

    this.resources.set('fac_02', [
      {
        facilityId: 'fac_02',
        resourceType: 'bed',
        resourceName: 'General Inpatient Beds',
        totalCount: 30,
        availableCount: 14,
        lastUpdated: new Date(Date.now() - 90 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_02',
        resourceType: 'icu_bed',
        resourceName: 'Stabilization / ICU Beds',
        totalCount: 2,
        availableCount: 1,
        lastUpdated: new Date(Date.now() - 110 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_02',
        resourceType: 'oxygen',
        resourceName: 'Oxygen Cylinders',
        totalCount: 15,
        availableCount: 9,
        lastUpdated: new Date(Date.now() - 40 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_02',
        resourceType: 'ambulance',
        resourceName: 'Primary Ambulances',
        totalCount: 2,
        availableCount: 1,
        lastUpdated: new Date(Date.now() - 15 * 60 * 1000).toISOString()
      }
    ]);

    this.resources.set('fac_03', [
      {
        facilityId: 'fac_03',
        resourceType: 'bed',
        resourceName: 'General Inpatient Beds',
        totalCount: 350,
        availableCount: 85,
        lastUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_03',
        resourceType: 'icu_bed',
        resourceName: 'ICU & Cardiac Care Beds',
        totalCount: 35,
        availableCount: 8,
        lastUpdated: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_03',
        resourceType: 'ventilator',
        resourceName: 'Advanced Ventilators',
        totalCount: 24,
        availableCount: 7,
        lastUpdated: new Date(Date.now() - 45 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_03',
        resourceType: 'oxygen',
        resourceName: 'Liquid Oxygen & Cylinders',
        totalCount: 120,
        availableCount: 54,
        lastUpdated: new Date(Date.now() - 25 * 60 * 1000).toISOString()
      },
      {
        facilityId: 'fac_03',
        resourceType: 'ambulance',
        resourceName: 'Advanced Life Support Ambulances',
        totalCount: 10,
        availableCount: 5,
        lastUpdated: new Date(Date.now() - 20 * 60 * 1000).toISOString()
      }
    ]);
  }

  public getAlertsByFacility(facilityId: string): FacilityAlert[] {
    const list: FacilityAlert[] = [];
    for (const a of this.alerts.values()) {
      if (a.facilityId === facilityId) {
        list.push(a);
      }
    }
    // Return latest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addAlert(alert: FacilityAlert): FacilityAlert {
    this.alerts.set(alert.alertId, alert);
    return alert;
  }

  public updateAlertStatus(
    alertId: string,
    status: AlertStatus,
    actorId = 'admin_user'
  ): FacilityAlert | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.status = status;
    if (status === 'acknowledged') {
      alert.acknowledgedAt = new Date().toISOString();
    } else if (status === 'resolved') {
      alert.resolvedAt = new Date().toISOString();
      alert.resolvedBy = actorId;
    }

    this.alerts.set(alertId, alert);
    return alert;
  }

  public getResourcesByFacility(facilityId: string): FacilityResourceStatus[] {
    const resList = this.resources.get(facilityId) || [];
    return resList.map((r) => ({
      ...r,
      isStale: isResourceStale(r.lastUpdated)
    }));
  }

  public updateResourceCount(
    facilityId: string,
    resourceType: ResourceType,
    totalCount: number,
    availableCount: number
  ): FacilityResourceStatus {
    let list = this.resources.get(facilityId) || [];
    let target = list.find((r) => r.resourceType === resourceType);

    if (target) {
      target.totalCount = Number(totalCount);
      target.availableCount = Number(availableCount);
      target.lastUpdated = new Date().toISOString();
      target.isStale = false;
    } else {
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
        resourceName: names[resourceType] || resourceType,
        totalCount: Number(totalCount),
        availableCount: Number(availableCount),
        lastUpdated: new Date().toISOString(),
        isStale: false
      };
      list.push(target);
      this.resources.set(facilityId, list);
    }

    // Check threshold and auto-trigger alert if low
    const alert = checkResourceAlertThreshold(target);
    if (alert) {
      this.addAlert(alert);
    }

    return target;
  }

  public getAllFacilities(): Array<{ facilityId: string; name: string; type: string; district: string }> {
    return this.facilities;
  }
}
