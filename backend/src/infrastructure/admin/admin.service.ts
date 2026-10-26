import os from 'node:os';
import { AdminTelemetryStore } from './admin-telemetry.store.ts';
import type { SystemOperation, FeatureMetric, AdminSession } from './admin-telemetry.store.ts';
import { AdminDatabaseManager } from './admin-database.manager.ts';
import type { TableMeta } from './admin-database.manager.ts';

export interface AdminLoginResult {
  success: boolean;
  token?: string;
  admin?: {
    id: string;
    email: string;
    name: string;
    role: 'system_admin';
    permissions: string[];
  };
  error?: string;
}

export interface SystemStatusReport {
  timestamp: string;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCount: number;
  memory: {
    totalMb: number;
    freeMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
  pythonAiService: {
    configuredUrl: string;
    status: 'online' | 'offline' | 'checking';
    latencyMs?: number;
  };
  config: Record<string, string>;
  vitals: {
    totalRequests: number;
    overallHealthPercent: number;
    systemStatus: 'healthy' | 'degraded' | 'critical';
    avgSystemLatencyMs: number;
    activeSessions: number;
    activeServicesCount: number;
    errorRatePercent: number;
  };
}

export class AdminService {
  private readonly telemetryStore: AdminTelemetryStore;
  private readonly databaseManager: AdminDatabaseManager;
  private readonly adminEmail: string;
  private readonly adminPassword: string;

  constructor(
    telemetryStore: AdminTelemetryStore,
    databaseManager: AdminDatabaseManager
  ) {
    this.telemetryStore = telemetryStore;
    this.databaseManager = databaseManager;

    // Configurable master credentials with production defaults
    this.adminEmail = (process.env.ADMIN_EMAIL || process.env.MEDVEDA_ADMIN_EMAIL || 'admin@medveda.in').toLowerCase();
    this.adminPassword = process.env.ADMIN_PASSWORD || process.env.MEDVEDA_ADMIN_PASSWORD || 'MedVeda@Admin2026';
  }

  // --- Authentication ---
  public login(identifier: string, password: string): AdminLoginResult {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    const isMatch =
      (cleanId === this.adminEmail ||
       cleanId === 'admin' ||
       cleanId === 'system_admin' ||
       cleanId === 'admin@medveda.gov.in') &&
      cleanPass === this.adminPassword;

    if (!isMatch) {
      return {
        success: false,
        error: 'Invalid administrator credentials. Please check your admin ID and password.'
      };
    }

    const session = this.telemetryStore.createAdminSession(
      cleanId.includes('@') ? cleanId : this.adminEmail,
      'System Master Administrator'
    );

    // Record login operation
    this.telemetryStore.recordOperation({
      module: 'admin',
      moduleName: 'Master Admin Subsystem',
      action: 'ADMIN_AUTHENTICATION_SUCCESS',
      path: '/api/admin/login',
      method: 'POST',
      userId: session.adminId,
      userRole: 'system_admin',
      userName: session.name,
      statusCode: 200,
      durationMs: 14.5,
      details: `Master administrator '${session.email}' logged in successfully.`,
      status: 'success'
    });

    return {
      success: true,
      token: session.token,
      admin: {
        id: session.adminId,
        email: session.email,
        name: session.name,
        role: 'system_admin',
        permissions: ['*']
      }
    };
  }

  public verifyToken(token: string): AdminSession | null {
    return this.telemetryStore.verifyAdminSession(token);
  }

  public logout(token: string): boolean {
    return this.telemetryStore.revokeAdminSession(token);
  }

  // --- Observability & Metrics ---
  public getFeatureMetrics(): FeatureMetric[] {
    return this.telemetryStore.getFeatureMetrics();
  }

