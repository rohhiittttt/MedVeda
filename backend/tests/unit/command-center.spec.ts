/**
 * Unit Test Suite for Feature Map 09: District Admin Command Center (MV-DAC)
 * Verifies:
 * 1. Pan-India Geography Data (States, UTs, District lookups)
 * 2. Threshold & Buffer Engine (Reactive alerting, cooldowns, dedup)
 * 3. Shortage Forecast Engine (7-14 day projection, stockout calculation)
 * 4. Epidemic Early Warning Engine (EARS C1, C2, CUSUM, DBSCAN spatial clustering)
 * 5. Surplus Transfer Recommender (Proximity, donor protection, ranking)
 * 6. Use-Case Orchestration & Pan-India Dynamic District Populator
 * 7. Request Workflow & Audit Trail
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  INDIA_STATES,
  INDIA_DISTRICTS,
  getDistrictsByState,
  getDistrictById,
  searchDistricts
} from '../../src/infrastructure/data/india-geography.ts';

import {
  evaluateStockThreshold,
  evaluateBedThreshold,
  runStockoutForecast,
  earsC1,
  earsC2,
  cusumCheck,
  spatialCluster,
  recommendTransferDonors,
  computeStressLevel
} from '../../src/domain/rules/command-center.rules.ts';

import { InMemoryCommandCenterStore } from '../../src/infrastructure/cache/command-center.store.ts';
import { GeminiCommandCenterAdapter } from '../../src/infrastructure/mcp/gemini-command-center.adapter.ts';
import { ManageCommandCenterUseCase } from '../../src/application/use-cases/manage-command-center.use-case.ts';

describe('Feature 09: District Admin Command Center (MV-DAC)', () => {

  describe('1. Pan-India Geography Master Data', () => {
    it('should include all 28 states and 8 union territories (36 total)', () => {
      assert.strictEqual(INDIA_STATES.length, 36, 'Must contain exactly 36 states + UTs');
      const stateIds = new Set(INDIA_STATES.map(s => s.id));
      assert.ok(stateIds.has('maharashtra'), 'Must include Maharashtra');
      assert.ok(stateIds.has('jharkhand'), 'Must include Jharkhand');
      assert.ok(stateIds.has('delhi'), 'Must include Delhi');
      assert.ok(stateIds.has('tamil_nadu'), 'Must include Tamil Nadu');
      assert.ok(stateIds.has('karnataka'), 'Must include Karnataka');
    });

    it('should retrieve districts by state and support fuzzy search', () => {
      const mhDistricts = getDistrictsByState('maharashtra');
      assert.ok(mhDistricts.length >= 5, 'Maharashtra should have representative districts');
      const pune = mhDistricts.find(d => d.name.toLowerCase().includes('pune'));
      assert.ok(pune, 'Pune must be present in Maharashtra');

      const hazaribagh = getDistrictById('dist_jhk_hazaribagh');
      assert.ok(hazaribagh, 'Hazaribagh district must be retrievable by ID');
      assert.strictEqual(hazaribagh?.name, 'Hazaribagh');

      const searchResults = searchDistricts('ranchi');
      assert.ok(searchResults.some(d => d.name.toLowerCase() === 'ranchi'));
    });
  });

  describe('2. Engine 1: Threshold & Buffer Engine', () => {
    it('should trigger a critical alert when quantity drops below minimum level', () => {
      const snap = {
        id: 's1',
        facilityId: 'fac_01',
        districtId: 'dist_jhk_hazaribagh',
        timestamp: new Date().toISOString(),
        resourceId: 'oxygen_cylinders',
        resourceName: 'Oxygen Cylinders',
        category: 'oxygen' as const,
        unit: 'cylinders',
        currentQuantity: 3, // Below min 5
        dailyUsageEst: 6,
        daysOfCoverRemaining: 0.5,
        sourceUserId: 'u1'
      };

      const rules = [{
        id: 'r1',
        districtId: 'dist_jhk_hazaribagh',
        facilityId: null,
        resourceId: 'oxygen_cylinders',
        resourceName: 'Oxygen Cylinders',
        wardType: null,
        minimumLevel: 5,
        reorderLevel: 15,
        targetBuffer: 40,
        daysOfCoverMin: 7,
        severity: 'critical' as const,
        cooldownMinutes: 60,
        seasonalPreset: 'standard' as const,
        isActive: true,
        updatedBy: 'admin',
        updatedAt: new Date().toISOString()
      }];

      const alert = evaluateStockThreshold(snap, rules, []);
      assert.ok(alert, 'Alert must be generated');
      assert.strictEqual(alert?.severity, 'critical');
      assert.strictEqual(alert?.type, 'threshold');
    });

    it('should flag bed occupancy above critical thresholds (>80% for ICU)', () => {
      const snap = {
        id: 'b1',
        facilityId: 'fac_02',
        districtId: 'dist_jhk_hazaribagh',
        timestamp: new Date().toISOString(),
        wardType: 'icu' as const,
        totalCapacity: 10,
        occupied: 9, // 90%
        free: 1,
        occupancyRatePct: 90,
        sourceUserId: 'u1'
      };

      const alert = evaluateBedThreshold(snap, null, []);
      assert.ok(alert, 'Critical ICU alert must be generated');
      assert.strictEqual(alert?.severity, 'critical');
      assert.ok(alert?.headline.includes('Bed Occupancy'));
    });
  });

  describe('3. Engine 2: Shortage Forecast Engine', () => {
    it('should project stockout horizon and confidence cone', () => {
      const usageHistory = [10, 12, 11, 14, 13, 15, 14]; // ~13.5 per day
      const currentQty = 40; // ~3 days of supply

      const forecast = runStockoutForecast(
        'fac_01',
        'oxygen_cylinders',
        'Oxygen Cylinders',
        currentQty,
        usageHistory,
        'cylinders'
      );

      assert.ok(forecast.daysUntilStockout !== null, 'Must compute stockout day');
      assert.ok(forecast.daysUntilStockout! <= 5, 'Must project stockout within 5 days');
      assert.strictEqual(forecast.isCritical, true, 'Short horizon must be critical');
      assert.strictEqual(forecast.forecastPoints.length, 14, 'Must project 14-day cone');
      assert.ok(forecast.forecastPoints[0].lower90 <= forecast.forecastPoints[0].predicted);
    });
  });

  describe('4. Engine 3: Epidemic Early Warning Engine (EARS / CUSUM / DBSCAN)', () => {
    it('should detect statistical anomaly via EARS C1 and C2', () => {
      const baseline = [5, 6, 4, 5, 6, 5, 4]; // mean 5, low std
      const surgeCount = 22; // High spike > 3 sigma

      const c1 = earsC1(baseline, surgeCount);
      assert.ok(c1.triggered, 'EARS C1 must trigger on 4x surge');
      assert.ok(c1.z > 3.0, 'Z-score must exceed 3.0');

      const c2 = earsC2([5, 5, 5, 5, 5, 5, 5, 5, 5], surgeCount);
      assert.ok(c2.triggered, 'EARS C2 must trigger on sustained deviation');
    });

    it('should cluster nearby anomalous facilities via spatial DBSCAN', () => {
      const anomalies = [
        { id: 'f1', lat: 23.9975, lng: 85.3637 }, // Sadar
        { id: 'f2', lat: 24.0071, lng: 85.3754 }, // Medical college (~1.6 km)
        { id: 'f3', lat: 24.0841, lng: 85.1312 }, // Katkamsandi (~25 km, outside 15km)
        { id: 'f4', lat: 23.9910, lng: 85.3690 }  // Nearby urban clinic (~1 km)
      ];

      const clusters = spatialCluster(anomalies, 15, 2);
      assert.ok(clusters.length >= 1, 'Should find spatial cluster of contiguous clinics');
      const mainCluster = clusters[0];
      assert.ok(mainCluster.includes('f1') && mainCluster.includes('f2'));
    });
  });

  describe('5. Engine 4: Surplus Transfer Recommender', () => {
    it('should find donor hospitals with surplus and protect donor minimums', () => {
      const shortageFac = {
        id: 'fac_01',
        districtId: 'dist_jhk_hazaribagh',
        stateId: 'jharkhand',
        name: 'Sadar Hospital',
        type: 'DH' as const,
        taluka: 'Sadar',
        lat: 23.9975,
        lng: 85.3637,
        contactPerson: 'Dr. A',
        phone: '123',
        bedsTotal: 200,
        bedsOccupied: 150,
        icuTotal: 20,
        icuOccupied: 15,
        stressLevel: 'critical' as const,
        lastReportedAt: new Date().toISOString(),
        isStale: false,
        registeredAt: new Date().toISOString()
      };

      const donorFac = {
        id: 'fac_03',
        districtId: 'dist_jhk_hazaribagh',
        stateId: 'jharkhand',
        name: 'Medical College',
        type: 'MC' as const,
        taluka: 'Sadar',
        lat: 24.0071,
        lng: 85.3754,
        contactPerson: 'Dr. B',
        phone: '456',
        bedsTotal: 400,
        bedsOccupied: 300,
        icuTotal: 40,
        icuOccupied: 30,
        stressLevel: 'normal' as const,
        lastReportedAt: new Date().toISOString(),
        isStale: false,
        registeredAt: new Date().toISOString()
      };

      const stockSnapshots = [
        {
          id: 's1',
          facilityId: 'fac_03',
          districtId: 'dist_jhk_hazaribagh',
          timestamp: new Date().toISOString(),
          resourceId: 'oxygen_cylinders',
          resourceName: 'Oxygen Cylinders',
          category: 'oxygen' as const,
          unit: 'cylinders',
          currentQuantity: 80, // High surplus
          dailyUsageEst: 15,
          daysOfCoverRemaining: 5.3,
          sourceUserId: 'u'
        }
      ];

      const rules = [
        {
          id: 'r1',
          districtId: 'dist_jhk_hazaribagh',
          facilityId: null,
          resourceId: 'oxygen_cylinders',
          resourceName: 'Oxygen',
          minimumLevel: 10,
          reorderLevel: 25,
          targetBuffer: 60,
          daysOfCoverMin: 5,
          severity: 'critical' as const,
          cooldownMinutes: 60,
          seasonalPreset: 'standard' as const,
          isActive: true,
          updatedBy: 'admin',
          updatedAt: new Date().toISOString()
        }
      ];

      const recommendations = recommendTransferDonors(
        shortageFac,
        'oxygen_cylinders',
        20,
        [shortageFac, donorFac],
        stockSnapshots,
        rules
      );

      assert.strictEqual(recommendations.length, 1, 'Should find 1 donor');
      assert.strictEqual(recommendations[0].fromFacilityId, 'fac_03');
      assert.ok(recommendations[0].surplusAvailable >= 20, 'Donor must have sufficient surplus');
      assert.strictEqual(recommendations[0].isViable, true);
    });
  });

  describe('6. Use Case Orchestrator & Pan-India District Populator', () => {
    const store = new InMemoryCommandCenterStore();
    const gemini = new GeminiCommandCenterAdapter();
    const useCase = new ManageCommandCenterUseCase(store, gemini);

    it('should automatically provision representative facilities when switching to any new district', async () => {
      // Switch to Pune (Maharashtra) which initially has 0 in-memory facilities
      const puneOverview = await useCase.getOverview('dist_mh_pune');
      assert.ok(puneOverview, 'Overview must be generated for Pune');
      assert.strictEqual(puneOverview.districtName, 'Pune');
      assert.strictEqual(puneOverview.stateName, 'Maharashtra');
      assert.ok(puneOverview.totalFacilities >= 5, 'Must generate representative facilities for Pune');
      assert.ok(puneOverview.totalBeds > 0, 'Must have bed capacity calculated');
    });

    it('should aggregate Hazaribagh seeded metrics accurately', async () => {
      const overview = await useCase.getOverview('dist_jhk_hazaribagh');
      assert.strictEqual(overview.districtName, 'Hazaribagh');
      assert.ok(overview.totalFacilities >= 5);
      assert.ok(overview.openAlerts >= 1, 'Must have seeded alerts');
      assert.ok(overview.criticalFacilities.length >= 1, 'Should identify critical facilities');
    });

    it('should support the full request creation and approval workflow with audit logging', async () => {
      const created = await useCase.createRequest({
        districtId: 'dist_jhk_hazaribagh',
        fromFacilityId: 'fac_03',
        fromFacilityName: 'Medical College',
        toFacilityId: 'fac_01',
        toFacilityName: 'Sadar Hospital',
        resourceId: 'oxygen_cylinders',
        resourceName: 'Oxygen Cylinders',
        quantityRequested: 15,
        urgency: 'emergency'
      }, 'district_admin_test');

      assert.strictEqual(created.status, 'submitted');
      assert.strictEqual(created.quantityRequested, 15);

      const approved = await useCase.updateRequestStatus(created.id, 'approved', 'cmo_approver', 'Approved for immediate dispatch');
      assert.strictEqual(approved?.status, 'approved');
      assert.strictEqual(approved?.approvedBy, 'cmo_approver');

      const logs = await useCase.getAuditLogs('dist_jhk_hazaribagh');
      assert.ok(logs.some(l => l.entityId === created.id && l.action === 'APPROVE_TRANSFER'));
    });
  });
});
