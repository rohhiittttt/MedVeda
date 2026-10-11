// ==========================================
// Feature Map 05: Interoperable Health Records Unit Tests
// ==========================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ManageRecordsUseCase } from '../../src/application/use-cases/manage-records.use-case.ts';
import { InMemoryRecordsStore } from '../../src/infrastructure/cache/records.store.ts';
import { parseOcrDocumentText } from '../../src/domain/rules/ocr-parser.rules.ts';
import { evaluateRecordAccess } from '../../src/domain/rules/consent-access.rules.ts';

describe('Feature 05: Interoperable Health Records & Multi-Source Timeline Aggregation', () => {
  it('should register a patient with internal_medical_id as primary anchor without requiring ABHA ID', async () => {
    const store = new InMemoryRecordsStore();
    const useCase = new ManageRecordsUseCase(store);

    const patient = await useCase.registerPatient({
      name: 'Babulal Marandi',
      age: 62,
      sex: 'male',
      phone: '+91-94301-88123',
      location: 'Chauparan, Hazaribagh',
      bloodGroup: 'A+'
    });

    assert.ok(patient.internalMedicalId.startsWith('MV-MED-'));
    assert.strictEqual(patient.name, 'Babulal Marandi');
    assert.strictEqual(patient.abhaId, null);
  });

  it('should allow linking an ABHA ID to an existing patient record', async () => {
    const store = new InMemoryRecordsStore();
    const useCase = new ManageRecordsUseCase(store);

    const patient = await useCase.registerPatient({
      name: 'Geeta Kumari',
      age: 28,
      sex: 'female',
      phone: '+91-98351-99881',
      location: 'Katkamsandi, Hazaribagh'
    });

    const updated = await useCase.linkAbhaId(patient.internalMedicalId, 'geeta.kumari@abdm');
    assert.strictEqual(updated.abhaId, 'geeta.kumari@abdm');
  });

  it('should parse raw OCR text into structured prescription fields with confidence rating', () => {
    const rawPrescriptionText = `
      DR. A. K. VERMA, MD (CARDIOLOGY)
      HEART CARE CLINIC, HAZARIBAGH
      Date: 15/07/2026
      Rx:
      Tab. Telmisartan 40mg 1-0-0 30 days
      Tab. Atorvastatin 20mg 0-0-1 30 days
      Diagnosis: Primary Hypertension
    `;

    const parsed = parseOcrDocumentText(rawPrescriptionText, 'prescription');
    const rxData = parsed.data as any;
    assert.strictEqual(parsed.confidenceScore >= 70, true);
    assert.ok(rxData.medicines.length >= 1);
    assert.ok(rxData.doctorName?.includes('VERMA'));
  });

  it('should capture manual record and tag verificationStatus based on user confirmation', async () => {
    const store = new InMemoryRecordsStore();
    const useCase = new ManageRecordsUseCase(store);

    const verifiedRecord = await useCase.captureManualRecord({
      internalMedicalId: 'MV-MED-2026-1024',
      recordType: 'prescription',
      title: 'Outpatient Prescription (Camera Upload)',
      rawText: 'Tab. Paracetamol 500mg TDS for 5 days',
      isVerifiedByUser: true,
      verifiedBy: 'Verified by Patient'
    });

    assert.strictEqual(verifiedRecord.verificationStatus, 'verified');
    assert.strictEqual(verifiedRecord.source, 'manual');
    assert.strictEqual(verifiedRecord.verifiedBy, 'Verified by Patient');

    const unverifiedRecord = await useCase.captureManualRecord({
      internalMedicalId: 'MV-MED-2026-1024',
      recordType: 'lab_report',
      title: 'Unconfirmed Lab Scan',
      rawText: 'Total Cholesterol 240 mg/dL',
      isVerifiedByUser: false
    });

    assert.strictEqual(unverifiedRecord.verificationStatus, 'unverified');
    assert.strictEqual(unverifiedRecord.verifiedBy, undefined);
  });

  it('should aggregate records from all 4 sources (Manual, ABHA, Internal, CoWIN) into Unified Timeline', async () => {
    const store = new InMemoryRecordsStore();
    const useCase = new ManageRecordsUseCase(store);

    const timeline = await useCase.getUnifiedTimeline('MV-MED-2026-1024', {
      requesterId: 'self',
      requesterRole: 'patient'
    });

    assert.strictEqual(timeline.patient.name, 'Ramesh Mahto');
    assert.strictEqual(timeline.accessInfo.isAllowed, true);

    const sources = new Set(timeline.records.map((r) => r.source));
    assert.ok(sources.has('manual'), 'Should include manual OCR records');
    assert.ok(sources.has('abha'), 'Should include ABHA sandbox records');
    assert.ok(sources.has('medveda_internal'), 'Should include internal triage/EMR/follow-up records');
    assert.ok(sources.has('cowin'), 'Should include CoWIN vaccine records');
  });

  it('should enforce consent-gated access control for doctors and deny unauthorized record access', async () => {
    const store = new InMemoryRecordsStore();
    const useCase = new ManageRecordsUseCase(store);

    // Dr. Unknown attempts to access without consent
    const unauthorized = await useCase.getUnifiedTimeline('MV-MED-2026-1024', {
      requesterId: 'doc_unknown',
      requesterRole: 'doctor'
    });

    assert.strictEqual(unauthorized.accessInfo.isAllowed, false);
    assert.strictEqual(unauthorized.records.length, 0);
    assert.ok(unauthorized.accessInfo.reason.includes('Access Denied'));

    // Dr. Priya Sharma has approved consent cns_demo_01
    const authorized = await useCase.getUnifiedTimeline('MV-MED-2026-1024', {
      requesterId: 'doc_1',
      requesterRole: 'doctor'
    });

    assert.strictEqual(authorized.accessInfo.isAllowed, true);
    assert.ok(authorized.records.length > 0);
  });

  it('should allow Emergency Access Override with mandatory clinical justification and immutable audit logging', async () => {
    const store = new InMemoryRecordsStore();
    const useCase = new ManageRecordsUseCase(store);

    const overrideLog = await useCase.executeEmergencyOverride('MV-MED-2026-1024', {
      id: 'doc_er_99',
      name: 'Dr. Emergency In-Charge',
      role: 'emergency_officer',
      facilityName: 'District Trauma ICU',
      clinicalReason: 'Unconscious patient brought to ER with suspected massive myocardial infarction. Immediate allergy and EMR review required.'
    });

    assert.ok(overrideLog.id.startsWith('emg_log_'));
    assert.strictEqual(overrideLog.accessedBy, 'doc_er_99');

    // Access evaluation in emergency mode
    const emergencyTimeline = await useCase.getUnifiedTimeline('MV-MED-2026-1024', {
      requesterId: 'doc_er_99',
      requesterRole: 'doctor',
      isEmergencyOverride: true,
      emergencyReason: overrideLog.clinicalReason
    });

    assert.strictEqual(emergencyTimeline.accessInfo.isAllowed, true);
    assert.strictEqual(emergencyTimeline.accessInfo.isEmergencyOverride, true);
    assert.ok(emergencyTimeline.accessInfo.reason.includes('Emergency access override granted'));
  });
});
