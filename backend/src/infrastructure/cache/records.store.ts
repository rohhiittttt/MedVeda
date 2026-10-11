// ==========================================
// Feature Map 05: In-Memory Health Records Repository Store
// ==========================================

import type {
  PatientProfile,
  HealthRecordItem,
  ConsentRequest,
  EmergencyOverrideLog
} from '../../domain/models/records.model.ts';

export class InMemoryRecordsStore {
  private patients: Map<string, PatientProfile> = new Map();
  private records: Map<string, HealthRecordItem> = new Map();
  private consents: Map<string, ConsentRequest> = new Map();
  private emergencyLogs: EmergencyOverrideLog[] = [];

  constructor() {
    this.seedInitialData();
  }

  // --- Patients ---
  savePatient(patient: PatientProfile): PatientProfile {
    this.patients.set(patient.internalMedicalId, patient);
    return patient;
  }

  getPatientById(id: string): PatientProfile | undefined {
    // Search by internalMedicalId or alias/ID
    if (this.patients.has(id)) return this.patients.get(id);
    for (const p of this.patients.values()) {
      if (p.internalMedicalId === id || p.internalMedicalId.includes(id) || (p.abhaId && p.abhaId === id)) {
        return p;
      }
    }
    return undefined;
  }

  getAllPatients(): PatientProfile[] {
    return Array.from(this.patients.values());
  }

  linkAbhaId(internalMedicalId: string, abhaId: string): PatientProfile | undefined {
    const patient = this.getPatientById(internalMedicalId);
    if (!patient) return undefined;
    patient.abhaId = abhaId;
    this.patients.set(patient.internalMedicalId, patient);
    return patient;
  }

  // --- Records ---
  saveRecord(record: HealthRecordItem): HealthRecordItem {
    this.records.set(record.id, record);
    return record;
  }

