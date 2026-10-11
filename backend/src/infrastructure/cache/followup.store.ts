import type {
  FollowUpPlan,
  FollowUpTask,
  FollowUpReport,
  RiskHistoryItem,
  FacilityAlert,
  CreatePlanDto,
  SubmitReportDto
} from '../../domain/models/followup.model.ts';
import { evaluateDynamicRiskScore } from '../../domain/rules/risk-scoring.rules.ts';

export class InMemoryFollowUpStore {
  private plans: Map<string, FollowUpPlan> = new Map();
  private tasks: Map<string, FollowUpTask> = new Map();
  private reports: Map<string, FollowUpReport> = new Map();
  private riskHistory: Map<string, RiskHistoryItem[]> = new Map(); // patientId -> items
  private facilityAlerts: Map<string, FacilityAlert> = new Map();

  constructor() {
    this.seedInitialData();
  }

  // --- PLAN OPERATIONS ---
  public async createPlan(dto: CreatePlanDto): Promise<{ plan: FollowUpPlan; tasks: FollowUpTask[] }> {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const startDate = dto.startDate || now;
    const freqDays = dto.frequencyDays || 7;

    const plan: FollowUpPlan = {
      id: planId,
      patientId: dto.patientId,
      patientName: dto.patientName,
      patientAge: dto.patientAge,
      patientSex: dto.patientSex,
      patientPhone: dto.patientPhone,
      patientLocation: dto.patientLocation,
      doctorId: dto.doctorId,
      doctorName: dto.doctorName,
      facilityId: dto.facilityId,
      facilityName: dto.facilityName,
      frontlineWorkerId: dto.frontlineWorkerId,
      frontlineWorkerName: dto.frontlineWorkerName,
      frequencyDays: freqDays,
      frequencyLabel: dto.frequencyLabel || `Every ${freqDays} days`,
      startDate,
      endDate: dto.endDate,
      instructions: dto.instructions,
      requiredObservations: dto.requiredObservations || [
        'blood_pressure',
        'medication_adherence',
        'symptom_progression',
        'general_condition'
      ],
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };

    this.plans.set(planId, plan);

    // Auto-generate initial scheduled tasks (e.g. 4 follow-up cycles)
    const createdTasks: FollowUpTask[] = [];
    const baseTime = new Date(startDate).getTime();

    for (let i = 1; i <= 4; i++) {
      const taskDueTime = new Date(baseTime + (i - 1) * freqDays * 24 * 60 * 60 * 1000);
      const isFirst = i === 1;
      const taskId = `task_${planId}_${i}`;

      const task: FollowUpTask = {
        id: taskId,
        planId,
        patientId: plan.patientId,
        patientName: plan.patientName,
        frontlineWorkerId: plan.frontlineWorkerId,
        frontlineWorkerName: plan.frontlineWorkerName,
        taskIndex: i,
        dueDate: taskDueTime.toISOString(),
        status: isFirst ? 'DUE' : 'UPCOMING'
      };

      this.tasks.set(taskId, task);
      createdTasks.push(task);
    }

    return { plan, tasks: createdTasks };
  }

  public async getPlan(planId: string): Promise<FollowUpPlan | null> {
    return this.plans.get(planId) || null;
  }

