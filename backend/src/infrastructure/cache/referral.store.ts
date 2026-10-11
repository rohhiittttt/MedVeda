import type { Referral, ReferralStatusHistoryItem } from '../../domain/models/referral.model.ts';

export class InMemoryReferralStore {
  private referrals: Map<string, Referral> = new Map();
  private historyLogs: ReferralStatusHistoryItem[] = [];

  constructor() {
    this.seedInitialReferrals();
  }

  private seedInitialReferrals(): void {
    const seedData: Referral[] = [
      {
        id: 'ref_seed_1',
        referralId: 'REF-2026-00125',
        patientId: 'PAT-1024',
        patientName: 'Ramesh Mahto',
        patientAge: 48,
        patientSex: 'male',
        patientPhone: '+91-94311-28901',
        patientLocation: 'Katkamsandi, Hazaribagh',
        referringDoctorId: 'doc_1',
        referringDoctorName: 'Dr. Priya Sharma',
        referringFacilityId: 'fac_phc_katkamsandi',
        referringFacilityName: 'Katkamsandi Primary Health Centre',
        receivingFacilityId: 'fac_sbmch',
        receivingFacilityName: 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)',
        departmentReferredTo: 'Cardiology',
        specialty: 'Cardiology',
        reason: 'Severe exertional angina and ST depression on field ECG',
        clinicalSummary:
          '48M presenting with progressive retrosternal pain for 3 days. SBP 154/96 mmHg. Initial aspirin and nitrates administered. Referred for emergency coronary evaluation.',
        urgency: 'Emergency',
        icuPatient: true,
        currentStep: 3,
        treatingDoctor: null,
        digitalSignature: {
          doctorName: 'Dr. Priya Sharma',
          signedAt: '2026-08-31T10:20:00.000Z',
          imageOrInitialsSVG: 'P.S.'
        },
        bedAllocation: null,
        priorityRank: 1,
        status: 'BED_RESERVATION',
        createdAt: '2026-08-31T10:20:00.000Z',
        updatedAt: '2026-08-31T12:30:00.000Z',
        statusHistory: [
          {
            id: 'hist_1',
            referralId: 'REF-2026-00125',
            fromStatus: null,
            toStatus: 'REFERRAL_INITIATED',
            updatedBy: 'Dr. Priya Sharma',
            userRole: 'doctor',
            remarks: 'Initial referral generated following teleconsultation.',
            timestamp: '2026-08-31T10:20:00.000Z'
          },
          {
            id: 'hist_2',
            referralId: 'REF-2026-00125',
            fromStatus: 'REFERRAL_INITIATED',
            toStatus: 'ACCEPTED',
            updatedBy: 'SBMC&H Emergency Desk',
            userRole: 'facility',
            remarks: 'Accepted by SBMC&H Cardiology department.',
            timestamp: '2026-08-31T10:25:00.000Z'
          },
          {
            id: 'hist_3',
            referralId: 'REF-2026-00125',
            fromStatus: 'ACCEPTED',
            toStatus: 'BED_RESERVATION',
            updatedBy: 'SBMC&H Bed Coordinator',
            userRole: 'facility',
            remarks: 'Coronary Care Unit bed reserved; 108 ambulance en route.',
            timestamp: '2026-08-31T12:30:00.000Z'
          }
        ]
      },
      {
        id: 'ref_seed_2',
        referralId: 'REF-2026-00126',
        patientId: 'PAT-1056',
        patientName: 'Sunita Soren',
        patientAge: 32,
        patientSex: 'female',
        patientPhone: '+91-98350-11234',
        patientLocation: 'Barkagaon, Hazaribagh',
        referringDoctorId: 'doc_4',
        referringDoctorName: 'Dr. Kavita Murmu',
        referringFacilityId: 'fac_chc_barkagaon',
        referringFacilityName: 'Barkagaon Community Health Centre',
        receivingFacilityId: 'fac_sadar',
        receivingFacilityName: 'Sadar Hospital Hazaribagh',
        departmentReferredTo: 'Obstetrics & Gynecology',
        specialty: 'Obstetrics & Gynecology',
        reason: 'High-risk primigravida at 34 weeks with severe pre-eclampsia',
        clinicalSummary:
          'BP 160/105 mmHg, bilateral pedal edema +++, 2+ proteinuria on dipstick. Needs urgent maternal ICU monitoring.',
        urgency: 'Emergency',
        icuPatient: true,
        currentStep: 2,
        treatingDoctor: null,
        digitalSignature: {
          doctorName: 'Dr. Kavita Murmu',
          signedAt: '2026-08-31T11:00:00.000Z',
          imageOrInitialsSVG: 'K.M.'
        },
        bedAllocation: null,
        priorityRank: 1,
        status: 'ACCEPTED',
        createdAt: '2026-08-31T11:00:00.000Z',
        updatedAt: '2026-08-31T11:05:00.000Z',
        statusHistory: [
          {
            id: 'hist_4',
            referralId: 'REF-2026-00126',
            fromStatus: null,
            toStatus: 'REFERRAL_INITIATED',
            updatedBy: 'Dr. Kavita Murmu',
            userRole: 'doctor',
            remarks: 'High-risk antenatal referral created.',
            timestamp: '2026-08-31T11:00:00.000Z'
          },
          {
            id: 'hist_5',
            referralId: 'REF-2026-00126',
            fromStatus: 'REFERRAL_INITIATED',
            toStatus: 'ACCEPTED',
            updatedBy: 'Sadar Hospital Maternity Wing',
            userRole: 'facility',
            remarks: 'Accepted by Sadar Hospital Maternity Wing.',
            timestamp: '2026-08-31T11:05:00.000Z'
          }
        ]
      },
      {
        id: 'ref_seed_3',
        referralId: 'REF-2026-00127',
        patientId: 'PAT-1088',
        patientName: 'Kishore Gope',
        patientAge: 62,
        patientSex: 'male',
        patientPhone: '+91-94301-44556',
        patientLocation: 'Mandu, Ramgarh',
        referringDoctorId: 'doc_2',
        referringDoctorName: 'Dr. Rajesh Verma',
        referringFacilityId: 'fac_sadar',
        referringFacilityName: 'Sadar Hospital Hazaribagh',
        receivingFacilityId: 'fac_kalyani',
        receivingFacilityName: 'Kalyani Super Specialty Hospital & Trauma Centre',
        departmentReferredTo: 'Neurology',
        specialty: 'Neurology',
        reason: 'Ischemic stroke rehabilitation & advanced neuro-imaging evaluation',
        clinicalSummary: 'Post acute stroke day 12, recovering right hemiparesis. Referred for neuro-rehabilitation assessment.',
        urgency: 'Normal',
        icuPatient: false,
        currentStep: 7,
        treatingDoctor: null,
        digitalSignature: null,
        bedAllocation: null,
        priorityRank: 3,
        status: 'COMPLETED',
        createdAt: '2026-08-30T09:00:00.000Z',
        updatedAt: '2026-08-30T16:00:00.000Z',
        statusHistory: [
          {
            id: 'hist_6',
            referralId: 'REF-2026-00127',
            fromStatus: null,
            toStatus: 'REFERRAL_INITIATED',
            updatedBy: 'Dr. Rajesh Verma',
            userRole: 'doctor',
            remarks: 'Neuro rehab referral created.',
            timestamp: '2026-08-30T09:00:00.000Z'
          },
          {
            id: 'hist_10',
            referralId: 'REF-2026-00127',
            fromStatus: 'TREATMENT_ONGOING',
            toStatus: 'COMPLETED',
            updatedBy: 'Dr. S. K. Mukherjee (Kalyani)',
            userRole: 'facility',
            remarks: 'Neuro assessment completed. MRI Brain performed. Physical therapy initiated.',
            timestamp: '2026-08-30T16:00:00.000Z'
          }
        ]
      }
    ];

