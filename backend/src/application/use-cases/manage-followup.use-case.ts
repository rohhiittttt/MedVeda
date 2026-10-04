import type {
  FollowUpPlan,
  FollowUpTask,
  FollowUpReport,
  RiskHistoryItem,
  FacilityAlert,
  CreatePlanDto,
  SubmitReportDto
} from '../../domain/models/followup.model.ts';
import type { SqliteFollowUpStore } from '../../infrastructure/db/sqlite-followup.store.ts';

export class ManageFollowUpUseCase {
  private store: SqliteFollowUpStore;

  constructor(store: SqliteFollowUpStore) {
    this.store = store;
  }

  public async createPlan(dto: CreatePlanDto): Promise<{ plan: FollowUpPlan; tasks: FollowUpTask[] }> {
    if (!dto.patientId || !dto.patientName) {
      throw new Error('Patient ID and Name are required to create a follow-up plan.');
    }
    if (!dto.doctorId || !dto.doctorName) {
      throw new Error('Doctor ID and Name are required.');
    }
    if (!dto.frontlineWorkerId || !dto.frontlineWorkerName) {
      throw new Error('Frontline health worker must be assigned.');
    }
    if (!dto.instructions || dto.instructions.trim().length === 0) {
      throw new Error("Doctor's clinical instructions are required.");
    }

    return this.store.createPlan(dto);
  }

  public async getPlan(planId: string): Promise<FollowUpPlan | null> {
    return this.store.getPlan(planId);
  }

  public async listPlans(filters?: {
    facilityId?: string;
    doctorId?: string;
    workerId?: string;
    patientId?: string;
  }): Promise<FollowUpPlan[]> {
    return this.store.listPlans(filters);
  }

  public async listWorkerTasks(workerId?: string, status?: string, patientId?: string): Promise<FollowUpTask[]> {
    return this.store.listTasks({ workerId, status, patientId });
  }

  public async listTasks(filters?: {
    workerId?: string;
    status?: string;
    patientId?: string;
    facilityId?: string;
  }): Promise<FollowUpTask[]> {
    return this.store.listTasks(filters);
  }

  public async submitReport(dto: SubmitReportDto): Promise<{
    report: FollowUpReport;
    riskHistory: RiskHistoryItem;
    alertCreated?: FacilityAlert;
  }> {
    if (!dto.taskId) {
      throw new Error('Task ID is required to submit a follow-up report.');
    }
    if (!dto.medicationAdherence) {
      throw new Error('Medication adherence observation is required.');
    }
    if (!dto.symptomProgression) {
      throw new Error('Symptom progression observation is required.');
    }

    return this.store.submitReport(dto);
  }

  public async getPatientFollowUps(patientId: string): Promise<FollowUpReport[]> {
    return this.store.getPatientReports(patientId);
  }

  public async listReports(filters?: {
    workerId?: string;
    patientId?: string;
    facilityId?: string;
  }): Promise<FollowUpReport[]> {
    return this.store.listReports(filters);
  }

  public async getPatientRiskHistory(patientId: string): Promise<RiskHistoryItem[]> {
    return this.store.getPatientRiskHistory(patientId);
  }

  public async getHighRiskPatients(filters?: {
    facilityId?: string;
    doctorId?: string;
    workerId?: string;
    patientId?: string;
  }) {
    return this.store.getHighRiskPatients(filters);
  }

  public async getFacilityAlerts(filters?: {
    facilityId?: string;
    doctorId?: string;
    patientId?: string;
  }): Promise<FacilityAlert[]> {
    return this.store.getFacilityAlerts(filters);
  }

  public async acknowledgeAlert(alertId: string): Promise<FacilityAlert | null> {
    return this.store.acknowledgeAlert(alertId);
  }

  public async getFilterOptions() {
    return this.store.getFilterOptions();
  }
}
