export type UrgencyTier = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'ROUTINE' | 'CRITICAL' | 'URGENT';

export type BookedByActor = 'worker' | 'self' | 'patient';

export type ConsultationMode = 'video' | 'audio' | 'chat';

export type AppointmentStatus = 'booked' | 'waiting' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';

export type VitalsSource = 'worker_verified' | 'self_reported' | 'doctor_recorded';

export interface DoctorAvailabilityWindow {
  readonly dayOfWeek: string;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly slotDurationMinutes: number;
}

export interface Doctor {
  readonly id: string;
  readonly name: string;
  readonly qualification: string;
  readonly registrationNumber: string;
  readonly specialties: readonly string[];
  readonly facilityIds: readonly string[];
  readonly availabilityWindows: readonly DoctorAvailabilityWindow[];
  readonly maxDailyLoad: number;
  readonly isAvailableOnline: boolean;
  readonly currentActiveConsultations: number;
}

export interface Appointment {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly patientAge: number;
  readonly patientSex: 'female' | 'male' | 'other';
  readonly patientLocation: string;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly specialty: string;
  readonly scheduledTime: string;
  readonly status: AppointmentStatus;
  readonly urgencyTier: UrgencyTier;
  readonly bookedBy: BookedByActor;
  readonly workerName?: string;
  readonly highRiskFlags: readonly string[];
  readonly symptomsSummary: string;
  readonly createdAt: string;
}

export interface QueueEntry {
  readonly id: string;
  readonly appointmentId?: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly patientAge: number;
  readonly patientSex: 'female' | 'male' | 'other';
  readonly doctorId: string;
  readonly doctorName: string;
  readonly specialty: string;
  readonly priorityScore: number;
  readonly urgencyTier: UrgencyTier;
  readonly highRiskFlags: readonly string[];
  readonly bookedBy: BookedByActor;
  readonly workerName?: string;
  readonly joinedAt: string;
  readonly scheduledTime?: string;
  readonly status: 'waiting' | 'called' | 'in_consultation' | 'completed';
}

export interface PrescriptionItem {
  readonly medicineName: string;
  readonly dosage: string;
  readonly frequency: string;
  readonly durationDays: number;
  readonly instructions: string;
}

export interface Consultation {
  readonly id: string;
  readonly appointmentId?: string;
  readonly queueId?: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly specialty: string;
  readonly modeUsed: ConsultationMode;
  readonly initialModeAttempted: ConsultationMode;
  readonly modeDegraded: boolean;
  readonly doctorNotes: string;
  readonly differentialDiagnosis: string;
  readonly prescription: readonly PrescriptionItem[];
  readonly referralFlag: boolean;
  readonly referralFacilityName?: string;
  readonly referralReason?: string;
  readonly diagnosticOrderFlag: boolean;
  readonly diagnosticTestsOrdered: readonly string[];
  readonly followUpFlag: boolean;
  readonly followUpDays?: number;
  readonly recordedAt: string;
}

export interface ConsultationMessage {
  readonly id: string;
  readonly consultationId: string;
  readonly sender: 'doctor' | 'patient' | 'worker';
  readonly senderName: string;
  readonly messageText: string;
  readonly sentAt: string;
}

export interface VitalsObservation {
  readonly id: string;
  readonly consultationId: string;
  readonly patientId: string;
  readonly type: 'bp' | 'spo2' | 'pulse' | 'temp' | 'glucose' | 'respiratory_rate';
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly source: VitalsSource;
  readonly recordedAt: string;
}

export interface BookSlotRequest {
  readonly patientName: string;
  readonly patientAge: number;
  readonly patientSex: 'female' | 'male' | 'other';
  readonly patientLocation: string;
  readonly specialty: string;
  readonly doctorId: string;
  readonly doctorName?: string;
  readonly facilityId: string;
  readonly scheduledTime: string;
  readonly urgencyTier?: UrgencyTier;
  readonly bookedBy: BookedByActor;
  readonly workerName?: string;
  readonly highRiskFlags?: readonly string[];
  readonly symptomsSummary: string;
}

export interface JoinQueueRequest {
  readonly appointmentId?: string;
  readonly patientName: string;
  readonly patientAge: number;
  readonly patientSex: 'female' | 'male' | 'other';
  readonly doctorId: string;
  readonly specialty: string;
  readonly urgencyTier: UrgencyTier;
  readonly highRiskFlags?: readonly string[];
  readonly bookedBy: BookedByActor;
  readonly workerName?: string;
  readonly scheduledTime?: string;
}

export interface QueueStatusResponse {
  readonly currentRank: number;
  readonly totalWaiting: number;
  readonly estimatedWaitMinutes: number;
  readonly activeDoctorName: string;
  readonly activeConsultationPatient?: string;
  readonly queueEntry: QueueEntry;
}
