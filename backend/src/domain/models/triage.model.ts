export type UrgencyLevel = 'CRITICAL' | 'URGENT' | 'NON_URGENT';

export interface RedFlagChecklist {
  readonly facialDroopOrSpeech: boolean;
  readonly chestPain: boolean;
  readonly breathingDistress: boolean;
  readonly unconsciousOrConfusion: boolean;
  readonly severeBleeding: boolean;
}

export interface PatientVitals {
  readonly bloodPressure?: string;
  readonly heartRate?: number;
  readonly oxygenSaturation?: number;
  readonly temperatureC?: number;
}

export interface TriageInput {
  readonly age: number;
  readonly sex: 'male' | 'female' | 'other';
  readonly location: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly primarySymptoms: string;
  readonly additionalNotes?: string;
  readonly duration: string;
  readonly severity: 'mild' | 'moderate' | 'severe';
  readonly redFlags: RedFlagChecklist;
  readonly vitals?: PatientVitals;
  readonly medicalHistory?: readonly string[];
  readonly sessionToken?: string;
}

export interface TriageAssessment {
  readonly urgency: UrgencyLevel;
  readonly acuityBadge: string;
  readonly requiredSpecialty: string;
  readonly conditionCategory: string;
  readonly clinicalRoutingAdvice: string;
  readonly emergencyRequired: boolean;
  readonly redFlagsDetected: readonly string[];
  readonly searchQueries: readonly string[];
}
