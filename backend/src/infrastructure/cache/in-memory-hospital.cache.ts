import type { HospitalCandidate } from '../../domain/models/hospital.model.ts';
import type { IHospitalCachePort } from '../../domain/ports/search.port.ts';

const DEFAULT_REGIONAL_SEED: HospitalCandidate[] = [
  {
    id: 'fac_sbmch_hazaribagh',
    name: 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)',
    address: 'Near Canary Hill Road, Hazaribagh, Jharkhand',
    distanceKm: 2.8,
    latitude: 24.0124,
    longitude: 85.3612,
    hasEmergencyDepartment: true,
    hasRequiredSpecialty: true,
    specialtyMode: 'EMERGENCY_AND_OPD',
    emergencySpecialtyVerified: true,
    verificationStatus: 'verified',
    verificationNotes: 'Premier 500-bed government medical college with 24x7 Emergency Casualty, Acute Stroke Management, 128-slice CT diagnostics, and round-the-clock ICU.',
    contactNumber: '+91-6546-270100',
    sources: [
      { type: 'official_website', url: 'https://sbmch.jharkhand.gov.in/emergency', reliability: 'primary' },
      { type: 'government_directory', url: 'https://nhm.jharkhand.gov.in/medical-colleges', reliability: 'high' }
    ]
  },
  {
    id: 'fac_arogyam_hazaribagh',
    name: 'Arogyam Multi-Specialty Hospital & Critical Care',
    address: 'Indraprastha Colony, Hazaribagh, Jharkhand',
    distanceKm: 4.8,
    latitude: 23.9962,
    longitude: 85.3691,
    hasEmergencyDepartment: true,
    hasRequiredSpecialty: true,
    specialtyMode: 'EMERGENCY_AND_OPD',
    emergencySpecialtyVerified: true,
    verificationStatus: 'verified',
    verificationNotes: 'Multi-specialty hospital with 24x7 active emergency trauma care, on-call neurological team, and advanced critical care ICU.',
    contactNumber: '+91-6546-271000',
    sources: [
      { type: 'official_website', url: 'https://arogyamhospitals.com/emergency-care', reliability: 'primary' },
      { type: 'reputable_platform', url: 'https://justdial.com/Hazaribag/Arogyam-Hospital', reliability: 'high' }
    ]
  },
  {
    id: 'fac_kalyani_ramgarh',
    name: 'Kalyani Super Specialty Hospital & Trauma Centre',
    address: 'NH33, Ramgarh Cantt, Jharkhand (38 km from Hazaribagh)',
    distanceKm: 38.0,
    latitude: 23.6345,
    longitude: 85.5142,
    hasEmergencyDepartment: true,
    hasRequiredSpecialty: true,
    specialtyMode: 'EMERGENCY_AND_OPD',
    emergencySpecialtyVerified: true,
    verificationStatus: 'verified',
    verificationNotes: 'Super-specialty center within 50 km radius offering 24x7 acute stroke care, neuro-trauma unit, and emergency interventional services.',
    contactNumber: '+91-6553-228400',
    sources: [
      { type: 'official_website', url: 'https://kalyanihospital.org/trauma-emergency', reliability: 'primary' }
    ]
  },
  {
    id: 'fac_sadar_hazaribagh',
    name: 'Sadar Hospital Hazaribagh',
    address: 'Main Hospital Road, Hazaribagh, Jharkhand',
    distanceKm: 3.2,
    latitude: 23.9921,
    longitude: 85.3588,
    hasEmergencyDepartment: true,
    hasRequiredSpecialty: true,
    specialtyMode: 'OPD_ONLY',
    emergencySpecialtyVerified: false,
    verificationStatus: 'partially_verified',
    verificationNotes: 'District hospital with casualty triage and daytime specialty OPD consultations; transfers complex neurological cases to SBMC&H or tertiary centers.',
    contactNumber: '+91-6546-264210',
    sources: [
      { type: 'government_directory', url: 'https://hazaribag.nic.in/health-facilities', reliability: 'high' }
    ]
  },
  {
    id: 'fac_ranchi_super',
    name: 'Ranchi Super Specialty Hospital',
    address: 'Bariatu Road, Ranchi, Jharkhand (92 km via NH20)',
    distanceKm: 92.0,
    latitude: 23.3911,
    longitude: 85.3497,
    hasEmergencyDepartment: true,
    hasRequiredSpecialty: true,
    specialtyMode: 'EMERGENCY_AND_OPD',
    emergencySpecialtyVerified: true,
    verificationStatus: 'verified',
    verificationNotes: 'Tertiary super-specialty stroke referral center with comprehensive neuro-surgery and advanced intervention.',
    contactNumber: '+91-651-2541234',
    sources: [
      { type: 'official_website', url: 'https://ranchisuperspecialty.org/stroke-unit', reliability: 'primary' },
      { type: 'government_directory', url: 'https://nhm.jharkhand.gov.in/tertiary-centers', reliability: 'high' }
    ]
  }
];

export class InMemoryHospitalCacheAdapter implements IHospitalCachePort {
  private readonly facilities: Map<string, HospitalCandidate> = new Map();

  constructor(initialFacilities?: readonly HospitalCandidate[]) {
    const list = initialFacilities && initialFacilities.length > 0 ? initialFacilities : DEFAULT_REGIONAL_SEED;
    for (const f of list) {
      this.facilities.set(f.id, f);
    }
  }

  async findNearby(location: string, _specialty: string, _emergencyRequired: boolean): Promise<readonly HospitalCandidate[]> {
    const all = Array.from(this.facilities.values());
    const locTokens = (location || '')
      .toLowerCase()
      .split(/[,/\s-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);

    if (locTokens.length > 0) {
      const matched = all.filter((c) => {
        const hay = `${c.name} ${c.address}`.toLowerCase();
        return locTokens.some((tok) => hay.includes(tok));
      });
      if (matched.length > 0) {
        return matched;
      }
    }
    return all;
  }

  async save(candidate: HospitalCandidate): Promise<void> {
    this.facilities.set(candidate.id, candidate);
  }

  async saveBatch(candidates: readonly HospitalCandidate[]): Promise<void> {
    for (const c of candidates) {
      this.facilities.set(c.id, c);
    }
  }
}
