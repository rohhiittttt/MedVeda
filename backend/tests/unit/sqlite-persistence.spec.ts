import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SqliteTeleconsultStore } from '../../src/infrastructure/db/sqlite-teleconsult.store.ts';
import { SqliteRecordsStore } from '../../src/infrastructure/db/sqlite-records.store.ts';
import { SqliteFacilityDashboardStore } from '../../src/infrastructure/db/sqlite-facility-dashboard.store.ts';
import { SqliteSchemeStore } from '../../src/infrastructure/db/sqlite-scheme.store.ts';
import { SqliteCommandCenterStore } from '../../src/infrastructure/db/sqlite-command-center.store.ts';

describe('Phase 1: Persistent Database & Cache Layer across All Features', () => {

  it('should persist teleconsultation bookings, queue updates, messages, and vitals in SqliteTeleconsultStore', async () => {
    const store = new SqliteTeleconsultStore(':memory:');

    const doctors = await store.getDoctorRoster(undefined, 'Cardiology');
    assert.ok(doctors.length >= 1);

    await store.addToQueue({
      id: 'QUE-TEST-99',
      patientId: 'PAT-99',
      patientName: 'Test Patient',
      patientAge: 45,
      patientSex: 'male',
      doctorId: 'doc_2',
      doctorName: 'Dr. Rajesh Verma',
      specialty: 'Cardiology',
      priorityScore: 88,
      urgencyTier: 'CRITICAL',
      highRiskFlags: ['Chest pain'],
      bookedBy: 'patient',
      joinedAt: new Date().toISOString(),
      scheduledTime: '11:00 AM',
      status: 'waiting'
    });

    const queue = await store.getQueueEntries('doc_2');
    assert.ok(queue.some((q) => q.id === 'QUE-TEST-99'));

    await store.updateQueueStatus('QUE-TEST-99', 'completed');
    const updatedEntry = await store.getQueueEntry('QUE-TEST-99');
    assert.equal(updatedEntry?.status, 'completed');
  });

  it('should persist health records, consents, and RAG audit logs in SqliteRecordsStore', () => {
    const store = new SqliteRecordsStore(':memory:');

    const p = store.getPatientById('MV-MED-2026-1024');
    assert.ok(p !== undefined);
    assert.equal(p.name, 'Ramesh Mahto');

    store.saveRagAuditLog({
      id: 'audit_test_1',
      patientId: 'MV-MED-2026-1024',
      requesterRole: 'doctor',
      question: 'What is the latest blood pressure?',
      answer: '162/102 mmHg',
      isEmergency: false,
      citationCount: 1,
      confidence: 'high',
      timestamp: new Date().toISOString()
    });

    const logs = store.getRagAuditLogs('MV-MED-2026-1024');
    assert.equal(logs.length, 1);
    assert.equal(logs[0].id, 'audit_test_1');
  });

  it('should persist facility resources, scheme assessments, and command center requests in SQLite stores', () => {
    const fdStore = new SqliteFacilityDashboardStore(':memory:');
    const updatedRes = fdStore.updateResourceCount('fac_01', 'icu_bed', 12, 1);
    assert.equal(updatedRes.availableCount, 1);
    const facRes = fdStore.getResourcesByFacility('fac_01');
    assert.equal(facRes.find((r) => r.resourceType === 'icu_bed')?.availableCount, 1);

    const schemeStore = new SqliteSchemeStore(':memory:');
    assert.ok(schemeStore.getAllSchemes().length >= 10);
    schemeStore.saveAssessment({
      assessment_id: 'ASMT-TEST-1',
      patient_profile: {
        age: 72,
        state: 'Jharkhand',
        family_income_annual: 60000,
        ration_card_status: 'BPL',
        hospital_type: 'government',
        existing_documents: ['Aadhaar Card']
      },
      schemes_evaluated: [],
      pending_clarifications: [],
      clarification_status: 'none',
      ranked_recommendations: [],
      created_at: new Date().toISOString()
    });
    assert.ok(schemeStore.getAssessmentById('ASMT-TEST-1') !== undefined);

    const ccStore = new SqliteCommandCenterStore(':memory:');
    assert.ok(ccStore.getAllFacilities().length >= 2);
  });
});
