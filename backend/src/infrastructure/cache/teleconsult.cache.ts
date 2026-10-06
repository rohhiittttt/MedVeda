import type {
  Doctor,
  Appointment,
  QueueEntry,
  Consultation,
  ConsultationMessage,
  VitalsObservation
} from '../../domain/models/teleconsult.model.ts';
import { sortQueueByPriority } from '../../domain/rules/queue-priority.rules.ts';

export interface FacilityInfo {
  readonly id: string;
  readonly name: string;
  readonly location: string;
}

export const SEED_FACILITIES: readonly FacilityInfo[] = [
  { id: 'fac_sbmch', name: 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)', location: 'Hazaribagh, Jharkhand' },
  { id: 'fac_sadar', name: 'Sadar Hospital', location: 'Hazaribagh, Jharkhand' },
  { id: 'fac_arogyam', name: 'Arogyam Multi-Specialty Hospital & Critical Care', location: 'Hazaribagh, Jharkhand' },
  { id: 'fac_kalyani', name: 'Kalyani Super Specialty Hospital & Trauma Centre', location: 'Ramgarh Cantt, Jharkhand' }
];

export const SEED_DOCTORS: readonly Doctor[] = [
  {
    id: 'doc_1',
    name: 'Dr. Priya Sharma',
    qualification: 'MD, DM (Neurology), DNB',
    registrationNumber: 'JH-MED-4421',
    specialties: ['Neurology', 'Stroke Care', 'Neuro-Medicine'],
    facilityIds: ['fac_sbmch', 'fac_sadar'],
    availabilityWindows: [
      { dayOfWeek: 'Monday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 },
      { dayOfWeek: 'Wednesday', facilityId: 'fac_sadar', facilityName: 'Sadar Hospital', startTime: '10:00', endTime: '14:00', slotDurationMinutes: 20 },
      { dayOfWeek: 'Friday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 25,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_2',
    name: 'Dr. Rajesh Verma',
    qualification: 'MD (Medicine), DM (Cardiology)',
    registrationNumber: 'JH-MED-3890',
    specialties: ['Cardiology', 'Interventional Cardiology', 'Cardiac Care'],
    facilityIds: ['fac_sbmch', 'fac_arogyam'],
    availabilityWindows: [
      { dayOfWeek: 'Tuesday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '09:00', endTime: '14:00', slotDurationMinutes: 20 },
      { dayOfWeek: 'Thursday', facilityId: 'fac_arogyam', facilityName: 'Arogyam Critical Care', startTime: '11:00', endTime: '16:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 30,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_3',
    name: 'Dr. Ananya Sen',
    qualification: 'MD (Pediatrics), DCH',
    registrationNumber: 'JH-MED-5102',
    specialties: ['Pediatrics', 'Neonatal Care', 'Child Health'],
    facilityIds: ['fac_sadar', 'fac_kalyani'],
    availabilityWindows: [
      { dayOfWeek: 'Monday', facilityId: 'fac_sadar', facilityName: 'Sadar Hospital', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 15 },
      { dayOfWeek: 'Wednesday', facilityId: 'fac_kalyani', facilityName: 'Kalyani Trauma Centre', startTime: '10:00', endTime: '14:00', slotDurationMinutes: 15 }
    ],
    maxDailyLoad: 35,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_4',
    name: 'Dr. Kavita Murmu',
    qualification: 'MS (Obstetrics & Gynecology)',
    registrationNumber: 'JH-MED-6218',
    specialties: ['Obstetrics & Gynecology', 'Maternal Health', 'High-Risk Pregnancy'],
    facilityIds: ['fac_sadar', 'fac_sbmch'],
    availabilityWindows: [
      { dayOfWeek: 'Tuesday', facilityId: 'fac_sadar', facilityName: 'Sadar Hospital', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 },
      { dayOfWeek: 'Saturday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '09:00', endTime: '14:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 25,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_gm',
    name: 'Dr. Arvind Sinha',
    qualification: 'MD (Internal Medicine), FACP',
    registrationNumber: 'JH-MED-3105',
    specialties: ['General Medicine', 'Internal Medicine', 'Primary Care'],
    facilityIds: ['fac_sadar', 'fac_sbmch'],
    availabilityWindows: [
      { dayOfWeek: 'Monday', facilityId: 'fac_sadar', facilityName: 'Sadar Hospital', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 15 }
    ],
    maxDailyLoad: 35,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_gs',
    name: 'Dr. Manoj K. Pandey',
    qualification: 'MS (General Surgery), FIAGES',
    registrationNumber: 'JH-MED-4912',
    specialties: ['General Surgery', 'Laparoscopy', 'Trauma Surgery'],
    facilityIds: ['fac_sbmch', 'fac_arogyam'],
    availabilityWindows: [
      { dayOfWeek: 'Tuesday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '10:00', endTime: '14:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 20,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_ortho',
    name: 'Dr. Vikramaditya Roy',
    qualification: 'MS (Orthopedics), DNB (Ortho)',
    registrationNumber: 'JH-MED-5540',
    specialties: ['Orthopedics', 'Joint Replacement', 'Bone Trauma'],
    facilityIds: ['fac_kalyani', 'fac_sbmch'],
    availabilityWindows: [
      { dayOfWeek: 'Wednesday', facilityId: 'fac_kalyani', facilityName: 'Kalyani Trauma Centre', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 25,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_ns',
    name: 'Dr. Alok Nath Tripathy',
    qualification: 'MCh (Neurosurgery), MS (Surgery)',
    registrationNumber: 'JH-MED-7120',
    specialties: ['Neurosurgery', 'Spine Surgery', 'Brain Trauma'],
    facilityIds: ['fac_sbmch'],
    availabilityWindows: [
      { dayOfWeek: 'Thursday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '11:00', endTime: '15:00', slotDurationMinutes: 30 }
    ],
    maxDailyLoad: 15,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_ent',
    name: 'Dr. Sunita Baskey',
    qualification: 'MS (ENT / Otorhinolaryngology)',
    registrationNumber: 'JH-MED-4688',
    specialties: ['ENT', 'Otorhinolaryngology', 'Head & Neck Care'],
    facilityIds: ['fac_sadar', 'fac_sbmch'],
    availabilityWindows: [
      { dayOfWeek: 'Monday', facilityId: 'fac_sadar', facilityName: 'Sadar Hospital', startTime: '10:00', endTime: '14:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 25,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_opht',
    name: 'Dr. Hemant Soreng',
    qualification: 'MS (Ophthalmology), FICO',
    registrationNumber: 'JH-MED-5391',
    specialties: ['Ophthalmology', 'Cataract & Eye Microsurgery'],
    facilityIds: ['fac_sadar'],
    availabilityWindows: [
      { dayOfWeek: 'Friday', facilityId: 'fac_sadar', facilityName: 'Sadar Hospital', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 15 }
    ],
    maxDailyLoad: 30,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_derm',
    name: 'Dr. Neha Agarwal',
    qualification: 'MD (Dermatology, Venereology & Leprosy)',
    registrationNumber: 'JH-MED-6734',
    specialties: ['Dermatology', 'Skin Allergy', 'Cosmetology'],
    facilityIds: ['fac_arogyam', 'fac_sadar'],
    availabilityWindows: [
      { dayOfWeek: 'Wednesday', facilityId: 'fac_arogyam', facilityName: 'Arogyam Multi-Specialty', startTime: '11:00', endTime: '15:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 25,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_psych',
    name: 'Dr. Tariq Anwar',
    qualification: 'MD (Psychiatry), DPM',
    registrationNumber: 'JH-MED-4819',
    specialties: ['Psychiatry', 'Neuropsychiatry', 'Behavioral Health'],
    facilityIds: ['fac_sadar'],
    availabilityWindows: [
      { dayOfWeek: 'Thursday', facilityId: 'fac_sadar', facilityName: 'Sadar Hospital', startTime: '12:00', endTime: '16:00', slotDurationMinutes: 25 }
    ],
    maxDailyLoad: 20,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_pulm',
    name: 'Dr. Devendra Prasad',
    qualification: 'MD (Pulmonary Medicine), DTCD',
    registrationNumber: 'JH-MED-5902',
    specialties: ['Pulmonology / Respiratory Medicine', 'Pulmonology', 'Respiratory Medicine', 'Chest Medicine'],
    facilityIds: ['fac_sbmch', 'fac_arogyam'],
    availabilityWindows: [
      { dayOfWeek: 'Tuesday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 25,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_gastro',
    name: 'Dr. Sanjay Khalkho',
    qualification: 'DM (Gastroenterology), MD',
    registrationNumber: 'JH-MED-7450',
    specialties: ['Gastroenterology', 'Hepatology', 'GI Endoscopy'],
    facilityIds: ['fac_sbmch', 'fac_arogyam'],
    availabilityWindows: [
      { dayOfWeek: 'Monday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '10:00', endTime: '14:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 20,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_uro',
    name: 'Dr. Pradeep Minz',
    qualification: 'MCh (Urology), MS',
    registrationNumber: 'JH-MED-6831',
    specialties: ['Urology', 'Endourology', 'Renal Surgery'],
    facilityIds: ['fac_sbmch', 'fac_kalyani'],
    availabilityWindows: [
      { dayOfWeek: 'Wednesday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '10:00', endTime: '14:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 20,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_neph',
    name: 'Dr. Meenakshi Sundaram',
    qualification: 'DM (Nephrology), MD',
    registrationNumber: 'JH-MED-8104',
    specialties: ['Nephrology', 'Dialysis Care', 'Renal Medicine'],
    facilityIds: ['fac_sbmch', 'fac_arogyam'],
    availabilityWindows: [
      { dayOfWeek: 'Thursday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '11:00', endTime: '15:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 20,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_endo',
    name: 'Dr. Rashmi Rekha Topno',
    qualification: 'DM (Endocrinology), MD',
    registrationNumber: 'JH-MED-7622',
    specialties: ['Endocrinology', 'Diabetology', 'Thyroid Care'],
    facilityIds: ['fac_sbmch', 'fac_sadar'],
    availabilityWindows: [
      { dayOfWeek: 'Friday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '10:00', endTime: '14:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 25,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_onco',
    name: 'Dr. Abhishek Mukherjee',
    qualification: 'DM (Medical Oncology), MD, ECMO',
    registrationNumber: 'JH-MED-8319',
    specialties: ['Oncology', 'Cancer Care', 'Chemotherapy'],
    facilityIds: ['fac_sbmch'],
    availabilityWindows: [
      { dayOfWeek: 'Tuesday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '11:00', endTime: '15:00', slotDurationMinutes: 25 }
    ],
    maxDailyLoad: 15,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_dent',
    name: 'Dr. Pooja Kumari',
    qualification: 'MDS (Oral & Maxillofacial Surgery), BDS',
    registrationNumber: 'JH-DENT-2291',
    specialties: ['Dentistry', 'Oral Surgery', 'Dental Care'],
    facilityIds: ['fac_sadar', 'fac_sbmch'],
    availabilityWindows: [
      { dayOfWeek: 'Saturday', facilityId: 'fac_sadar', facilityName: 'Sadar Hospital', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 }
    ],
    maxDailyLoad: 30,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  },
  {
    id: 'doc_em',
    name: 'Dr. Rakesh Ranjan',
    qualification: 'MEM (Emergency Medicine), MRCEM',
    registrationNumber: 'JH-MED-5034',
    specialties: ['Emergency Medicine', 'Critical Care', 'Trauma Stabilization'],
    facilityIds: ['fac_sbmch', 'fac_arogyam'],
    availabilityWindows: [
      { dayOfWeek: 'Monday', facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh', startTime: '00:00', endTime: '23:59', slotDurationMinutes: 15 }
    ],
    maxDailyLoad: 50,
    isAvailableOnline: true,
    currentActiveConsultations: 0
  }
];

export class InMemoryTeleconsultStore {
  private readonly doctors: Map<string, Doctor> = new Map();
  private readonly appointments: Map<string, Appointment> = new Map();
  private readonly queue: Map<string, QueueEntry> = new Map();
  private readonly consultations: Map<string, Consultation> = new Map();
  private readonly messages: Map<string, ConsultationMessage[]> = new Map();
  private readonly vitals: Map<string, VitalsObservation[]> = new Map();

  constructor() {
    for (const doc of SEED_DOCTORS) {
      this.doctors.set(doc.id, doc);
    }

    // Seed initial active queue entries
    const initialQueue: QueueEntry[] = [
      {
        id: 'QUE-SEED-001',
        appointmentId: 'APT-SEED-01',
        patientId: 'PAT-2026-1024',
        patientName: 'Ramesh Mahto',
        patientAge: 54,
        patientSex: 'male',
        doctorId: 'doc_2',
        doctorName: 'Dr. Rajesh Verma',
        specialty: 'Cardiology',
        priorityScore: 92,
        urgencyTier: 'CRITICAL',
        highRiskFlags: ['Severe chest pressure', 'Diaphoresis'],
        bookedBy: 'worker',
        workerName: 'Anita Devi (ASHA)',
        joinedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
        scheduledTime: '10:00 AM',
        status: 'waiting'
      },
      {
        id: 'QUE-SEED-002',
        appointmentId: undefined, // Walk-in
        patientId: 'PAT-2026-2048',
        patientName: 'Sunita Soren',
        patientAge: 46,
        patientSex: 'female',
        doctorId: 'doc_1',
        doctorName: 'Dr. Priya Sharma',
        specialty: 'Neurology',
        priorityScore: 78,
        urgencyTier: 'URGENT',
        highRiskFlags: ['Elevated BP 168/104'],
        bookedBy: 'patient',
        joinedAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
        scheduledTime: 'Walk-In',
        status: 'waiting'
      },
      {
        id: 'QUE-SEED-003',
        appointmentId: 'APT-SEED-02',
        patientId: 'PAT-2026-4112',
        patientName: 'Rekha Devi',
        patientAge: 32,
        patientSex: 'female',
        doctorId: 'doc_4',
        doctorName: 'Dr. Kavita Murmu',
        specialty: 'Obstetrics & Gynecology',
        priorityScore: 65,
        urgencyTier: 'ROUTINE',
        highRiskFlags: ['Antenatal Third Trimester'],
        bookedBy: 'worker',
        workerName: 'Sunita Devi (ASHA)',
        joinedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        scheduledTime: '10:30 AM',
        status: 'waiting'
      },
      {
        id: 'QUE-SEED-004',
        appointmentId: 'APT-SEED-03',
        patientId: 'PAT-2026-5501',
        patientName: 'Gopal Yadav',
        patientAge: 62,
        patientSex: 'male',
        doctorId: 'doc_gm',
        doctorName: 'Dr. Arvind Sinha',
        specialty: 'General Medicine',
        priorityScore: 50,
        urgencyTier: 'ROUTINE',
        highRiskFlags: [],
        bookedBy: 'patient',
        joinedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
        scheduledTime: '09:30 AM',
        status: 'called'
      }
    ];

    for (const q of initialQueue) {
      this.queue.set(q.id, q);
    }
  }

  async getDoctorRoster(facilityId?: string, specialty?: string): Promise<Doctor[]> {
    let list = Array.from(this.doctors.values());
    if (facilityId) {
      list = list.filter((d) => d.facilityIds.includes(facilityId));
    }
    if (specialty) {
      const specLower = specialty.toLowerCase().trim();
      list = list.filter((d) => d.specialties.some((s) => {
        const sLower = s.toLowerCase().trim();
        if (sLower === specLower) return true;

        if (specLower.startsWith('general ') && sLower.startsWith('general ')) {
          return specLower === sLower;
        }

        if (specLower.includes('neuro') && sLower.includes('neuro')) {
          const isTargetSurg = specLower.includes('surg');
          const isDocSurg = sLower.includes('surg');
          if (isTargetSurg !== isDocSurg) return false;
        }

        if (specLower === 'ent') {
          return /\bent\b/i.test(sLower) || sLower.includes('otorhinolaryngology') || sLower.includes('ear, nose');
        }
        if (sLower === 'ent') {
          return /\bent\b/i.test(specLower) || specLower.includes('otorhinolaryngology') || specLower.includes('ear, nose');
        }

        if (specLower.includes('uro') && !specLower.includes('neuro')) {
          if (sLower.includes('neuro')) return false;
        }
        if (sLower.includes('uro') && !sLower.includes('neuro')) {
          if (specLower.includes('neuro')) return false;
        }

        if (sLower.includes(specLower) || specLower.includes(sLower)) {
          return true;
        }

        const targetTokens = specLower.split(/[\/&]/).map((t) => t.trim()).filter(Boolean);
        const docTokens = sLower.split(/[\/&]/).map((t) => t.trim()).filter(Boolean);
        return targetTokens.some((tt) => docTokens.some((dt) => dt === tt || dt.includes(tt) || tt.includes(dt)));
      }));
    }
    return list;
  }

  async getDoctorById(id: string): Promise<Doctor | undefined> {
    return this.doctors.get(id);
  }

  async getAvailableSlots(doctorId?: string, specialty?: string, _date?: string): Promise<Array<{
    readonly slotId: string;
    readonly doctorId: string;
    readonly doctorName: string;
    readonly specialty: string;
    readonly facilityId: string;
    readonly facilityName: string;
    readonly timeString: string;
    readonly isAvailable: boolean;
  }>> {
    const docs = await this.getDoctorRoster(undefined, specialty);
    const targetDocs = doctorId ? docs.filter((d) => d.id === doctorId) : docs;

    const times = ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM'];
    const result = [];

    for (const doc of targetDocs) {
      const window = doc.availabilityWindows[0] || { facilityId: 'fac_sbmch', facilityName: 'SBMC&H Hazaribagh' };
      for (const t of times) {
        const slotKey = `${doc.id}_${t.replace(/\s/g, '_')}`;
        const isBooked = Array.from(this.appointments.values()).some(
          (app) => app.doctorId === doc.id && app.scheduledTime.includes(t) && app.status === 'booked'
        );
        result.push({
          slotId: slotKey,
          doctorId: doc.id,
          doctorName: doc.name,
          specialty: doc.specialties[0] || 'General Medicine',
          facilityId: window.facilityId,
          facilityName: window.facilityName,
          timeString: t,
          isAvailable: !isBooked
        });
      }
    }

    return result;
  }

  async createAppointment(appointment: Appointment): Promise<Appointment> {
    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async addToQueue(entry: QueueEntry): Promise<QueueEntry> {
    this.queue.set(entry.id, entry);
    return entry;
  }

  async getQueueEntries(doctorId?: string): Promise<QueueEntry[]> {
    let list = Array.from(this.queue.values()).filter((e) => e.status === 'waiting' || e.status === 'called');
    if (doctorId) {
      list = list.filter((e) => e.doctorId === doctorId);
    }
    return sortQueueByPriority(list);
  }

  async getQueueEntry(id: string): Promise<QueueEntry | undefined> {
    return this.queue.get(id);
  }

  async updateQueueStatus(id: string, status: 'waiting' | 'called' | 'in_consultation' | 'completed'): Promise<void> {
    const entry = this.queue.get(id);
    if (entry) {
      this.queue.set(id, { ...entry, status });
    }
  }

  async saveConsultation(consultation: Consultation): Promise<Consultation> {
    this.consultations.set(consultation.id, consultation);
    return consultation;
  }

  async getConsultation(id: string): Promise<Consultation | undefined> {
    return this.consultations.get(id);
  }

  async addMessage(message: ConsultationMessage): Promise<ConsultationMessage> {
    const list = this.messages.get(message.consultationId) || [];
    list.push(message);
    this.messages.set(message.consultationId, list);
    return message;
  }

  async getMessages(consultationId: string): Promise<ConsultationMessage[]> {
    return this.messages.get(consultationId) || [];
  }

  async addVitals(vital: VitalsObservation): Promise<VitalsObservation> {
    const list = this.vitals.get(vital.consultationId) || [];
    list.push(vital);
    this.vitals.set(vital.consultationId, list);
    return vital;
  }

  async getVitals(consultationId: string): Promise<VitalsObservation[]> {
    return this.vitals.get(consultationId) || [];
  }
}
