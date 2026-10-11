import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryReferralStore } from '../../src/infrastructure/cache/referral.store.ts';
import { ManageReferralUseCase } from '../../src/application/use-cases/manage-referral.use-case.ts';
import { validateStatusTransition } from '../../src/domain/rules/referral-transition.rules.ts';

describe('Feature 03: Smart Referral Management System & Invariants', () => {
  it('should allow a doctor to create a referral with unique REF-2026-XXXXX identifier and initial REFERRAL_INITIATED status', async () => {
    const store = new InMemoryReferralStore();
    const useCase = new ManageReferralUseCase(store as any);

    const referral = await useCase.createReferral({
      patientId: 'PAT-2001',
      patientName: 'Geeta Devi',
      patientAge: 52,
      patientSex: 'female',
      patientLocation: 'Hazaribagh',
      referringDoctorId: 'doc_1',
      referringDoctorName: 'Dr. Priya Sharma',
      referringFacilityId: 'fac_phc_1',
      referringFacilityName: 'Katkamsandi PHC',
      receivingFacilityId: 'fac_sbmch',
      receivingFacilityName: 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)',
      specialty: 'Cardiology',
      reason: 'Unstable angina evaluation',
      clinicalSummary: 'ECG demonstrates T-wave inversion in V4-V6. Stable SBP 130/85.'
    });

    assert.ok(referral.referralId.startsWith('REF-2026-'));
    assert.equal(referral.status, 'REFERRAL_INITIATED');
    assert.equal(referral.patientName, 'Geeta Devi');
    assert.equal(referral.receivingFacilityName, 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)');
    assert.equal(referral.statusHistory.length, 1);
    assert.equal(referral.statusHistory[0].toStatus, 'REFERRAL_INITIATED');
  });

  it('should strictly enforce the valid 7-state clinical referral lifecycle', async () => {
    const store = new InMemoryReferralStore();
    const useCase = new ManageReferralUseCase(store as any);

    const referral = await useCase.createReferral({
      patientId: 'PAT-2002',
      patientName: 'Bablu Singh',
      patientAge: 35,
      patientSex: 'male',
      patientLocation: 'Ramgarh',
      referringDoctorId: 'doc_2',
      referringDoctorName: 'Dr. Rajesh Verma',
      referringFacilityId: 'fac_sadar',
      referringFacilityName: 'Sadar Hospital Hazaribagh',
      receivingFacilityId: 'fac_kalyani',
      receivingFacilityName: 'Kalyani Super Specialty Hospital & Trauma Centre',
      specialty: 'Neurology',
      reason: 'Post-trauma concussion workup',
      clinicalSummary: 'Mild headache following low velocity fall. GCS 15/15.'
    });

    // 1. Receiving facility accepts referral: REFERRAL_INITIATED -> ACCEPTED
    const step1 = await useCase.updateReferralStatus(referral.referralId, {
      toStatus: 'ACCEPTED',
      updatedBy: 'Kalyani Emergency Desk',
      userRole: 'facility',
      remarks: 'Referral accepted by Kalyani Trauma Centre.'
    });
    assert.equal(step1.status, 'ACCEPTED');

    // 2. Receiving facility reserves bed: ACCEPTED -> BED_RESERVATION
    const step2 = await useCase.updateReferralStatus(referral.referralId, {
      toStatus: 'BED_RESERVATION',
      updatedBy: 'Kalyani Bed Coordinator',
      userRole: 'facility',
      remarks: 'Trauma Ward bed reserved.'
    });
    assert.equal(step2.status, 'BED_RESERVATION');

    // 3. Patient arrives at facility: BED_RESERVATION -> PATIENT_ARRIVAL
    const step3 = await useCase.updateReferralStatus(referral.referralId, {
      toStatus: 'PATIENT_ARRIVAL',
      updatedBy: 'Kalyani Reception Desk',
      userRole: 'facility',
      remarks: 'Patient safely arrived at Kalyani reception desk.'
    });
    assert.equal(step3.status, 'PATIENT_ARRIVAL');

    // 4. Bed allotted: PATIENT_ARRIVAL -> BED_ALLOTTED
    const step4 = await useCase.updateReferralStatus(referral.referralId, {
      toStatus: 'BED_ALLOTTED',
      updatedBy: 'Kalyani Ward Nurse',
      userRole: 'facility',
      remarks: 'Patient admitted to Neuro-Trauma Bed #4.'
    });
    assert.equal(step4.status, 'BED_ALLOTTED');

    // 5. Treatment ongoing: BED_ALLOTTED -> TREATMENT_ONGOING
    const step5 = await useCase.updateReferralStatus(referral.referralId, {
      toStatus: 'TREATMENT_ONGOING',
      updatedBy: 'Dr. S. K. Mukherjee',
      userRole: 'facility',
      remarks: 'CT Head and neuro observation initiated.'
    });
    assert.equal(step5.status, 'TREATMENT_ONGOING');

    // 6. Completed: TREATMENT_ONGOING -> COMPLETED
    const step6 = await useCase.updateReferralStatus(referral.referralId, {
      toStatus: 'COMPLETED',
      updatedBy: 'Dr. S. K. Mukherjee',
      userRole: 'facility',
      remarks: 'Neuro evaluation and CT head negative. Patient discharged with analgesics.'
    });
    assert.equal(step6.status, 'COMPLETED');
    assert.equal(step6.statusHistory.length, 7);
  });

  it('should strictly reject illegal transitions (e.g. REFERRAL_INITIATED directly to COMPLETED or unauthorized role transitions)', () => {
    // Cannot jump REFERRAL_INITIATED -> COMPLETED
    const res1 = validateStatusTransition('REFERRAL_INITIATED', 'COMPLETED', 'facility');
    assert.equal(res1.isValid, false);
    assert.ok(res1.error?.includes("Cannot transition from 'REFERRAL_INITIATED' directly to 'COMPLETED'"));

    // Patient cannot update status to COMPLETED
    const res2 = validateStatusTransition('TREATMENT_ONGOING', 'COMPLETED', 'patient');
    assert.equal(res2.isValid, false);
    assert.ok(res2.error?.includes("Role 'patient' is not authorized"));

    // Completed is terminal
    const res3 = validateStatusTransition('COMPLETED', 'ACCEPTED', 'facility');
    assert.equal(res3.isValid, false);
  });

  it('should support rejection from REFERRAL_INITIATED state by doctor or facility', () => {
    const res1 = validateStatusTransition('REFERRAL_INITIATED', 'REJECTED', 'doctor');
    assert.equal(res1.isValid, true);

    const res2 = validateStatusTransition('REFERRAL_INITIATED', 'REJECTED', 'facility');
    assert.equal(res2.isValid, true);

    const res3 = validateStatusTransition('COMPLETED', 'REJECTED', 'doctor');
    assert.equal(res3.isValid, false);
  });

  it('should retrieve pending referrals for frontline worker follow-up and retain audit history', async () => {
    const store = new InMemoryReferralStore();
    const useCase = new ManageReferralUseCase(store as any);

    const pending = await useCase.getPendingReferrals();
    assert.ok(pending.length >= 2);

    const history = await useCase.getHistory('REF-2026-00125');
    assert.ok(history.length >= 3);
    assert.equal(history[0].toStatus, 'REFERRAL_INITIATED');
    assert.equal(history[1].toStatus, 'ACCEPTED');
    assert.equal(history[2].toStatus, 'BED_RESERVATION');

    const stats = await useCase.getStats();
    assert.ok(stats.total >= 3);
    assert.ok(stats.completed >= 1);
  });

  it('should support deleting a referral and clean up associated history logs', async () => {
    const store = new InMemoryReferralStore();
    const useCase = new ManageReferralUseCase(store as any);

    const ref = await useCase.getReferral('REF-2026-00125');
    assert.ok(ref !== null);

    const deleted = await useCase.deleteReferral('REF-2026-00125');
    assert.equal(deleted, true);

    const check = await useCase.getReferral('REF-2026-00125');
    assert.equal(check, null);

    const history = await useCase.getHistory('REF-2026-00125');
    assert.equal(history.length, 0);
  });
});