  public getOperations(filter?: {
    module?: string;
    role?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): { operations: SystemOperation[]; total: number } {
    return this.telemetryStore.getOperations(filter);
  }

  public logRequest(op: Omit<SystemOperation, 'id' | 'timestamp'>): SystemOperation {
    return this.telemetryStore.recordOperation(op);
  }

  // --- Database Management ---
  public listTables(): TableMeta[] {
    return this.databaseManager.listTables();
  }

  public queryTable(
    storeKey: string,
    tableName: string,
    options?: {
      limit?: number;
      offset?: number;
      filterCol?: string;
      filterVal?: string;
      orderBy?: string;
      orderDir?: 'ASC' | 'DESC';
    }
  ) {
    return this.databaseManager.queryTable(storeKey, tableName, options);
  }

  public updateRecord(storeKey: string, tableName: string, pkCol: string, pkVal: any, updates: Record<string, any>) {
    const res = this.databaseManager.updateRecord(storeKey, tableName, pkCol, pkVal, updates);
    this.telemetryStore.recordOperation({
      module: 'admin',
      moduleName: 'Database Management',
      action: 'DATABASE_RECORD_UPDATED',
      path: `/api/admin/database/${storeKey}/${tableName}`,
      method: 'PATCH',
      userRole: 'system_admin',
      userName: 'Master Admin',
      statusCode: 200,
      durationMs: 12.0,
      details: `Updated table '${tableName}' in store '${storeKey}' (PK ${pkCol}=${pkVal}).`,
      status: 'success'
    });
    return res;
  }

  public insertRecord(storeKey: string, tableName: string, data: Record<string, any>) {
    const res = this.databaseManager.insertRecord(storeKey, tableName, data);
    this.telemetryStore.recordOperation({
      module: 'admin',
      moduleName: 'Database Management',
      action: 'DATABASE_RECORD_INSERTED',
      path: `/api/admin/database/${storeKey}/${tableName}`,
      method: 'POST',
      userRole: 'system_admin',
      userName: 'Master Admin',
      statusCode: 201,
      durationMs: 15.0,
      details: `Inserted new record in table '${tableName}' (Store: ${storeKey}).`,
      status: 'success'
    });
    return res;
  }

  public deleteRecord(storeKey: string, tableName: string, pkCol: string, pkVal: any) {
    const res = this.databaseManager.deleteRecord(storeKey, tableName, pkCol, pkVal);
    this.telemetryStore.recordOperation({
      module: 'admin',
      moduleName: 'Database Management',
      action: 'DATABASE_RECORD_DELETED',
      path: `/api/admin/database/${storeKey}/${tableName}`,
      method: 'DELETE',
      userRole: 'system_admin',
      userName: 'Master Admin',
      statusCode: 200,
      durationMs: 11.0,
      details: `Deleted record in table '${tableName}' (PK ${pkCol}=${pkVal}).`,
      status: 'warning'
    });
    return res;
  }

  public executeRawSql(storeKey: string, sqlQuery: string) {
    const res = this.databaseManager.executeRawSql(storeKey, sqlQuery);
    this.telemetryStore.recordOperation({
      module: 'admin',
      moduleName: 'Database Management',
      action: 'SQL_EXECUTED',
      path: `/api/admin/database/execute`,
      method: 'POST',
      userRole: 'system_admin',
      userName: 'Master Admin',
      statusCode: 200,
      durationMs: res.executionTimeMs,
      details: `Executed custom SQL on store '${storeKey}': ${sqlQuery.substring(0, 100)}...`,
      status: 'success'
    });
    return res;
  }

  public async triggerMigration() {
    const res = await this.databaseManager.triggerMigration();
    this.telemetryStore.recordOperation({
      module: 'admin',
      moduleName: 'Database Management',
      action: 'DATABASE_MIGRATION_EXECUTED',
      path: `/api/admin/database/migrate`,
      method: 'POST',
      userRole: 'system_admin',
      userName: 'Master Admin',
      statusCode: res.success ? 200 : 500,
      durationMs: 45.0,
      details: res.message,
      status: res.success ? 'success' : 'error'
    });
    return res;
  }

  // --- Dynamic Configuration & System Status ---
  public async getSystemStatus(pythonServiceBase: string): Promise<SystemStatusReport> {
    const mem = process.memoryUsage();
    const vitals = this.telemetryStore.getSystemVitals();
    const config = this.telemetryStore.getAllConfig();

    // Check Python AI Service
    let pythonStatus: 'online' | 'offline' | 'checking' = 'offline';
    let pythonLatency = 0;
    try {
      const pStart = performance.now();
      const res = await fetch(`${pythonServiceBase}/api/agent/doctors`, { signal: AbortSignal.timeout(1200) });
      pythonLatency = Math.round((performance.now() - pStart) * 10) / 10;
      if (res.status === 200) {
        pythonStatus = 'online';
      }
    } catch (e) {
      pythonStatus = 'offline';
    }

    const cpus = os.cpus();

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: vitals.uptimeSeconds,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: cpus[0]?.model || 'Unknown CPU',
      cpuCount: cpus.length,
      memory: {
        totalMb: Math.round(os.totalmem() / 1024 / 1024),
        freeMb: Math.round(os.freemem() / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024 * 10) / 10,
        rssMb: Math.round(mem.rss / 1024 / 1024 * 10) / 10
      },
      pythonAiService: {
        configuredUrl: pythonServiceBase,
        status: pythonStatus,
        latencyMs: pythonLatency
      },
      config,
      vitals
    };
  }

  public updateConfig(key: string, value: string): void {
    this.telemetryStore.setConfig(key, value);
    this.telemetryStore.recordOperation({
      module: 'admin',
      moduleName: 'Core System Engine',
      action: 'SYSTEM_CONFIG_UPDATED',
      path: '/api/admin/system/config',
      method: 'POST',
      userRole: 'system_admin',
      userName: 'Master Admin',
      statusCode: 200,
      durationMs: 8.5,
      details: `Config '${key}' updated to '${value}'.`,
      status: 'success'
    });
  }
}
