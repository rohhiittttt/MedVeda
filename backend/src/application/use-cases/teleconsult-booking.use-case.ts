import type {
  Appointment,
  BookSlotRequest,
  UrgencyTier
} from '../../domain/models/teleconsult.model.ts';
import { InMemoryTeleconsultStore } from '../../infrastructure/cache/teleconsult.cache.ts';

export class TeleconsultBookingUseCase {
  private readonly store: InMemoryTeleconsultStore;

  constructor(store: InMemoryTeleconsultStore) {
    this.store = store;
  }

  async getSlots(doctorId?: string, specialty?: string, date?: string) {
    return this.store.getAvailableSlots(doctorId, specialty, date);
  }

  async getRoster(facilityId?: string, specialty?: string) {
    return this.store.getDoctorRoster(facilityId, specialty);
  }

  async bookAppointment(request: BookSlotRequest): Promise<{
    readonly appointment: Appointment;
    readonly smsSimulation: {
      readonly recipient: string;
      readonly messageText: string;
      readonly sentAt: string;
    };
  }> {
    const doctor = await this.store.getDoctorById(request.doctorId);
    const doctorName = request.doctorName || (doctor ? doctor.name : 'Dr. On Duty');
    const facilityName = 'SBMC&H / Sadar Regional Network';

    const appointmentId = `APT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const appointment: Appointment = {
      id: appointmentId,
      patientId: `PAT-${Math.floor(100000 + Math.random() * 900000)}`,
      patientName: request.patientName,
      patientAge: request.patientAge,
      patientSex: request.patientSex,
      patientLocation: request.patientLocation,
      doctorId: request.doctorId,
      doctorName,
      facilityId: request.facilityId,
      facilityName,
      specialty: request.specialty,
      scheduledTime: request.scheduledTime,
      status: 'booked',
      urgencyTier: request.urgencyTier || 'ROUTINE',
      bookedBy: request.bookedBy,
      workerName: request.workerName,
      highRiskFlags: request.highRiskFlags || [],
      symptomsSummary: request.symptomsSummary,
      createdAt: new Date().toISOString()
    };

    await this.store.createAppointment(appointment);

    // SMS Simulation (only place SMS is triggered)
    const smsSimulation = {
      recipient: request.bookedBy === 'worker' ? `Frontline Worker (${request.workerName || 'ASHA'})` : request.patientName,
      messageText: `SmartCare: Teleconsult confirmed for ${request.patientName} with ${doctorName} (${request.specialty}) on ${request.scheduledTime}. Appointment ID: ${appointmentId}. Join 5m prior.`,
      sentAt: new Date().toISOString()
    };

    return { appointment, smsSimulation };
  }
}
