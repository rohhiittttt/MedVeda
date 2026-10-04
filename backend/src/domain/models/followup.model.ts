export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type RiskTrend = 'IMPROVING' | 'STABLE' | 'WORSENING';

export type TaskStatus = 'UPCOMING' | 'DUE' | 'COMPLETED';

export type PlanStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export type AdherenceLevel = 'FULL' | 'PARTIAL' | 'NONE';

export type SymptomProgression = 'IMPROVED' | 'UNCHANGED' | 'WORSENED';

export interface BloodPressure {
  readonly systolic: number;
  readonly diastolic: number;
}

export interface PrescribedMedication {
  readonly id: string;
  readonly name: string;
  readonly dosage: string;
  readonly frequency: string;
  readonly timing?: string;
  readonly instructions?: string;
  readonly adherenceStatus?: 'TAKEN' | 'MISSED' | 'PENDING';
}

export interface FollowUpPlan {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly patientAge: number;
  readonly patientSex: 'female' | 'male' | 'other';
  readonly patientPhone?: string;
  readonly patientLocation: string;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly frontlineWorkerId: string;
  readonly frontlineWorkerName: string;
  readonly frequencyDays: number; // e.g. 7 for every 7 days
  readonly frequencyLabel: string; // e.g. "Every 7 days"
  readonly startDate: string;
  readonly endDate?: string;
  readonly instructions: string;
  readonly requiredObservations: readonly string[]; // e.g. ['blood_pressure', 'medication_adherence', 'symptoms', 'general_condition']
  readonly currentMedications?: readonly PrescribedMedication[];
  readonly status: PlanStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FollowUpTask {
  readonly id: string;
  readonly planId: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly frontlineWorkerId: string;
  readonly frontlineWorkerName: string;
  readonly taskIndex: number; // e.g. 1, 2, 3
  readonly dueDate: string;
  readonly status: TaskStatus;
  readonly completedAt?: string;
  readonly reportId?: string;
}

export interface FollowUpReport {
  readonly id: string;
  readonly taskId: string;
  readonly planId: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly frontlineWorkerId: string;
  readonly frontlineWorkerName: string;
  readonly followUpNumber: number;
  readonly bloodPressure?: BloodPressure;
  readonly medicationAdherence: AdherenceLevel;
  readonly symptomProgression: SymptomProgression;
  readonly generalCondition: string;
  readonly observationsText: string;
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly riskReason: string;
  readonly submittedAt: string;
}

export interface RiskHistoryItem {
  readonly id: string;
  readonly patientId: string;
  readonly reportId?: string;
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly trend: RiskTrend;
  readonly reason: string;
  readonly createdAt: string;
}

export interface FacilityAlert {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly triggerReason: string;
  readonly latestObservations: string;
  readonly assignedDoctorName: string;
  readonly assignedWorkerName: string;
  readonly status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  readonly createdAt: string;
  readonly acknowledgedAt?: string;
}

export interface CreatePlanDto {
  readonly patientId: string;
  readonly patientName: string;
  readonly patientAge: number;
  readonly patientSex: 'female' | 'male' | 'other';
  readonly patientPhone?: string;
  readonly patientLocation: string;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly frontlineWorkerId: string;
  readonly frontlineWorkerName: string;
  readonly frequencyDays: number;
  readonly frequencyLabel?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly instructions: string;
  readonly requiredObservations?: readonly string[];
  readonly currentMedications?: readonly PrescribedMedication[];
}

export interface SubmitReportDto {
  readonly taskId: string;
  readonly bloodPressure?: BloodPressure;
  readonly medicationAdherence: AdherenceLevel;
  readonly symptomProgression: SymptomProgression;
  readonly generalCondition: string;
  readonly observationsText?: string;
}