  public async listPlans(): Promise<FollowUpPlan[]> {
    return Array.from(this.plans.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // --- TASK OPERATIONS ---
  public async getTask(taskId: string): Promise<FollowUpTask | null> {
    return this.tasks.get(taskId) || null;
  }

  public async listWorkerTasks(workerId?: string, status?: string): Promise<FollowUpTask[]> {
    return this.listTasks({ workerId, status });
  }

  public async listTasks(filters?: {
    workerId?: string;
    status?: string;
    patientId?: string;
    facilityId?: string;
  }): Promise<FollowUpTask[]> {
    let list = Array.from(this.tasks.values());
    if (filters?.workerId) {
      list = list.filter((t) => t.frontlineWorkerId === filters.workerId);
    }
    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((t) => t.status === filters.status);
    }
    if (filters?.patientId) {
      list = list.filter((t) => t.patientId === filters.patientId);
    }
    if (filters?.facilityId) {
      list = list.filter((t) => {
        const plan = this.plans.get(t.planId);
        return plan?.facilityId === filters.facilityId;
      });
    }
    return list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  public async listReports(filters?: {
    workerId?: string;
    patientId?: string;
    facilityId?: string;
  }): Promise<FollowUpReport[]> {
    let list = Array.from(this.reports.values());
    if (filters?.workerId) {
      list = list.filter((r) => r.frontlineWorkerId === filters.workerId);
    }
    if (filters?.patientId) {
      list = list.filter((r) => r.patientId === filters.patientId);
    }
    if (filters?.facilityId) {
      list = list.filter((r) => {
        const plan = this.plans.get(r.planId);
        return plan?.facilityId === filters.facilityId;
      });
    }
    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  // --- REPORT SUBMISSION & DYNAMIC RISK ENGINE ---
  public async submitReport(dto: SubmitReportDto): Promise<{
    report: FollowUpReport;
    riskHistory: RiskHistoryItem;
    alertCreated?: FacilityAlert;
  }> {
    const task = this.tasks.get(dto.taskId);
    if (!task) {
      throw new Error(`Follow-up task not found with id: ${dto.taskId}`);
    }

    const plan = this.plans.get(task.planId);
    const now = new Date().toISOString();
    const patientHistory = this.riskHistory.get(task.patientId) || [];
    const previousRiskItem = patientHistory[patientHistory.length - 1];
    const previousScore = previousRiskItem ? previousRiskItem.riskScore : undefined;

    // Evaluate Dynamic Risk Score
    const evaluation = evaluateDynamicRiskScore({
      previousScore,
      bloodPressure: dto.bloodPressure,
      medicationAdherence: dto.medicationAdherence,
      symptomProgression: dto.symptomProgression,
      generalCondition: dto.generalCondition
    });

    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const report: FollowUpReport = {
      id: reportId,
      taskId: task.id,
      planId: task.planId,
      patientId: task.patientId,
      patientName: task.patientName,
      frontlineWorkerId: task.frontlineWorkerId,
      frontlineWorkerName: task.frontlineWorkerName,
      followUpNumber: task.taskIndex,
      bloodPressure: dto.bloodPressure,
      medicationAdherence: dto.medicationAdherence,
      symptomProgression: dto.symptomProgression,
      generalCondition: dto.generalCondition,
      observationsText: dto.observationsText || `Follow-up #${task.taskIndex} assessment completed.`,
      riskScore: evaluation.riskScore,
      riskLevel: evaluation.riskLevel,
      riskReason: evaluation.reason,
      submittedAt: now
    };

    this.reports.set(reportId, report);

    // Update Task Status to COMPLETED
    const updatedTask: FollowUpTask = {
      ...task,
      status: 'COMPLETED',
      completedAt: now,
      reportId
    };
    this.tasks.set(task.id, updatedTask);

    // Mark next task as DUE if available
    const nextTask = Array.from(this.tasks.values()).find(
      (t) => t.planId === task.planId && t.taskIndex === task.taskIndex + 1
    );
    if (nextTask && nextTask.status === 'UPCOMING') {
      this.tasks.set(nextTask.id, { ...nextTask, status: 'DUE' });
    }

    // Append to Longitudinal Risk History
    const riskItem: RiskHistoryItem = {
      id: `rh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      patientId: task.patientId,
      reportId,
      riskScore: evaluation.riskScore,
      riskLevel: evaluation.riskLevel,
      trend: evaluation.trend,
      reason: evaluation.reason,
      createdAt: now
    };

    patientHistory.push(riskItem);
    this.riskHistory.set(task.patientId, patientHistory);

    // Trigger Facility Alert if High/Critical
    let alertCreated: FacilityAlert | undefined = undefined;
    if (evaluation.triggersFacilityAlert && plan) {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const obsSummary = `BP: ${dto.bloodPressure ? `${dto.bloodPressure.systolic}/${dto.bloodPressure.diastolic}` : 'N/A'}, Adherence: ${dto.medicationAdherence}, Symptoms: ${dto.symptomProgression}.`;

      alertCreated = {
        id: alertId,
        patientId: task.patientId,
        patientName: task.patientName,
        facilityId: plan.facilityId,
        facilityName: plan.facilityName,
        riskScore: evaluation.riskScore,
        riskLevel: evaluation.riskLevel,
        triggerReason: evaluation.reason,
        latestObservations: obsSummary,
        assignedDoctorName: plan.doctorName,
        assignedWorkerName: plan.frontlineWorkerName,
        status: 'ACTIVE',
        createdAt: now
      };

      this.facilityAlerts.set(alertId, alertCreated);
    }

    return { report, riskHistory: riskItem, alertCreated };
  }

  // --- LONGITUDINAL QUERIES ---
  public async getPatientReports(patientId: string): Promise<FollowUpReport[]> {
    return Array.from(this.reports.values())
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => a.followUpNumber - b.followUpNumber);
  }

  public async getPatientRiskHistory(patientId: string): Promise<RiskHistoryItem[]> {
    return this.riskHistory.get(patientId) || [];
  }

  public async getHighRiskPatients(): Promise<
    Array<{
      patientId: string;
      patientName: string;
      latestScore: number;
      latestLevel: string;
      trend: string;
      lastFollowUpDate: string;
      assignedDoctor: string;
      assignedWorker: string;
      facilityName: string;
    }>
  > {
    const results: Array<{
      patientId: string;
      patientName: string;
      latestScore: number;
      latestLevel: string;
      trend: string;
      lastFollowUpDate: string;
      assignedDoctor: string;
      assignedWorker: string;
      facilityName: string;
    }> = [];

    for (const [patientId, history] of this.riskHistory.entries()) {
      if (history.length === 0) continue;
      const latest = history[history.length - 1];
      const plan = Array.from(this.plans.values()).find((p) => p.patientId === patientId);

      results.push({
        patientId,
        patientName: plan ? plan.patientName : patientId,
        latestScore: latest.riskScore,
        latestLevel: latest.riskLevel,
        trend: latest.trend,
        lastFollowUpDate: latest.createdAt,
        assignedDoctor: plan ? plan.doctorName : 'Dr. Priya Sharma',
        assignedWorker: plan ? plan.frontlineWorkerName : 'ASHA Anita Devi',
        facilityName: plan ? plan.facilityName : 'SBMC&H Hazaribagh'
      });
    }

    return results.sort((a, b) => b.latestScore - a.latestScore);
  }

  public async getFacilityAlerts(filters?: string | { facilityId?: string; doctorId?: string; patientId?: string }): Promise<FacilityAlert[]> {
    let list = Array.from(this.facilityAlerts.values());
    if (typeof filters === 'string') {
      list = list.filter((a) => a.facilityId === filters);
    } else if (filters) {
      if (filters.facilityId) list = list.filter((a) => a.facilityId === filters.facilityId);
      if (filters.doctorId) list = list.filter((a) => a.doctorId === filters.doctorId);
      if (filters.patientId) list = list.filter((a) => a.patientId === filters.patientId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async getFilterOptions() {
    const plans = Array.from(this.plans.values());
    return {
      doctors: Array.from(new Map(plans.map((p) => [p.doctorId, { id: p.doctorId, name: p.doctorName }])).values()),
      workers: Array.from(new Map(plans.map((p) => [p.frontlineWorkerId, { id: p.frontlineWorkerId, name: p.frontlineWorkerName }])).values()),
      facilities: Array.from(new Map(plans.map((p) => [p.facilityId, { id: p.facilityId, name: p.facilityName }])).values()),
      patients: Array.from(new Map(plans.map((p) => [p.patientId, { id: p.patientId, name: p.patientName }])).values())
    };
  }

  public async acknowledgeAlert(alertId: string): Promise<FacilityAlert | null> {
    const alert = this.facilityAlerts.get(alertId);
    if (!alert) return null;
    const updated: FacilityAlert = {
      ...alert,
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date().toISOString()
    };
    this.facilityAlerts.set(alertId, updated);
    return updated;
  }

  // --- PRE-SEEDED CLINICAL DATA ---
  private seedInitialData(): void {
    // 1. Plan 1: Ramesh Mahto (Cardiology Post-MI Follow-Up, Worsening)
    const plan1: FollowUpPlan = {
      id: 'plan_seed_1',
      patientId: 'P-1024',
      patientName: 'Ramesh Mahto',
      patientAge: 48,
      patientSex: 'male',
      patientPhone: '+91-94311-28901',
      patientLocation: 'Katkamsandi, Hazaribagh',
      doctorId: 'doc_1',
      doctorName: 'Dr. Priya Sharma',
      facilityId: 'fac_sbmch',
      facilityName: 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)',
      frontlineWorkerId: 'worker_014',
      frontlineWorkerName: 'ASHA Anita Devi',
      frequencyDays: 7,
      frequencyLabel: 'Every 7 days',
      startDate: '2026-08-10T09:00:00.000Z',
      instructions:
        'Measure resting BP, verify compliance with dual anti-platelet therapy (Aspirin + Clopidogrel) & Atorvastatin, check for recurrent chest tightness or pedal edema.',
      requiredObservations: [
        'blood_pressure',
        'medication_adherence',
        'symptom_progression',
        'general_condition'
      ],
      status: 'ACTIVE',
      createdAt: '2026-08-10T09:00:00.000Z',
      updatedAt: '2026-08-10T09:00:00.000Z'
    };
    this.plans.set(plan1.id, plan1);

    // Tasks for Plan 1
    const t1_1: FollowUpTask = {
      id: 'task_p1_1',
      planId: plan1.id,
      patientId: plan1.patientId,
      patientName: plan1.patientName,
      frontlineWorkerId: plan1.frontlineWorkerId,
      frontlineWorkerName: plan1.frontlineWorkerName,
      taskIndex: 1,
      dueDate: '2026-08-10T09:00:00.000Z',
      status: 'COMPLETED',
      completedAt: '2026-08-10T11:00:00.000Z',
      reportId: 'rep_seed_1'
    };
    const t1_2: FollowUpTask = {
      id: 'task_p1_2',
      planId: plan1.id,
      patientId: plan1.patientId,
      patientName: plan1.patientName,
      frontlineWorkerId: plan1.frontlineWorkerId,
      frontlineWorkerName: plan1.frontlineWorkerName,
      taskIndex: 2,
      dueDate: '2026-08-17T09:00:00.000Z',
      status: 'COMPLETED',
      completedAt: '2026-08-17T11:30:00.000Z',
      reportId: 'rep_seed_2'
    };
    const t1_3: FollowUpTask = {
      id: 'task_p1_3',
      planId: plan1.id,
      patientId: plan1.patientId,
      patientName: plan1.patientName,
      frontlineWorkerId: plan1.frontlineWorkerId,
      frontlineWorkerName: plan1.frontlineWorkerName,
      taskIndex: 3,
      dueDate: '2026-08-24T09:00:00.000Z',
      status: 'COMPLETED',
      completedAt: '2026-08-24T12:00:00.000Z',
      reportId: 'rep_seed_3'
    };
    const t1_4: FollowUpTask = {
      id: 'task_p1_4',
      planId: plan1.id,
      patientId: plan1.patientId,
      patientName: plan1.patientName,
      frontlineWorkerId: plan1.frontlineWorkerId,
      frontlineWorkerName: plan1.frontlineWorkerName,
      taskIndex: 4,
      dueDate: '2026-08-31T09:00:00.000Z',
      status: 'DUE'
    };
    this.tasks.set(t1_1.id, t1_1);
    this.tasks.set(t1_2.id, t1_2);
    this.tasks.set(t1_3.id, t1_3);
    this.tasks.set(t1_4.id, t1_4);

    // Reports for Plan 1
    const rep1_1: FollowUpReport = {
      id: 'rep_seed_1',
      taskId: t1_1.id,
      planId: plan1.id,
      patientId: plan1.patientId,
      patientName: plan1.patientName,
      frontlineWorkerId: plan1.frontlineWorkerId,
      frontlineWorkerName: plan1.frontlineWorkerName,
      followUpNumber: 1,
      bloodPressure: { systolic: 130, diastolic: 85 },
      medicationAdherence: 'FULL',
      symptomProgression: 'UNCHANGED',
      generalCondition: 'Stable, ambulant at home with minimal fatigue.',
      observationsText: 'Patient taking regular morning doses. No active angina.',
      riskScore: 42,
      riskLevel: 'MODERATE',
      riskReason: 'Baseline post-MI follow-up. Vital signs stable, full medication adherence.',
      submittedAt: '2026-08-10T11:00:00.000Z'
    };
    const rep1_2: FollowUpReport = {
      id: 'rep_seed_2',
      taskId: t1_2.id,
      planId: plan1.id,
      patientId: plan1.patientId,
      patientName: plan1.patientName,
      frontlineWorkerId: plan1.frontlineWorkerId,
      frontlineWorkerName: plan1.frontlineWorkerName,
      followUpNumber: 2,
      bloodPressure: { systolic: 145, diastolic: 92 },
      medicationAdherence: 'PARTIAL',
      symptomProgression: 'UNCHANGED',
      generalCondition: 'Mild exertional dyspnea, missed evening doses twice this week.',
      observationsText: 'Patient stopped evening statin due to mild muscle soreness.',
      riskScore: 51,
      riskLevel: 'MODERATE',
      riskReason: 'Risk increased from 42 to 51 (MODERATE): Elevated Stage-1 BP (145/92 mmHg); Partial medication adherence.',
      submittedAt: '2026-08-17T11:30:00.000Z'
    };
    const rep1_3: FollowUpReport = {
      id: 'rep_seed_3',
      taskId: t1_3.id,
      planId: plan1.id,
      patientId: plan1.patientId,
      patientName: plan1.patientName,
      frontlineWorkerId: plan1.frontlineWorkerId,
      frontlineWorkerName: plan1.frontlineWorkerName,
      followUpNumber: 3,
      bloodPressure: { systolic: 162, diastolic: 102 },
      medicationAdherence: 'PARTIAL',
      symptomProgression: 'WORSENED',
      generalCondition: 'Severe exertional angina and bilateral ankle swelling.',
      observationsText: 'Patient reports worsening chest heaviness on climbing stairs and missed doses.',
      riskScore: 78,
      riskLevel: 'HIGH',
      riskReason: 'Risk increased from 51 to 78 (HIGH): Severely elevated BP (162/102 mmHg); Patient-reported symptom worsening; Partial medication adherence.',
      submittedAt: '2026-08-24T12:00:00.000Z'
    };
    this.reports.set(rep1_1.id, rep1_1);
    this.reports.set(rep1_2.id, rep1_2);
    this.reports.set(rep1_3.id, rep1_3);

    // Risk History for Plan 1
    this.riskHistory.set(plan1.patientId, [
      {
        id: 'rh_seed_1',
        patientId: plan1.patientId,
        reportId: rep1_1.id,
        riskScore: 42,
        riskLevel: 'MODERATE',
        trend: 'STABLE',
        reason: rep1_1.riskReason,
        createdAt: '2026-08-10T11:00:00.000Z'
      },
      {
        id: 'rh_seed_2',
        patientId: plan1.patientId,
        reportId: rep1_2.id,
        riskScore: 51,
        riskLevel: 'MODERATE',
        trend: 'WORSENING',
        reason: rep1_2.riskReason,
        createdAt: '2026-08-17T11:30:00.000Z'
      },
      {
        id: 'rh_seed_3',
        patientId: plan1.patientId,
        reportId: rep1_3.id,
        riskScore: 78,
        riskLevel: 'HIGH',
        trend: 'WORSENING',
        reason: rep1_3.riskReason,
        createdAt: '2026-08-24T12:00:00.000Z'
      }
    ]);

    // Active Facility Alert for Plan 1
    const alert1: FacilityAlert = {
      id: 'alert_seed_1',
      patientId: plan1.patientId,
      patientName: plan1.patientName,
      facilityId: plan1.facilityId,
      facilityName: plan1.facilityName,
      riskScore: 78,
      riskLevel: 'HIGH',
      triggerReason: rep1_3.riskReason,
      latestObservations: 'BP: 162/102, Adherence: PARTIAL, Symptoms: WORSENED.',
      assignedDoctorName: plan1.doctorName,
      assignedWorkerName: plan1.frontlineWorkerName,
      status: 'ACTIVE',
      createdAt: '2026-08-24T12:00:00.000Z'
    };
    this.facilityAlerts.set(alert1.id, alert1);

    // 2. Plan 2: Anita Devi (Neurology Post-Stroke Follow-Up, Improving)
    const plan2: FollowUpPlan = {
      id: 'plan_seed_2',
      patientId: 'P-1088',
      patientName: 'Anita Devi',
      patientAge: 58,
      patientSex: 'female',
      patientPhone: '+91-94311-58201',
      patientLocation: 'Katkamsandi, Hazaribagh',
      doctorId: 'doc_1',
      doctorName: 'Dr. Priya Sharma',
      facilityId: 'fac_sbmch',
      facilityName: 'Sheikh Bhikhari Medical College & Hospital (SBMC&H)',
      frontlineWorkerId: 'worker_014',
      frontlineWorkerName: 'ASHA Anita Devi',
      frequencyDays: 7,
      frequencyLabel: 'Every 7 days',
      startDate: '2026-08-12T09:00:00.000Z',
      instructions:
        'Monitor facial symmetry, left arm motor strength, daily Aspirin & Telmisartan adherence, and speech clarity.',
      requiredObservations: [
        'blood_pressure',
        'medication_adherence',
        'symptom_progression',
        'general_condition'
      ],
      status: 'ACTIVE',
      createdAt: '2026-08-12T09:00:00.000Z',
      updatedAt: '2026-08-12T09:00:00.000Z'
    };
    this.plans.set(plan2.id, plan2);

    const t2_1: FollowUpTask = {
      id: 'task_p2_1',
      planId: plan2.id,
      patientId: plan2.patientId,
      patientName: plan2.patientName,
      frontlineWorkerId: plan2.frontlineWorkerId,
      frontlineWorkerName: plan2.frontlineWorkerName,
      taskIndex: 1,
      dueDate: '2026-08-12T09:00:00.000Z',
      status: 'COMPLETED',
      completedAt: '2026-08-12T10:30:00.000Z',
      reportId: 'rep_seed_4'
    };
    const t2_2: FollowUpTask = {
      id: 'task_p2_2',
      planId: plan2.id,
      patientId: plan2.patientId,
      patientName: plan2.patientName,
      frontlineWorkerId: plan2.frontlineWorkerId,
      frontlineWorkerName: plan2.frontlineWorkerName,
      taskIndex: 2,
      dueDate: '2026-08-19T09:00:00.000Z',
      status: 'COMPLETED',
      completedAt: '2026-08-19T10:30:00.000Z',
      reportId: 'rep_seed_5'
    };
    const t2_3: FollowUpTask = {
      id: 'task_p2_3',
      planId: plan2.id,
      patientId: plan2.patientId,
      patientName: plan2.patientName,
      frontlineWorkerId: plan2.frontlineWorkerId,
      frontlineWorkerName: plan2.frontlineWorkerName,
      taskIndex: 3,
      dueDate: '2026-08-26T09:00:00.000Z',
      status: 'DUE'
    };
    this.tasks.set(t2_1.id, t2_1);
    this.tasks.set(t2_2.id, t2_2);
    this.tasks.set(t2_3.id, t2_3);

    const rep2_1: FollowUpReport = {
      id: 'rep_seed_4',
      taskId: t2_1.id,
      planId: plan2.id,
      patientId: plan2.patientId,
      patientName: plan2.patientName,
      frontlineWorkerId: plan2.frontlineWorkerId,
      frontlineWorkerName: plan2.frontlineWorkerName,
      followUpNumber: 1,
      bloodPressure: { systolic: 140, diastolic: 88 },
      medicationAdherence: 'FULL',
      symptomProgression: 'UNCHANGED',
      generalCondition: 'Recovering left arm grip, speech mildly dysarthric.',
      observationsText: 'Taking all prescribed medications with family support.',
      riskScore: 38,
      riskLevel: 'LOW',
      riskReason: 'Post-stroke day 14. Stable recovery, full adherence.',
      submittedAt: '2026-08-12T10:30:00.000Z'
    };
    const rep2_2: FollowUpReport = {
      id: 'rep_seed_5',
      taskId: t2_2.id,
      planId: plan2.id,
      patientId: plan2.patientId,
      patientName: plan2.patientName,
      frontlineWorkerId: plan2.frontlineWorkerId,
      frontlineWorkerName: plan2.frontlineWorkerName,
      followUpNumber: 2,
      bloodPressure: { systolic: 124, diastolic: 78 },
      medicationAdherence: 'FULL',
      symptomProgression: 'IMPROVED',
      generalCondition: 'Significant improvement in arm motor power and speech clarity.',
      observationsText: 'Patient able to hold a cup with left hand. No headache or dizziness.',
      riskScore: 22,
      riskLevel: 'LOW',
      riskReason: 'Risk decreased from 38 to 22 (LOW): Controlled BP (124/78 mmHg); Strict medication adherence; Symptom improvement.',
      submittedAt: '2026-08-19T10:30:00.000Z'
    };
    this.reports.set(rep2_1.id, rep2_1);
    this.reports.set(rep2_2.id, rep2_2);

    this.riskHistory.set(plan2.patientId, [
      {
        id: 'rh_seed_4',
        patientId: plan2.patientId,
        reportId: rep2_1.id,
        riskScore: 38,
        riskLevel: 'LOW',
        trend: 'STABLE',
        reason: rep2_1.riskReason,
        createdAt: '2026-08-12T10:30:00.000Z'
      },
      {
        id: 'rh_seed_5',
        patientId: plan2.patientId,
        reportId: rep2_2.id,
        riskScore: 22,
        riskLevel: 'LOW',
        trend: 'IMPROVING',
        reason: rep2_2.riskReason,
        createdAt: '2026-08-19T10:30:00.000Z'
      }
    ]);
  }
}