    for (const ref of seedData) {
      this.referrals.set(ref.referralId, ref);
      for (const h of ref.statusHistory) {
        this.historyLogs.push(h);
      }
    }
  }

  public save(referral: Referral): Referral {
    const history = this.getHistoryByReferralId(referral.referralId);
    const merged: Referral = {
      ...referral,
      statusHistory: history.length > 0 ? history : referral.statusHistory || []
    };
    this.referrals.set(referral.referralId, merged);
    return merged;
  }

  public findByReferralId(referralId: string): Referral | null {
    const ref = this.referrals.get(referralId);
    if (!ref) return null;
    return {
      ...ref,
      statusHistory: this.getHistoryByReferralId(referralId)
    };
  }

  public findById(id: string): Referral | null {
    for (const ref of this.referrals.values()) {
      if (ref.id === id) return this.findByReferralId(ref.referralId);
    }
    return null;
  }

  public findAll(filters?: {
    facilityId?: string;
    doctorId?: string;
    patientId?: string;
    search?: string;
  }): Referral[] {
    let list = Array.from(this.referrals.values()).map((r) => ({
      ...r,
      statusHistory: this.getHistoryByReferralId(r.referralId)
    }));
    if (filters?.facilityId) {
      list = list.filter(
        (r) => r.receivingFacilityId === filters.facilityId || r.referringFacilityId === filters.facilityId
      );
    }
    if (filters?.doctorId) {
      list = list.filter((r) => r.referringDoctorId === filters.doctorId);
    }
    if (filters?.patientId) {
      list = list.filter((r) => r.patientId === filters.patientId);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.patientName.toLowerCase().includes(q) ||
          r.referralId.toLowerCase().includes(q) ||
          r.receivingFacilityName.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public appendHistory(item: ReferralStatusHistoryItem): void {
    const exists = this.historyLogs.some((h) => h.id === item.id);
    if (!exists) {
      this.historyLogs.push(item);
    }
  }

  public getHistoryByReferralId(referralId: string): ReferralStatusHistoryItem[] {
    return this.historyLogs
      .filter((h) => h.referralId === referralId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  public getNextSequenceNumber(): number {
    return this.referrals.size + 128;
  }

  public delete(referralId: string): boolean {
    const deleted = this.referrals.delete(referralId);
    this.historyLogs = this.historyLogs.filter((h) => h.referralId !== referralId);
    return deleted;
  }
}
