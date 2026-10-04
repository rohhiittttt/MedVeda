import type {
  Referral,
  ReferralStatus,
  ReferralStatusHistoryItem,
  CreateReferralDto,
  UpdateReferralStatusDto,
  UserRole
} from '../../domain/models/referral.model.ts';
import { validateStatusTransition } from '../../domain/rules/referral-transition.rules.ts';
import { SqliteReferralStore } from '../../infrastructure/db/sqlite-referral.store.ts';

export interface ReferralListFilters {
  readonly role?: UserRole;
  readonly status?: ReferralStatus;
  readonly facilityId?: string;
  readonly doctorId?: string;
  readonly patientId?: string;
  readonly search?: string;
}

export interface ReferralStats {
  readonly total: number;
  readonly pending: number;
  readonly rejected: number;
  readonly completed: number;
}

export class ManageReferralUseCase {
  private readonly store: SqliteReferralStore;

  constructor(store: SqliteReferralStore) {
    this.store = store;
  }

  public async createReferral(dto: CreateReferralDto): Promise<Referral> {
    if (!dto.patientName || !dto.receivingFacilityName || !dto.specialty || !dto.reason) {
      throw new Error('Missing required referral fields: patientName, receivingFacilityName, specialty, reason.');
    }

    const seq = this.store.getNextSequenceNumber();
    const formattedSeq = String(seq).padStart(5, '0');
    const referralId = `REF-2026-${formattedSeq}`;
    const internalId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const initialHistoryItem: ReferralStatusHistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      referralId,
      fromStatus: null,
      toStatus: 'REFERRAL_INITIATED',
      updatedBy: dto.referringDoctorName || 'Doctor',
      userRole: 'doctor',
      remarks: 'Digital referral initiated via MedVeda.',
      timestamp: now
    };

    const newReferral: Referral = {
      id: internalId,
      referralId,
      patientId: dto.patientId || `PAT-${Date.now().toString().slice(-4)}`,
      patientName: dto.patientName,
      patientAge: dto.patientAge,
      patientSex: dto.patientSex,
      patientPhone: dto.patientPhone || '',
      patientLocation: dto.patientLocation || 'India',
      referringDoctorId: dto.referringDoctorId || 'doc_1',
      referringDoctorName: dto.referringDoctorName || 'Referring Doctor',
      referringFacilityId: dto.referringFacilityId || 'fac_referring',
      referringFacilityName: dto.referringFacilityName || 'Referring Facility',
      receivingFacilityId: dto.receivingFacilityId || `fac_${dto.receivingFacilityName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}`,
      receivingFacilityName: dto.receivingFacilityName,
      departmentReferredTo: dto.departmentReferredTo || dto.specialty || 'General',
      specialty: dto.specialty,
      reason: dto.reason,
      clinicalSummary: dto.clinicalSummary || '',
      urgency: dto.urgency || 'Normal',
      icuPatient: dto.icuPatient || false,
      currentStep: 1,
      treatingDoctor: null,
      digitalSignature: dto.digitalSignature || null,
      bedAllocation: null,
      priorityRank: dto.urgency === 'Emergency' ? 1 : dto.urgency === 'Urgent' ? 2 : 3,
      status: 'REFERRAL_INITIATED',
      createdAt: now,
      updatedAt: now,
      statusHistory: [initialHistoryItem]
    };

    this.store.save(newReferral);
    this.store.appendHistory(initialHistoryItem);

    return newReferral;
  }

  public async updateReferralStatus(
    referralId: string,
    dto: UpdateReferralStatusDto
  ): Promise<Referral> {
    const referral = this.store.findByReferralId(referralId);
    if (!referral) {
      throw new Error(`Referral with ID '${referralId}' not found.`);
    }

    const validation = validateStatusTransition(referral.status, dto.toStatus, dto.userRole);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid referral status transition.');
    }

    const now = new Date().toISOString();
    const historyItem: ReferralStatusHistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      referralId,
      fromStatus: referral.status,
      toStatus: dto.toStatus,
      updatedBy: dto.updatedBy || dto.userRole,
      userRole: dto.userRole,
      remarks: dto.remarks || `Status transitioned to ${dto.toStatus}`,
      timestamp: now
    };

    const updatedReferral: Referral = {
      ...referral,
      status: dto.toStatus,
      updatedAt: now,
      ...(dto.treatingDoctor !== undefined && { treatingDoctor: dto.treatingDoctor }),
      ...(dto.bedAllocation !== undefined && { bedAllocation: dto.bedAllocation }),
      ...(dto.currentStep !== undefined && { currentStep: dto.currentStep })
    };

    this.store.save(updatedReferral);
    this.store.appendHistory(historyItem);

    return this.store.findByReferralId(referralId)!;
  }

  public async getReferral(referralId: string): Promise<Referral | null> {
    return this.store.findByReferralId(referralId);
  }

  public async listReferrals(filters?: ReferralListFilters): Promise<Referral[]> {
    // Multi-tenant query isolation
    let all = this.store.findAll({
      facilityId: filters?.facilityId,
      doctorId: filters?.doctorId,
      patientId: filters?.patientId,
      search: filters?.search
    });

    if (filters?.status) {
      all = all.filter((r) => r.status === filters.status);
    }

    return all;
  }

  public async getPendingReferrals(filters?: ReferralListFilters): Promise<Referral[]> {
    const all = await this.listReferrals(filters);
    return all.filter((r) => r.status !== 'COMPLETED' && r.status !== 'REJECTED');
  }

  public async getCompletedReferrals(filters?: ReferralListFilters): Promise<Referral[]> {
    const all = await this.listReferrals(filters);
    return all.filter((r) => r.status === 'COMPLETED');
  }

  public async getStats(filters?: ReferralListFilters): Promise<ReferralStats> {
    const all = await this.listReferrals(filters);
    return {
      total: all.length,
      pending: all.filter((r) => r.status !== 'COMPLETED' && r.status !== 'REJECTED').length,
      rejected: all.filter((r) => r.status === 'REJECTED').length,
      completed: all.filter((r) => r.status === 'COMPLETED').length
    };
  }

  public async getHistory(referralId: string): Promise<ReferralStatusHistoryItem[]> {
    return this.store.getHistoryByReferralId(referralId);
  }

  public async deleteReferral(referralId: string): Promise<boolean> {
    return this.store.delete(referralId);
  }
}
