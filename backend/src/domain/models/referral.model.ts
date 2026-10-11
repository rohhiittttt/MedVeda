export type ReferralStatus =
  | 'REFERRAL_INITIATED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'BED_RESERVATION'
  | 'PATIENT_ARRIVAL'
  | 'BED_ALLOTTED'
  | 'TREATMENT_ONGOING'
  | 'COMPLETED';

export type UserRole = 'doctor' | 'facility' | 'patient' | 'admin';

export interface ReferralStatusHistoryItem {
  readonly id: string;
  readonly referralId: string;
  readonly fromStatus: ReferralStatus | null;
  readonly toStatus: ReferralStatus;
  readonly updatedBy: string;
  readonly userRole: UserRole;
  readonly remarks: string;
  readonly timestamp: string;
}

export interface Referral {
  readonly id: string;
  readonly referralId: string; // e.g. REF-2026-00125
  readonly patientId: string;
  readonly patientName: string;
  readonly patientAge: number;
  readonly patientSex: 'female' | 'male' | 'other';
  readonly patientPhone?: string;
  readonly patientLocation: string;
  readonly referringDoctorId: string;
  readonly referringDoctorName: string;
  readonly referringFacilityId: string;
  readonly referringFacilityName: string;
  readonly receivingFacilityId: string;
  readonly receivingFacilityName: string;
  readonly departmentReferredTo: string;
  readonly specialty: string;
  readonly reason: string;
  readonly clinicalSummary: string;
  readonly urgency: 'Emergency' | 'Urgent' | 'Normal';
  readonly icuPatient: boolean;
  readonly currentStep: number;
  readonly treatingDoctor: { id: string; name: string; specialty: string } | null;
  readonly digitalSignature: { doctorName: string; signedAt: string; imageOrInitialsSVG: string } | null;
  readonly bedAllocation: { bedId: string; ward: string; reservedAt: string; allottedAt: string | null } | null;
  readonly priorityRank: number;
  readonly status: ReferralStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly statusHistory: readonly ReferralStatusHistoryItem[];
}

export interface CreateReferralDto {
  readonly patientId: string;
  readonly patientName: string;
  readonly patientAge: number;
  readonly patientSex: 'female' | 'male' | 'other';
  readonly patientPhone?: string;
  readonly patientLocation: string;
  readonly referringDoctorId: string;
  readonly referringDoctorName: string;
  readonly referringFacilityId: string;
  readonly referringFacilityName: string;
  readonly receivingFacilityId: string;
  readonly receivingFacilityName: string;
  readonly departmentReferredTo?: string;
  readonly specialty: string;
  readonly reason: string;
  readonly clinicalSummary: string;
  readonly urgency?: 'Emergency' | 'Urgent' | 'Normal';
  readonly icuPatient?: boolean;
  readonly digitalSignature?: { doctorName: string; signedAt: string; imageOrInitialsSVG: string } | null;
}

export interface UpdateReferralStatusDto {
  readonly toStatus: ReferralStatus;
  readonly updatedBy: string;
  readonly userRole: UserRole;
  readonly remarks?: string;
  readonly treatingDoctor?: { id: string; name: string; specialty: string } | null;
  readonly bedAllocation?: { bedId: string; ward: string; reservedAt: string; allottedAt: string | null } | null;
  readonly currentStep?: number;
}
