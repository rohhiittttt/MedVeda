import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  FollowUpPlan,
  FollowUpTask,
  FollowUpReport,
  RiskHistoryItem,
  FacilityAlert,
  CreatePlanDto,
  SubmitReportDto,
  PrescribedMedication
} from '../../domain/models/followup.model.ts';
import { evaluateDynamicRiskScore } from '../../domain/rules/risk-scoring.rules.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SqliteFollowUpStore {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const resolvedPath =
      dbPath || path.resolve(__dirname, '../../../data/followups.db');

    const dataDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new DatabaseSync(resolvedPath);
    this.initTables();
  }

  private initTables(): void {
    // 1. Follow-Up Plans Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS followup_plans (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        patient_age INTEGER NOT NULL,
        patient_sex TEXT NOT NULL,
        patient_phone TEXT,
        patient_location TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        doctor_name TEXT NOT NULL,
        facility_id TEXT NOT NULL,
        facility_name TEXT NOT NULL,
        frontline_worker_id TEXT NOT NULL,
        frontline_worker_name TEXT NOT NULL,
        frequency_days INTEGER NOT NULL,
        frequency_label TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        instructions TEXT NOT NULL,
        required_observations_json TEXT NOT NULL,
        current_medications_json TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_plans_patient ON followup_plans(patient_id);
      CREATE INDEX IF NOT EXISTS idx_plans_doctor ON followup_plans(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_plans_facility ON followup_plans(facility_id);
      CREATE INDEX IF NOT EXISTS idx_plans_worker ON followup_plans(frontline_worker_id);

      -- 2. Follow-Up Tasks Table
      CREATE TABLE IF NOT EXISTS followup_tasks (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        frontline_worker_id TEXT NOT NULL,
        frontline_worker_name TEXT NOT NULL,
        task_index INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'UPCOMING',
        completed_at TEXT,
        report_id TEXT,
        FOREIGN KEY (plan_id) REFERENCES followup_plans(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_worker ON followup_tasks(frontline_worker_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_patient ON followup_tasks(patient_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON followup_tasks(status);

      -- 3. Follow-Up Reports Table
      CREATE TABLE IF NOT EXISTS followup_reports (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        frontline_worker_id TEXT NOT NULL,
        frontline_worker_name TEXT NOT NULL,
        follow_up_number INTEGER NOT NULL,
        bp_systolic INTEGER,
        bp_diastolic INTEGER,
        medication_adherence TEXT NOT NULL,
        symptom_progression TEXT NOT NULL,
        general_condition TEXT NOT NULL,
        observations_text TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        risk_reason TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES followup_tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_reports_patient ON followup_reports(patient_id);
      CREATE INDEX IF NOT EXISTS idx_reports_worker ON followup_reports(frontline_worker_id);
      CREATE INDEX IF NOT EXISTS idx_reports_plan ON followup_reports(plan_id);

      -- 4. Longitudinal Risk History Table
      CREATE TABLE IF NOT EXISTS risk_history (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        report_id TEXT,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        trend TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_risk_patient ON risk_history(patient_id);

      -- 5. Facility Escalation Alerts Table
      CREATE TABLE IF NOT EXISTS facility_alerts (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        facility_id TEXT NOT NULL,
        facility_name TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        trigger_reason TEXT NOT NULL,
        latest_observations TEXT NOT NULL,
        assigned_doctor_name TEXT NOT NULL,
        assigned_worker_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        acknowledged_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_facility ON facility_alerts(facility_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON facility_alerts(status);
    `);

    // Check if initial seeding is needed
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM followup_plans');
    const result = countStmt.get() as { count: number };
    if (!result || result.count === 0) {
      this.seedInitialData();
    }
  }

  // --- MAP DATABASE ROWS TO DOMAIN MODELS ---
  private mapPlanRow(row: any): FollowUpPlan {
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientAge: Number(row.patient_age),
      patientSex: row.patient_sex,
      patientPhone: row.patient_phone || undefined,
      patientLocation: row.patient_location,
      doctorId: row.doctor_id,
      doctorName: row.doctor_name,
      facilityId: row.facility_id,
      facilityName: row.facility_name,
      frontlineWorkerId: row.frontline_worker_id,
      frontlineWorkerName: row.frontline_worker_name,
      frequencyDays: Number(row.frequency_days),
      frequencyLabel: row.frequency_label,
      startDate: row.start_date,
      endDate: row.end_date || undefined,
      instructions: row.instructions,
      requiredObservations: row.required_observations_json
        ? JSON.parse(row.required_observations_json)
        : ['blood_pressure', 'medication_adherence', 'symptoms', 'general_condition'],
      currentMedications: row.current_medications_json
        ? JSON.parse(row.current_medications_json)
        : undefined,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapTaskRow(row: any): FollowUpTask {
    return {
      id: row.id,
      planId: row.plan_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      frontlineWorkerId: row.frontline_worker_id,
      frontlineWorkerName: row.frontline_worker_name,
      taskIndex: Number(row.task_index),
      dueDate: row.due_date,
      status: row.status,
      completedAt: row.completed_at || undefined,
      reportId: row.report_id || undefined
    };
  }

  private mapReportRow(row: any): FollowUpReport {
    return {
      id: row.id,
      taskId: row.task_id,
      planId: row.plan_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      frontlineWorkerId: row.frontline_worker_id,
      frontlineWorkerName: row.frontline_worker_name,
      followUpNumber: Number(row.follow_up_number),
      bloodPressure:
        row.bp_systolic !== null && row.bp_diastolic !== null
          ? { systolic: Number(row.bp_systolic), diastolic: Number(row.bp_diastolic) }
          : undefined,
      medicationAdherence: row.medication_adherence,
      symptomProgression: row.symptom_progression,
      generalCondition: row.general_condition,
      observationsText: row.observations_text,
      riskScore: Number(row.risk_score),
      riskLevel: row.risk_level,
      riskReason: row.risk_reason,
      submittedAt: row.submitted_at
    };
  }

  private mapRiskHistoryRow(row: any): RiskHistoryItem {
    return {
      id: row.id,
      patientId: row.patient_id,
      reportId: row.report_id || undefined,
      riskScore: Number(row.risk_score),
      riskLevel: row.risk_level,
      trend: row.trend,
      reason: row.reason,
      createdAt: row.created_at
    };
  }

  private mapFacilityAlertRow(row: any): FacilityAlert {
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      facilityId: row.facility_id,
      facilityName: row.facility_name,
      riskScore: Number(row.risk_score),
      riskLevel: row.risk_level,
      triggerReason: row.trigger_reason,
      latestObservations: row.latest_observations,
      assignedDoctorName: row.assigned_doctor_name,
      assignedWorkerName: row.assigned_worker_name,
      status: row.status,
      createdAt: row.created_at,
      acknowledgedAt: row.acknowledged_at || undefined
    };
  }

  // --- PLAN OPERATIONS ---
  public async createPlan(dto: CreatePlanDto): Promise<{ plan: FollowUpPlan; tasks: FollowUpTask[] }> {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const startDate = dto.startDate || now;
    const freqDays = dto.frequencyDays || 7;
    const freqLabel = dto.frequencyLabel || `Every ${freqDays} days`;
    const reqObs = dto.requiredObservations || [
      'blood_pressure',
      'medication_adherence',
      'symptom_progression',
      'general_condition'
    ];

    const insertPlan = this.db.prepare(`
      INSERT INTO followup_plans (
        id, patient_id, patient_name, patient_age, patient_sex, patient_phone,
        patient_location, doctor_id, doctor_name, facility_id, facility_name,
        frontline_worker_id, frontline_worker_name, frequency_days, frequency_label,
        start_date, end_date, instructions, required_observations_json,
        current_medications_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPlan.run(
      planId,
      dto.patientId,
      dto.patientName,
      dto.patientAge,
      dto.patientSex,
      dto.patientPhone || null,
      dto.patientLocation,
      dto.doctorId,
      dto.doctorName,
      dto.facilityId,
      dto.facilityName,
      dto.frontlineWorkerId,
      dto.frontlineWorkerName,
      freqDays,
      freqLabel,
      startDate,
      dto.endDate || null,
      dto.instructions,
      JSON.stringify(reqObs),
      dto.currentMedications ? JSON.stringify(dto.currentMedications) : null,
      'ACTIVE',
      now,
      now
    );

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
      frequencyLabel: freqLabel,
      startDate,
      endDate: dto.endDate,
      instructions: dto.instructions,
      requiredObservations: reqObs,
      currentMedications: dto.currentMedications,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };

    // Auto-generate 4 scheduled task cycles
    const createdTasks: FollowUpTask[] = [];
    const baseTime = new Date(startDate).getTime();
    const insertTask = this.db.prepare(`
      INSERT INTO followup_tasks (
        id, plan_id, patient_id, patient_name, frontline_worker_id,
        frontline_worker_name, task_index, due_date, status, completed_at, report_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i <= 4; i++) {
      const taskDueTime = new Date(baseTime + (i - 1) * freqDays * 24 * 60 * 60 * 1000);
      const isFirst = i === 1;
      const taskId = `task_${planId}_${i}`;
      const status = isFirst ? 'DUE' : 'UPCOMING';

      insertTask.run(
        taskId,
        planId,
        plan.patientId,
        plan.patientName,
        plan.frontlineWorkerId,
        plan.frontlineWorkerName,
        i,
        taskDueTime.toISOString(),
        status,
        null,
        null
      );

      createdTasks.push({
        id: taskId,
        planId,
        patientId: plan.patientId,
        patientName: plan.patientName,
        frontlineWorkerId: plan.frontlineWorkerId,
        frontlineWorkerName: plan.frontlineWorkerName,
        taskIndex: i,
        dueDate: taskDueTime.toISOString(),
        status
      });
    }

    return { plan, tasks: createdTasks };
  }

  public async getPlan(planId: string): Promise<FollowUpPlan | null> {
    const stmt = this.db.prepare('SELECT * FROM followup_plans WHERE id = ?');
    const row = stmt.get(planId);
    return row ? this.mapPlanRow(row) : null;
  }

  public async listPlans(filters?: {
    facilityId?: string;
    doctorId?: string;
    workerId?: string;
    patientId?: string;
  }): Promise<FollowUpPlan[]> {
    let sql = 'SELECT * FROM followup_plans WHERE 1=1';
    const params: any[] = [];

    if (filters?.facilityId && filters.facilityId !== 'ALL') {
      sql += ' AND (facility_id = ? OR facility_name = ?)';
      params.push(filters.facilityId, filters.facilityId);
    }
    if (filters?.doctorId && filters.doctorId !== 'ALL') {
      sql += ' AND (doctor_id = ? OR doctor_name = ?)';
      params.push(filters.doctorId, filters.doctorId);
    }
    if (filters?.workerId && filters.workerId !== 'ALL') {
      sql += ' AND (frontline_worker_id = ? OR frontline_worker_name = ?)';
      params.push(filters.workerId, filters.workerId);
    }
    if (filters?.patientId && filters.patientId !== 'ALL') {
      sql += ' AND (patient_id = ? OR patient_name = ?)';
      params.push(filters.patientId, filters.patientId);
    }

    sql += ' ORDER BY created_at DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map((r) => this.mapPlanRow(r));
  }

  // --- TASK OPERATIONS ---
  public async getTask(taskId: string): Promise<FollowUpTask | null> {
    const stmt = this.db.prepare('SELECT * FROM followup_tasks WHERE id = ?');
    const row = stmt.get(taskId);
    return row ? this.mapTaskRow(row) : null;
  }

  public async listTasks(filters?: {
    workerId?: string;
    status?: string;
    patientId?: string;
    facilityId?: string;
  }): Promise<FollowUpTask[]> {
    let sql = 'SELECT t.* FROM followup_tasks t LEFT JOIN followup_plans p ON t.plan_id = p.id WHERE 1=1';
    const params: any[] = [];

    if (filters?.workerId && filters.workerId !== 'ALL') {
      sql += ' AND (t.frontline_worker_id = ? OR t.frontline_worker_name = ?)';
      params.push(filters.workerId, filters.workerId);
    }
    if (filters?.patientId && filters.patientId !== 'ALL') {
      sql += ' AND (t.patient_id = ? OR t.patient_name = ?)';
      params.push(filters.patientId, filters.patientId);
    }
    if (filters?.facilityId && filters.facilityId !== 'ALL') {
      sql += ' AND (p.facility_id = ? OR p.facility_name = ?)';
      params.push(filters.facilityId, filters.facilityId);
    }
    if (filters?.status && filters.status !== 'ALL') {
      sql += ' AND t.status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY t.due_date ASC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map((r) => this.mapTaskRow(r));
  }

  // --- REPORT SUBMISSION & DYNAMIC RISK ENGINE ---
  public async submitReport(dto: SubmitReportDto): Promise<{
    report: FollowUpReport;
    riskHistory: RiskHistoryItem;
    alertCreated?: FacilityAlert;
  }> {
    const task = await this.getTask(dto.taskId);
    if (!task) {
      throw new Error(`Follow-up task not found with id: ${dto.taskId}`);
    }

    const plan = await this.getPlan(task.planId);
    const now = new Date().toISOString();

    // Query previous risk score for this patient
    const prevHistoryStmt = this.db.prepare(
      'SELECT risk_score FROM risk_history WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1'
    );
    const prevRow = prevHistoryStmt.get(task.patientId) as { risk_score: number } | undefined;
    const previousScore = prevRow ? prevRow.risk_score : undefined;

    // Evaluate Dynamic Risk Score
    const evaluation = evaluateDynamicRiskScore({
      previousScore,
      bloodPressure: dto.bloodPressure,
      medicationAdherence: dto.medicationAdherence,
      symptomProgression: dto.symptomProgression,
      generalCondition: dto.generalCondition
    });

    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const obsText = dto.observationsText || `Follow-up #${task.taskIndex} assessment completed.`;

    // 1. Insert Report
    const insertReport = this.db.prepare(`
      INSERT INTO followup_reports (
        id, task_id, plan_id, patient_id, patient_name, frontline_worker_id,
        frontline_worker_name, follow_up_number, bp_systolic, bp_diastolic,
        medication_adherence, symptom_progression, general_condition, observations_text,
        risk_score, risk_level, risk_reason, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertReport.run(
      reportId,
      task.id,
      task.planId,
      task.patientId,
      task.patientName,
      task.frontlineWorkerId,
      task.frontlineWorkerName,
      task.taskIndex,
      dto.bloodPressure ? dto.bloodPressure.systolic : null,
      dto.bloodPressure ? dto.bloodPressure.diastolic : null,
      dto.medicationAdherence,
      dto.symptomProgression,
      dto.generalCondition,
      obsText,
      evaluation.riskScore,
      evaluation.riskLevel,
      evaluation.reason,
      now
    );

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
      observationsText: obsText,
      riskScore: evaluation.riskScore,
      riskLevel: evaluation.riskLevel,
      riskReason: evaluation.reason,
      submittedAt: now
    };

    // 2. Update Current Task to COMPLETED
    const updateTaskStmt = this.db.prepare(`
      UPDATE followup_tasks SET status = 'COMPLETED', completed_at = ?, report_id = ? WHERE id = ?
    `);
    updateTaskStmt.run(now, reportId, task.id);

    // 3. Mark Next Task in Cycle as DUE
    const nextTaskStmt = this.db.prepare(`
      UPDATE followup_tasks SET status = 'DUE' WHERE plan_id = ? AND task_index = ? AND status = 'UPCOMING'
    `);
    nextTaskStmt.run(task.planId, task.taskIndex + 1);

    // 4. Record Longitudinal Risk History
    const historyId = `rh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const insertHistory = this.db.prepare(`
      INSERT INTO risk_history (
        id, patient_id, report_id, risk_score, risk_level, trend, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertHistory.run(
      historyId,
      task.patientId,
      reportId,
      evaluation.riskScore,
      evaluation.riskLevel,
      evaluation.trend,
      evaluation.reason,
      now
    );

    const riskHistoryItem: RiskHistoryItem = {
      id: historyId,
      patientId: task.patientId,
      reportId,
      riskScore: evaluation.riskScore,
      riskLevel: evaluation.riskLevel,
      trend: evaluation.trend,
      reason: evaluation.reason,
      createdAt: now
    };

    // 5. Trigger Facility Alert if High/Critical
    let alertCreated: FacilityAlert | undefined = undefined;
    if (evaluation.triggersFacilityAlert && plan) {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const obsSummary = `BP: ${dto.bloodPressure ? `${dto.bloodPressure.systolic}/${dto.bloodPressure.diastolic}` : 'N/A'}, Adherence: ${dto.medicationAdherence}, Symptoms: ${dto.symptomProgression}.`;

      const insertAlert = this.db.prepare(`
        INSERT INTO facility_alerts (
          id, patient_id, patient_name, facility_id, facility_name,
          risk_score, risk_level, trigger_reason, latest_observations,
          assigned_doctor_name, assigned_worker_name, status, created_at, acknowledged_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertAlert.run(
        alertId,
        task.patientId,
        task.patientName,
        plan.facilityId,
        plan.facilityName,
        evaluation.riskScore,
        evaluation.riskLevel,
        evaluation.reason,
        obsSummary,
        plan.doctorName,
        plan.frontlineWorkerName,
        'ACTIVE',
        now,
        null
      );

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
    }

    return { report, riskHistory: riskHistoryItem, alertCreated };
  }

  // --- REPORT QUERIES ---
  public async getPatientReports(patientId: string): Promise<FollowUpReport[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM followup_reports WHERE patient_id = ? ORDER BY follow_up_number ASC'
    );
    const rows = stmt.all(patientId);
    return rows.map((r) => this.mapReportRow(r));
  }

  public async listReports(filters?: {
    workerId?: string;
    patientId?: string;
    facilityId?: string;
  }): Promise<FollowUpReport[]> {
    let sql = 'SELECT r.* FROM followup_reports r LEFT JOIN followup_plans p ON r.plan_id = p.id WHERE 1=1';
    const params: any[] = [];

    if (filters?.workerId && filters.workerId !== 'ALL') {
      sql += ' AND (r.frontline_worker_id = ? OR r.frontline_worker_name = ?)';
      params.push(filters.workerId, filters.workerId);
    }
    if (filters?.patientId && filters.patientId !== 'ALL') {
      sql += ' AND (r.patient_id = ? OR r.patient_name = ?)';
      params.push(filters.patientId, filters.patientId);
    }
    if (filters?.facilityId && filters.facilityId !== 'ALL') {
      sql += ' AND (p.facility_id = ? OR p.facility_name = ?)';
      params.push(filters.facilityId, filters.facilityId);
    }

    sql += ' ORDER BY r.submitted_at DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map((r) => this.mapReportRow(r));
  }

  public async getPatientRiskHistory(patientId: string): Promise<RiskHistoryItem[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM risk_history WHERE patient_id = ? ORDER BY created_at ASC'
    );
    const rows = stmt.all(patientId);
    return rows.map((r) => this.mapRiskHistoryRow(r));
  }

  // --- MULTI-TENANT HIGH-RISK OVERVIEW ---
  public async getHighRiskPatients(filters?: {
    facilityId?: string;
    doctorId?: string;
    workerId?: string;
    patientId?: string;
  }): Promise<
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
    // Group by patient to find the latest risk history entry
    let sql = `
      SELECT
        p.id as plan_id,
        p.patient_id,
        p.patient_name,
        p.doctor_id,
        p.doctor_name,
        p.facility_id,
        p.facility_name,
        p.frontline_worker_id,
        p.frontline_worker_name,
        rh.risk_score,
        rh.risk_level,
        rh.trend,
        rh.created_at as last_followup_date
      FROM followup_plans p
      INNER JOIN (
        SELECT r1.*
        FROM risk_history r1
        JOIN (
          SELECT patient_id, MAX(created_at) as max_created
          FROM risk_history
          GROUP BY patient_id
        ) r2 ON r1.patient_id = r2.patient_id AND r1.created_at = r2.max_created
      ) rh ON p.patient_id = rh.patient_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.facilityId && filters.facilityId !== 'ALL') {
      sql += ' AND (p.facility_id = ? OR p.facility_name = ?)';
      params.push(filters.facilityId, filters.facilityId);
    }
    if (filters?.doctorId && filters.doctorId !== 'ALL') {
      sql += ' AND (p.doctor_id = ? OR p.doctor_name = ?)';
      params.push(filters.doctorId, filters.doctorId);
    }
    if (filters?.workerId && filters.workerId !== 'ALL') {
      sql += ' AND (p.frontline_worker_id = ? OR p.frontline_worker_name = ?)';
      params.push(filters.workerId, filters.workerId);
    }
    if (filters?.patientId && filters.patientId !== 'ALL') {
      sql += ' AND (p.patient_id = ? OR p.patient_name = ?)';
      params.push(filters.patientId, filters.patientId);
    }

    sql += ' ORDER BY rh.risk_score DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((r) => ({
      patientId: r.patient_id,
      patientName: r.patient_name,
      latestScore: Number(r.risk_score),
      latestLevel: r.risk_level,
      trend: r.trend,
      lastFollowUpDate: r.last_followup_date,
      assignedDoctor: r.doctor_name,
      assignedWorker: r.frontline_worker_name,
      facilityName: r.facility_name
    }));
  }

  // --- FACILITY ALERTS ---
  public async getFacilityAlerts(filters?: {
    facilityId?: string;
    doctorId?: string;
    patientId?: string;
  }): Promise<FacilityAlert[]> {
    let sql = 'SELECT a.* FROM facility_alerts a LEFT JOIN followup_plans p ON a.patient_id = p.patient_id WHERE 1=1';
    const params: any[] = [];

    if (filters?.facilityId && filters.facilityId !== 'ALL') {
      sql += ' AND (a.facility_id = ? OR a.facility_name = ?)';
      params.push(filters.facilityId, filters.facilityId);
    }
    if (filters?.doctorId && filters.doctorId !== 'ALL') {
      sql += ' AND (p.doctor_id = ? OR p.doctor_name = ? OR a.assigned_doctor_name = ?)';
      params.push(filters.doctorId, filters.doctorId, filters.doctorId);
    }
    if (filters?.patientId && filters.patientId !== 'ALL') {
      sql += ' AND (a.patient_id = ? OR a.patient_name = ?)';
      params.push(filters.patientId, filters.patientId);
    }

    sql += ' ORDER BY a.created_at DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map((r) => this.mapFacilityAlertRow(r));
  }

  public async acknowledgeAlert(alertId: string): Promise<FacilityAlert | null> {
    const now = new Date().toISOString();
    const updateStmt = this.db.prepare(`
      UPDATE facility_alerts SET status = 'ACKNOWLEDGED', acknowledged_at = ? WHERE id = ?
    `);
    updateStmt.run(now, alertId);

    const getStmt = this.db.prepare('SELECT * FROM facility_alerts WHERE id = ?');
    const row = getStmt.get(alertId);
    return row ? this.mapFacilityAlertRow(row) : null;
  }

  // --- FILTER DROPDOWNS DISCOVERY ---
  public async getFilterOptions(): Promise<{
    facilities: Array<{ id: string; name: string }>;
    doctors: Array<{ id: string; name: string; facilityName: string }>;
    workers: Array<{ id: string; name: string }>;
    patients: Array<{ id: string; name: string }>;
  }> {
    const facStmt = this.db.prepare(`
      SELECT DISTINCT facility_id as id, facility_name as name FROM followup_plans ORDER BY name ASC
    `);
    const docStmt = this.db.prepare(`
      SELECT DISTINCT doctor_id as id, doctor_name as name, facility_name as facilityName FROM followup_plans ORDER BY name ASC
    `);
    const workerStmt = this.db.prepare(`
      SELECT DISTINCT frontline_worker_id as id, frontline_worker_name as name FROM followup_plans ORDER BY name ASC
    `);
    const patientStmt = this.db.prepare(`
      SELECT DISTINCT patient_id as id, patient_name as name FROM followup_plans ORDER BY name ASC
    `);

    return {
      facilities: facStmt.all() as any[],
      doctors: docStmt.all() as any[],
      workers: workerStmt.all() as any[],
      patients: patientStmt.all() as any[]
    };
  }

  // --- PRE-SEEDED BENCHMARK DATA ---
  private seedInitialData(): void {
    // -------------------------------------------------------------
    // PLAN 1: Ramesh Mahto (Post-MI Cardiology, High/Worsening Risk)
    // -------------------------------------------------------------
    const plan1Medications: PrescribedMedication[] = [
      {
        id: 'med_p1_1',
        name: 'Aspirin (Ecosprin)',
        dosage: '75 mg',
        frequency: 'Once Daily',
        timing: 'Morning (After food)',
        instructions: 'Take with full glass of water. Do not crush.',
        adherenceStatus: 'TAKEN'
      },
      {
        id: 'med_p1_2',
        name: 'Clopidogrel (Clopilet)',
        dosage: '75 mg',
        frequency: 'Once Daily',
        timing: 'Morning',
        instructions: 'Dual antiplatelet therapy for stent patency.',
        adherenceStatus: 'TAKEN'
      },
      {
        id: 'med_p1_3',
        name: 'Atorvastatin (Atorva)',
        dosage: '40 mg',
        frequency: 'Once Daily',
        timing: 'Night (Bedtime)',
        instructions: 'Lipid lowering and plaque stabilization. Patient missed 2 doses.',
        adherenceStatus: 'MISSED'
      },
      {
        id: 'med_p1_4',
        name: 'Ramipril (Cardace)',
        dosage: '2.5 mg',
        frequency: 'Once Daily',
        timing: 'Morning',
        instructions: 'ACE inhibitor for left ventricular remodeling.',
        adherenceStatus: 'TAKEN'
      }
    ];

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
      currentMedications: plan1Medications,
      status: 'ACTIVE',
      createdAt: '2026-08-10T09:00:00.000Z',
      updatedAt: '2026-08-10T09:00:00.000Z'
    };

    const insertPlan = this.db.prepare(`
      INSERT INTO followup_plans (
        id, patient_id, patient_name, patient_age, patient_sex, patient_phone,
        patient_location, doctor_id, doctor_name, facility_id, facility_name,
        frontline_worker_id, frontline_worker_name, frequency_days, frequency_label,
        start_date, end_date, instructions, required_observations_json,
        current_medications_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPlan.run(
      plan1.id,
      plan1.patientId,
      plan1.patientName,
      plan1.patientAge,
      plan1.patientSex,
      plan1.patientPhone || null,
      plan1.patientLocation,
      plan1.doctorId,
      plan1.doctorName,
      plan1.facilityId,
      plan1.facilityName,
      plan1.frontlineWorkerId,
      plan1.frontlineWorkerName,
      plan1.frequencyDays,
      plan1.frequencyLabel,
      plan1.startDate,
      null,
      plan1.instructions,
      JSON.stringify(plan1.requiredObservations),
      JSON.stringify(plan1.currentMedications),
      plan1.status,
      plan1.createdAt,
      plan1.updatedAt
    );

    const insertTask = this.db.prepare(`
      INSERT INTO followup_tasks (
        id, plan_id, patient_id, patient_name, frontline_worker_id,
        frontline_worker_name, task_index, due_date, status, completed_at, report_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTask.run('task_p1_1', plan1.id, plan1.patientId, plan1.patientName, plan1.frontlineWorkerId, plan1.frontlineWorkerName, 1, '2026-08-10T09:00:00.000Z', 'COMPLETED', '2026-08-10T11:00:00.000Z', 'rep_seed_1');
    insertTask.run('task_p1_2', plan1.id, plan1.patientId, plan1.patientName, plan1.frontlineWorkerId, plan1.frontlineWorkerName, 2, '2026-08-17T09:00:00.000Z', 'COMPLETED', '2026-08-17T11:30:00.000Z', 'rep_seed_2');
    insertTask.run('task_p1_3', plan1.id, plan1.patientId, plan1.patientName, plan1.frontlineWorkerId, plan1.frontlineWorkerName, 3, '2026-08-24T09:00:00.000Z', 'COMPLETED', '2026-08-24T12:00:00.000Z', 'rep_seed_3');
    insertTask.run('task_p1_4', plan1.id, plan1.patientId, plan1.patientName, plan1.frontlineWorkerId, plan1.frontlineWorkerName, 4, '2026-08-31T09:00:00.000Z', 'DUE', null, null);

    const insertReport = this.db.prepare(`
      INSERT INTO followup_reports (
        id, task_id, plan_id, patient_id, patient_name, frontline_worker_id,
        frontline_worker_name, follow_up_number, bp_systolic, bp_diastolic,
        medication_adherence, symptom_progression, general_condition, observations_text,
        risk_score, risk_level, risk_reason, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertReport.run('rep_seed_1', 'task_p1_1', plan1.id, plan1.patientId, plan1.patientName, plan1.frontlineWorkerId, plan1.frontlineWorkerName, 1, 130, 85, 'FULL', 'UNCHANGED', 'Stable, ambulant at home with minimal fatigue.', 'Patient taking regular morning doses. No active angina.', 42, 'MODERATE', 'Baseline post-MI follow-up. Vital signs stable, full medication adherence.', '2026-08-10T11:00:00.000Z');
    insertReport.run('rep_seed_2', 'task_p1_2', plan1.id, plan1.patientId, plan1.patientName, plan1.frontlineWorkerId, plan1.frontlineWorkerName, 2, 145, 92, 'PARTIAL', 'UNCHANGED', 'Mild exertional dyspnea, missed evening doses twice this week.', 'Patient stopped evening statin due to mild muscle soreness.', 51, 'MODERATE', 'Risk increased from 42 to 51 (MODERATE): Elevated Stage-1 BP (145/92 mmHg); Partial medication adherence.', '2026-08-17T11:30:00.000Z');
    insertReport.run('rep_seed_3', 'task_p1_3', plan1.id, plan1.patientId, plan1.patientName, plan1.frontlineWorkerId, plan1.frontlineWorkerName, 3, 162, 102, 'PARTIAL', 'WORSENED', 'Severe exertional angina and bilateral ankle swelling.', 'Patient reports worsening chest heaviness on climbing stairs and missed doses.', 78, 'HIGH', 'Risk increased from 51 to 78 (HIGH): Severely elevated BP (162/102 mmHg); Patient-reported symptom worsening; Partial medication adherence.', '2026-08-24T12:00:00.000Z');

    const insertHistory = this.db.prepare(`
      INSERT INTO risk_history (id, patient_id, report_id, risk_score, risk_level, trend, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertHistory.run('rh_seed_1', plan1.patientId, 'rep_seed_1', 42, 'MODERATE', 'STABLE', 'Baseline post-MI follow-up. Vital signs stable, full medication adherence.', '2026-08-10T11:00:00.000Z');
    insertHistory.run('rh_seed_2', plan1.patientId, 'rep_seed_2', 51, 'MODERATE', 'WORSENING', 'Risk increased from 42 to 51 (MODERATE): Elevated Stage-1 BP (145/92 mmHg); Partial medication adherence.', '2026-08-17T11:30:00.000Z');
    insertHistory.run('rh_seed_3', plan1.patientId, 'rep_seed_3', 78, 'HIGH', 'WORSENING', 'Risk increased from 51 to 78 (HIGH): Severely elevated BP (162/102 mmHg); Patient-reported symptom worsening; Partial medication adherence.', '2026-08-24T12:00:00.000Z');

    const insertAlert = this.db.prepare(`
      INSERT INTO facility_alerts (
        id, patient_id, patient_name, facility_id, facility_name,
        risk_score, risk_level, trigger_reason, latest_observations,
        assigned_doctor_name, assigned_worker_name, status, created_at, acknowledged_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAlert.run('alert_seed_1', plan1.patientId, plan1.patientName, plan1.facilityId, plan1.facilityName, 78, 'HIGH', 'Risk increased from 51 to 78 (HIGH): Severely elevated BP (162/102 mmHg); Patient-reported symptom worsening; Partial medication adherence.', 'BP: 162/102, Adherence: PARTIAL, Symptoms: WORSENED.', plan1.doctorName, plan1.frontlineWorkerName, 'ACTIVE', '2026-08-24T12:00:00.000Z', null);

    // -------------------------------------------------------------
    // PLAN 2: Anita Devi (Post-Stroke Neurology, Low/Improving Risk)
    // -------------------------------------------------------------
    const plan2Medications: PrescribedMedication[] = [
      {
        id: 'med_p2_1',
        name: 'Telmisartan (Telma)',
        dosage: '40 mg',
        frequency: 'Once Daily',
        timing: 'Morning',
        instructions: 'Essential antihypertensive therapy.',
        adherenceStatus: 'TAKEN'
      },
      {
        id: 'med_p2_2',
        name: 'Aspirin',
        dosage: '75 mg',
        frequency: 'Once Daily',
        timing: 'Afternoon',
        instructions: 'Secondary stroke prophylaxis.',
        adherenceStatus: 'TAKEN'
      },
      {
        id: 'med_p2_3',
        name: 'Atorvastatin',
        dosage: '20 mg',
        frequency: 'Once Daily',
        timing: 'Night',
        instructions: 'Vascular stabilization.',
        adherenceStatus: 'TAKEN'
      },
      {
        id: 'med_p2_4',
        name: 'Citicoline',
        dosage: '500 mg',
        frequency: 'Twice Daily',
        timing: 'Morning & Evening',
        instructions: 'Neuroprotective adjuvant for cognitive/motor rehabilitation.',
        adherenceStatus: 'TAKEN'
      }
    ];

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
      currentMedications: plan2Medications,
      status: 'ACTIVE',
      createdAt: '2026-08-12T09:00:00.000Z',
      updatedAt: '2026-08-12T09:00:00.000Z'
    };

    insertPlan.run(
      plan2.id,
      plan2.patientId,
      plan2.patientName,
      plan2.patientAge,
      plan2.patientSex,
      plan2.patientPhone || null,
      plan2.patientLocation,
      plan2.doctorId,
      plan2.doctorName,
      plan2.facilityId,
      plan2.facilityName,
      plan2.frontlineWorkerId,
      plan2.frontlineWorkerName,
      plan2.frequencyDays,
      plan2.frequencyLabel,
      plan2.startDate,
      null,
      plan2.instructions,
      JSON.stringify(plan2.requiredObservations),
      JSON.stringify(plan2.currentMedications),
      plan2.status,
      plan2.createdAt,
      plan2.updatedAt
    );

    insertTask.run('task_p2_1', plan2.id, plan2.patientId, plan2.patientName, plan2.frontlineWorkerId, plan2.frontlineWorkerName, 1, '2026-08-12T09:00:00.000Z', 'COMPLETED', '2026-08-12T10:30:00.000Z', 'rep_seed_4');
    insertTask.run('task_p2_2', plan2.id, plan2.patientId, plan2.patientName, plan2.frontlineWorkerId, plan2.frontlineWorkerName, 2, '2026-08-19T09:00:00.000Z', 'COMPLETED', '2026-08-19T10:30:00.000Z', 'rep_seed_5');
    insertTask.run('task_p2_3', plan2.id, plan2.patientId, plan2.patientName, plan2.frontlineWorkerId, plan2.frontlineWorkerName, 3, '2026-08-26T09:00:00.000Z', 'DUE', null, null);

    insertReport.run('rep_seed_4', 'task_p2_1', plan2.id, plan2.patientId, plan2.patientName, plan2.frontlineWorkerId, plan2.frontlineWorkerName, 1, 140, 88, 'FULL', 'UNCHANGED', 'Recovering left arm grip, speech mildly dysarthric.', 'Taking all prescribed medications with family support.', 38, 'LOW', 'Post-stroke day 14. Stable recovery, full adherence.', '2026-08-12T10:30:00.000Z');
    insertReport.run('rep_seed_5', 'task_p2_2', plan2.id, plan2.patientId, plan2.patientName, plan2.frontlineWorkerId, plan2.frontlineWorkerName, 2, 124, 78, 'FULL', 'IMPROVED', 'Significant improvement in arm motor power and speech clarity.', 'Patient able to hold a cup with left hand. No headache or dizziness.', 22, 'LOW', 'Risk decreased from 38 to 22 (LOW): Controlled BP (124/78 mmHg); Strict medication adherence; Symptom improvement.', '2026-08-19T10:30:00.000Z');

    insertHistory.run('rh_seed_4', plan2.patientId, 'rep_seed_4', 38, 'LOW', 'STABLE', 'Post-stroke day 14. Stable recovery, full adherence.', '2026-08-12T10:30:00.000Z');
    insertHistory.run('rh_seed_5', plan2.patientId, 'rep_seed_5', 22, 'LOW', 'IMPROVING', 'Risk decreased from 38 to 22 (LOW): Controlled BP (124/78 mmHg); Strict medication adherence; Symptom improvement.', '2026-08-19T10:30:00.000Z');

    // -------------------------------------------------------------
    // PLAN 3: Sunita Hansda (AIIMS Deoghar, CKD Stage 2 & Hypertension)
    // -------------------------------------------------------------
    const plan3Medications: PrescribedMedication[] = [
      {
        id: 'med_p3_1',
        name: 'Amlodipine (Norvasc)',
        dosage: '5 mg',
        frequency: 'Once Daily',
        timing: 'Morning',
        instructions: 'Calcium channel blocker for peripheral vasodilation.',
        adherenceStatus: 'TAKEN'
      },
      {
        id: 'med_p3_2',
        name: 'Metoprolol Succinate',
        dosage: '25 mg',
        frequency: 'Once Daily',
        timing: 'Morning',
        instructions: 'Heart rate and BP control.',
        adherenceStatus: 'TAKEN'
      },
      {
        id: 'med_p3_3',
        name: 'Torsemide (Dytor)',
        dosage: '10 mg',
        frequency: 'Once Daily',
        timing: 'Morning (Empty stomach)',
        instructions: 'Loop diuretic to prevent fluid retention and ankle edema.',
        adherenceStatus: 'MISSED'
      }
    ];

    const plan3: FollowUpPlan = {
      id: 'plan_seed_3',
      patientId: 'P-2041',
      patientName: 'Sunita Hansda',
      patientAge: 52,
      patientSex: 'female',
      patientPhone: '+91-94318-77102',
      patientLocation: 'Sarath, Deoghar',
      doctorId: 'doc_2',
      doctorName: 'Dr. Rajesh Sengupta',
      facilityId: 'fac_aiims_deoghar',
      facilityName: 'All India Institute of Medical Sciences (AIIMS Deoghar)',
      frontlineWorkerId: 'worker_022',
      frontlineWorkerName: 'ASHA Sunita Soren',
      frequencyDays: 7,
      frequencyLabel: 'Every 7 days',
      startDate: '2026-08-15T09:00:00.000Z',
      instructions:
        'Track morning BP, fluid intake restriction (1.5L max), monitor bilateral pedal edema, verify compliance with diuretics.',
      requiredObservations: [
        'blood_pressure',
        'medication_adherence',
        'symptom_progression',
        'general_condition'
      ],
      currentMedications: plan3Medications,
      status: 'ACTIVE',
      createdAt: '2026-08-15T09:00:00.000Z',
      updatedAt: '2026-08-15T09:00:00.000Z'
    };

    insertPlan.run(
      plan3.id,
      plan3.patientId,
      plan3.patientName,
      plan3.patientAge,
      plan3.patientSex,
      plan3.patientPhone || null,
      plan3.patientLocation,
      plan3.doctorId,
      plan3.doctorName,
      plan3.facilityId,
      plan3.facilityName,
      plan3.frontlineWorkerId,
      plan3.frontlineWorkerName,
      plan3.frequencyDays,
      plan3.frequencyLabel,
      plan3.startDate,
      null,
      plan3.instructions,
      JSON.stringify(plan3.requiredObservations),
      JSON.stringify(plan3.currentMedications),
      plan3.status,
      plan3.createdAt,
      plan3.updatedAt
    );

    insertTask.run('task_p3_1', plan3.id, plan3.patientId, plan3.patientName, plan3.frontlineWorkerId, plan3.frontlineWorkerName, 1, '2026-08-15T09:00:00.000Z', 'COMPLETED', '2026-08-15T11:00:00.000Z', 'rep_seed_6');
    insertTask.run('task_p3_2', plan3.id, plan3.patientId, plan3.patientName, plan3.frontlineWorkerId, plan3.frontlineWorkerName, 2, '2026-08-22T09:00:00.000Z', 'COMPLETED', '2026-08-22T11:30:00.000Z', 'rep_seed_7');
    insertTask.run('task_p3_3', plan3.id, plan3.patientId, plan3.patientName, plan3.frontlineWorkerId, plan3.frontlineWorkerName, 3, '2026-08-29T09:00:00.000Z', 'DUE', null, null);

    insertReport.run('rep_seed_6', 'task_p3_1', plan3.id, plan3.patientId, plan3.patientName, plan3.frontlineWorkerId, plan3.frontlineWorkerName, 1, 150, 95, 'FULL', 'UNCHANGED', 'Mild bilateral leg swelling, no breathlessness.', 'Taking BP meds consistently.', 60, 'HIGH', 'Stage 2 Hypertension with mild fluid retention. Adherent to medications.', '2026-08-15T11:00:00.000Z');
    insertReport.run('rep_seed_7', 'task_p3_2', plan3.id, plan3.patientId, plan3.patientName, plan3.frontlineWorkerId, plan3.frontlineWorkerName, 2, 158, 98, 'PARTIAL', 'WORSENED', 'Increasing pedal swelling, stopped diuretic due to frequent urination.', 'Advised family not to stop diuretics without nephrology consult.', 72, 'HIGH', 'Risk escalated to 72 (HIGH): BP 158/98 mmHg, skipped diuretic therapy, worsening ankle edema.', '2026-08-22T11:30:00.000Z');

    insertHistory.run('rh_seed_6', plan3.patientId, 'rep_seed_6', 60, 'HIGH', 'STABLE', 'Stage 2 Hypertension with mild fluid retention.', '2026-08-15T11:00:00.000Z');
    insertHistory.run('rh_seed_7', plan3.patientId, 'rep_seed_7', 72, 'HIGH', 'WORSENING', 'Risk escalated to 72 (HIGH): BP 158/98 mmHg, skipped diuretic therapy.', '2026-08-22T11:30:00.000Z');

    insertAlert.run('alert_seed_2', plan3.patientId, plan3.patientName, plan3.facilityId, plan3.facilityName, 72, 'HIGH', 'CKD 2 patient with BP 158/98 and non-compliance with loop diuretic.', 'BP: 158/98, Adherence: PARTIAL, Symptoms: WORSENED.', plan3.doctorName, plan3.frontlineWorkerName, 'ACTIVE', '2026-08-22T11:30:00.000Z', null);

    // -------------------------------------------------------------
    // PLAN 4: Rajesh Kumar (RIMS Ranchi, T2DM with Neuropathy)
    // -------------------------------------------------------------
    const plan4Medications: PrescribedMedication[] = [
      {
        id: 'med_p4_1',
        name: 'Metformin ER',
        dosage: '500 mg',
        frequency: 'Twice Daily',
        timing: 'With Breakfast & Dinner',
        instructions: 'First line glycemic control.',
        adherenceStatus: 'TAKEN'
      },
      {
        id: 'med_p4_2',
        name: 'Glimepiride',
        dosage: '1 mg',
        frequency: 'Once Daily',
        timing: 'Morning (Before breakfast)',
        instructions: 'Sulfonylurea for post-prandial control.',
        adherenceStatus: 'TAKEN'
      },
      {
        id: 'med_p4_3',
        name: 'Pregabalin + Methylcobalamin',
        dosage: '75 mg / 1500 mcg',
        frequency: 'Once Daily',
        timing: 'Night (Bedtime)',
        instructions: 'For diabetic peripheral burning feet sensation.',
        adherenceStatus: 'TAKEN'
      }
    ];

    const plan4: FollowUpPlan = {
      id: 'plan_seed_4',
      patientId: 'P-3055',
      patientName: 'Rajesh Kumar',
      patientAge: 61,
      patientSex: 'male',
      patientPhone: '+91-94301-33419',
      patientLocation: 'Ratu Road, Ranchi',
      doctorId: 'doc_3',
      doctorName: 'Dr. Ananya Iyer',
      facilityId: 'fac_rims_ranchi',
      facilityName: 'Rajendra Institute of Medical Sciences (RIMS Ranchi)',
      frontlineWorkerId: 'worker_031',
      frontlineWorkerName: 'ASHA Rekha Devi',
      frequencyDays: 14,
      frequencyLabel: 'Every 14 days',
      startDate: '2026-08-18T09:00:00.000Z',
      instructions:
        'Inspect feet for diabetic ulcers or fissures, verify fasting/postprandial self-monitoring, review adherence.',
      requiredObservations: [
        'blood_pressure',
        'medication_adherence',
        'symptom_progression',
        'general_condition'
      ],
      currentMedications: plan4Medications,
      status: 'ACTIVE',
      createdAt: '2026-08-18T09:00:00.000Z',
      updatedAt: '2026-08-18T09:00:00.000Z'
    };

    insertPlan.run(
      plan4.id,
      plan4.patientId,
      plan4.patientName,
      plan4.patientAge,
      plan4.patientSex,
      plan4.patientPhone || null,
      plan4.patientLocation,
      plan4.doctorId,
      plan4.doctorName,
      plan4.facilityId,
      plan4.facilityName,
      plan4.frontlineWorkerId,
      plan4.frontlineWorkerName,
      plan4.frequencyDays,
      plan4.frequencyLabel,
      plan4.startDate,
      null,
      plan4.instructions,
      JSON.stringify(plan4.requiredObservations),
      JSON.stringify(plan4.currentMedications),
      plan4.status,
      plan4.createdAt,
      plan4.updatedAt
    );

    insertTask.run('task_p4_1', plan4.id, plan4.patientId, plan4.patientName, plan4.frontlineWorkerId, plan4.frontlineWorkerName, 1, '2026-08-18T09:00:00.000Z', 'COMPLETED', '2026-08-18T10:00:00.000Z', 'rep_seed_8');
    insertTask.run('task_p4_2', plan4.id, plan4.patientId, plan4.patientName, plan4.frontlineWorkerId, plan4.frontlineWorkerName, 2, '2026-09-01T09:00:00.000Z', 'DUE', null, null);

    insertReport.run('rep_seed_8', 'task_p4_1', plan4.id, plan4.patientId, plan4.patientName, plan4.frontlineWorkerId, plan4.frontlineWorkerName, 1, 126, 80, 'FULL', 'IMPROVED', 'Feet skin intact, burning sensation reduced with Pregabalin.', 'Full medication adherence reported.', 32, 'LOW', 'Baseline diabetic neuropathy follow-up. Normal BP, symptom improvement, excellent adherence.', '2026-08-18T10:00:00.000Z');

    insertHistory.run('rh_seed_8', plan4.patientId, 'rep_seed_8', 32, 'LOW', 'IMPROVING', 'Baseline diabetic neuropathy follow-up. Normal BP, symptom improvement, excellent adherence.', '2026-08-18T10:00:00.000Z');
  }
}