  getRecordsByMedicalId(internalMedicalId: string): HealthRecordItem[] {
    const patient = this.getPatientById(internalMedicalId);
    const targetId = patient ? patient.internalMedicalId : internalMedicalId;

    const list: HealthRecordItem[] = [];
    for (const r of this.records.values()) {
      if (r.internalMedicalId === targetId || r.internalMedicalId === internalMedicalId) {
        list.push(r);
      }
    }
    // Sort chronologically descending
    return list.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  getRecordById(recordId: string): HealthRecordItem | undefined {
    return this.records.get(recordId);
  }

  // --- Consents ---
  saveConsent(consent: ConsentRequest): ConsentRequest {
    this.consents.set(consent.consentId, consent);
    return consent;
  }

  getConsentById(consentId: string): ConsentRequest | undefined {
    return this.consents.get(consentId);
  }

  getConsentsByMedicalId(internalMedicalId: string): ConsentRequest[] {
    const patient = this.getPatientById(internalMedicalId);
    const targetId = patient ? patient.internalMedicalId : internalMedicalId;

    const list: ConsentRequest[] = [];
    for (const c of this.consents.values()) {
      if (c.internalMedicalId === targetId || c.internalMedicalId === internalMedicalId) {
        list.push(c);
      }
    }
    return list;
  }

  getAllConsents(): ConsentRequest[] {
    return Array.from(this.consents.values());
  }

  // --- Emergency Override Audit ---
  logEmergencyOverride(log: EmergencyOverrideLog): EmergencyOverrideLog {
    this.emergencyLogs.push(log);
    return log;
  }

  getEmergencyLogs(internalMedicalId?: string): EmergencyOverrideLog[] {
    if (!internalMedicalId) return this.emergencyLogs;
    return this.emergencyLogs.filter((l) => l.internalMedicalId === internalMedicalId);
  }

  private seedInitialData() {
    // 1. Patient 1: Ramesh Mahto (Has Linked ABHA)
    const p1: PatientProfile = {
      internalMedicalId: 'MV-MED-2026-1024',
      abhaId: '91-2890-1423-8891@sbx',
      name: 'Ramesh Mahto',
      age: 48,
      sex: 'male',
      phone: '+91-94311-28901',
      location: 'Katkamsandi, Hazaribagh',
      bloodGroup: 'O+',
      emergencyContact: {
        name: 'Anita Devi (Spouse)',
        relation: 'Spouse',
        phone: '+91-94311-28902'
      },
      createdAt: '2026-08-01T08:00:00.000Z'
    };
    this.savePatient(p1);

    // 2. Patient 2: Sunita Soren (No ABHA - Pure Standalone)
    const p2: PatientProfile = {
      internalMedicalId: 'MV-MED-2026-2048',
      abhaId: null,
      name: 'Sunita Soren',
      age: 32,
      sex: 'female',
      phone: '+91-98352-19203',
      location: 'Barkagaon, Hazaribagh',
      bloodGroup: 'B+',
      emergencyContact: {
        name: 'Mangal Soren (Brother)',
        relation: 'Brother',
        phone: '+91-98352-19204'
      },
      createdAt: '2026-08-15T10:00:00.000Z'
    };
    this.savePatient(p2);

    // --- Records for Ramesh Mahto ---
    // A. Manual OCR Record: Prior Physical Prescription
    this.saveRecord({
      id: 'rec_man_101',
      internalMedicalId: 'MV-MED-2026-1024',
      source: 'manual',
      recordType: 'prescription',
      title: 'Physical Outpatient Prescription (Camera OCR)',
      summary: 'Handwritten prescription captured via ASHA camera and confirmed by patient.',
      facilityName: 'Dr. Verma Heart Clinic, Hazaribagh',
      doctorName: 'Dr. A. K. Verma (Cardiologist)',
      recordedAt: '2026-07-15T11:00:00.000Z',
      verificationStatus: 'verified',
      verifiedBy: 'Verified by Patient & ASHA Anita Devi',
      extractedData: {
        medicines: [
          { name: 'Telmisartan 40mg', dosage: '40mg', frequency: '1-0-0 (Morning)', duration: '30 days', instructions: 'After breakfast' },
          { name: 'Amlodipine 5mg', dosage: '5mg', frequency: '0-0-1 (Night)', duration: '30 days', instructions: 'Before bedtime' }
        ],
        diagnosis: 'Essential Hypertension Grade 2',
        doctorName: 'Dr. A. K. Verma',
        facilityName: 'Dr. Verma Heart Clinic',
        date: '2026-07-15'
      }
    });

    // B. ABHA Sandbox Record: Lipid Profile
    this.saveRecord({
      id: 'rec_abha_102',
      internalMedicalId: 'MV-MED-2026-1024',
      source: 'abha',
      recordType: 'lab_report',
      title: 'Lipid Profile & Serum Electrolytes (ABDM FHIR Bundle)',
      summary: 'HIP Diagnostic Report pulled from ABDM Sandbox Gateway (Apollo Diagnostics).',
      facilityName: 'Apollo Diagnostics & Health Grid (HIP-0842)',
      doctorName: 'Dr. S. K. Roy (Pathologist)',
      recordedAt: '2026-07-03T09:30:00.000Z',
      verificationStatus: 'hip_verified',
      verifiedBy: 'ABDM Sandbox HIP Digital Signature',
      extractedData: {
        testName: 'Lipid Profile & Serum Electrolytes',
        results: [
          { parameter: 'TOTAL CHOLESTEROL', observedValue: '210', unit: 'mg/dL', referenceRange: '125 - 200', isAbnormal: true },
          { parameter: 'HDL CHOLESTEROL', observedValue: '42', unit: 'mg/dL', referenceRange: '40 - 60', isAbnormal: false },
          { parameter: 'LDL CHOLESTEROL', observedValue: '138', unit: 'mg/dL', referenceRange: '0 - 100', isAbnormal: true }
        ],
        labName: 'Apollo Diagnostics & Health Grid',
        date: '2026-07-03'
      }
    });

    // C. CoWIN Government Scheme Record: Vaccination
    this.saveRecord({
      id: 'rec_cowin_103',
      internalMedicalId: 'MV-MED-2026-1024',
      source: 'cowin',
      recordType: 'vaccination',
      title: 'COVID-19 Vaccination Certificate (CoWIN API)',
      summary: 'Government-verified digital vaccination certificate with batch authenticity check.',
      facilityName: 'District Sadar Hospital Vaccination Centre, Hazaribagh',
      recordedAt: '2025-11-20T10:15:00.000Z',
      verificationStatus: 'govt_sourced',
      verifiedBy: 'Government of India (CoWIN Trust Gateway)',
      extractedData: {
        beneficiaryId: 'COW-JH-9431128901',
        vaccine: 'COVAXIN (Inactivated SARS-CoV-2)',
        doseNumber: 2,
        totalDoses: 2,
        dateOfDose: '2025-11-20',
        vaccinationCenter: 'District Sadar Hospital Vaccination Centre',
        administeredBy: 'ANM Meena Kumari',
        certificateNumber: 'COW-JH-2025-884920'
      }
    });

    // D. MedVeda Internal Record: Emergency Triage Assessment
    this.saveRecord({
      id: 'rec_int_104',
      internalMedicalId: 'MV-MED-2026-1024',
      source: 'medveda_internal',
      recordType: 'triage_assessment',
      title: 'Autonomous Clinical Triage: Acute Coronary Syndrome',
      summary: 'Emergency red-flag screening identifying crushing chest pain radiating to left arm.',
      facilityName: 'MedVeda Smart Care Navigator',
      doctorName: 'Autonomous Clinical Engine (Validated by Dr. Priya Sharma)',
      recordedAt: '2026-08-01T06:15:00.000Z',
      verificationStatus: 'clinician_signed',
      verifiedBy: 'MedVeda Clinical Invariant System',
      extractedData: {
        urgency: 'EMERGENCY',
        primarySymptom: 'Crushing sub-sternal chest pain with diaphoresis',
        redFlagsTriggered: ['Chest Pain > 15 mins with Left Arm Radiation', 'Dyspnea at rest'],
        recommendedHospital: 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)'
      }
    });

    // D2. MedVeda Internal Record: EMR Teleconsult Prescription
    this.saveRecord({
      id: 'rec_int_105',
      internalMedicalId: 'MV-MED-2026-1024',
      source: 'medveda_internal',
      recordType: 'teleconsult_prescription',
      title: 'Digital EMR Prescription & Care Plan (Teleconsult F02)',
      summary: 'Post-consultation prescription and vitals reliability verification signed by specialist.',
      facilityName: 'SBMC&H Telemedicine Command',
      doctorName: 'Dr. Priya Sharma (MD, DM Cardiology)',
      recordedAt: '2026-08-10T11:45:00.000Z',
      verificationStatus: 'clinician_signed',
      verifiedBy: 'Dr. Priya Sharma (NMC Reg: 74892)',
      extractedData: {
        medicines: [
          { name: 'Ecosprin 75mg', dosage: '75mg', frequency: '1-0-0', duration: '90 days' },
          { name: 'Brilinta 90mg', dosage: '90mg', frequency: '1-0-1', duration: '90 days' },
          { name: 'Rosuvas 20mg', dosage: '20mg', frequency: '0-0-1', duration: '90 days' }
        ],
        diagnosis: 'Post-PCI Secondary Prevention & Stable Angina',
        doctorName: 'Dr. Priya Sharma',
        facilityName: 'SBMC&H Telemedicine Command',
        date: '2026-08-10'
      }
    });

    // D3. MedVeda Internal Record: ASHA High-Risk Follow-Up Report
    this.saveRecord({
      id: 'rec_int_106',
      internalMedicalId: 'MV-MED-2026-1024',
      source: 'medveda_internal',
      recordType: 'followup_report',
      title: 'ASHA Ground Follow-Up & Dynamic Risk Score: 78 (HIGH)',
      summary: 'Longitudinal home assessment: Elevated BP 162/102 mmHg and partial adherence triggered facility escalation.',
      facilityName: 'Katkamsandi Rural Health Sub-Centre',
      doctorName: 'Supervised by Dr. Priya Sharma',
      recordedAt: '2026-08-24T12:00:00.000Z',
      verificationStatus: 'verified',
      verifiedBy: 'ASHA Anita Devi (Field Worker #014)',
      extractedData: {
        bloodPressure: '162/102 mmHg',
        medicationAdherence: 'PARTIAL',
        symptomProgression: 'WORSENED',
        dynamicRiskScore: 78,
        riskLevel: 'HIGH',
        facilityAlertDispatched: true
      }
    });

    // --- Consents ---
    this.saveConsent({
      consentId: 'cns_demo_01',
      internalMedicalId: 'MV-MED-2026-1024',
      requestedBy: 'doc_1',
      requesterName: 'Dr. Priya Sharma',
      requesterRole: 'doctor',
      purpose: 'Cardiology Longitudinal Follow-Up & EMR Review',
      scope: 'ALL',
      status: 'approved',
      createdAt: '2026-08-20T08:00:00.000Z',
      expiresAt: '2027-09-20T08:00:00.000Z',
      grantedAt: '2026-08-20T08:05:00.000Z'
    });

    this.saveConsent({
      consentId: 'cns_demo_02',
      internalMedicalId: 'MV-MED-2026-1024',
      requestedBy: 'doc_4',
      requesterName: 'Dr. Rajesh Khanna',
      requesterRole: 'doctor',
      purpose: 'Endocrinology Consultation & Diabetes Review',
      scope: 'LAB_REPORTS',
      status: 'pending',
      createdAt: '2026-09-02T10:00:00.000Z',
      expiresAt: '2027-09-09T10:00:00.000Z'
    });
  }

  private ragAuditLogs: any[] = [];

  saveRagAuditLog(item: any): any {
    this.ragAuditLogs.unshift(item);
    return item;
  }

  getRagAuditLogs(patientId?: string, limit = 50): any[] {
    if (patientId) {
      return this.ragAuditLogs.filter((a) => a.patientId === patientId).slice(0, limit);
    }
    return this.ragAuditLogs.slice(0, limit);
  }
}
