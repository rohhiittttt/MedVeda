import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrate.ts';

export interface TableColumnMeta {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

export interface TableMeta {
  storeKey: string;
  storeName: string;
  tableName: string;
  rowCount: number;
  primaryKey: string;
  columns: TableColumnMeta[];
}

export class AdminDatabaseManager {
  private readonly stores: Map<string, { name: string; db: DatabaseSync }> = new Map();

  constructor(storesConfig: Record<string, { name: string; store: any }>) {
    Object.entries(storesConfig).forEach(([key, conf]) => {
      const rawStore = conf.store;
      const dbInstance: DatabaseSync =
        rawStore?.getDatabase?.() ||
        rawStore?.db ||
        rawStore;

      if (dbInstance && typeof dbInstance.exec === 'function') {
        this.stores.set(key, { name: conf.name, db: dbInstance });
      }
    });
  }

  public registerStore(key: string, name: string, store: any): void {
    const dbInstance: DatabaseSync =
      store?.getDatabase?.() ||
      store?.db ||
      store;

    if (dbInstance && typeof dbInstance.exec === 'function') {
      this.stores.set(key, { name, db: dbInstance });
    }
  }

  public listStores(): { key: string; name: string }[] {
    return Array.from(this.stores.entries()).map(([key, item]) => ({
      key,
      name: item.name
    }));
  }

  public listTables(): TableMeta[] {
    const results: TableMeta[] = [];

    this.stores.forEach(({ name: storeName, db }, storeKey) => {
      try {
        const tableRows = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
        ).all() as { name: string }[];

        tableRows.forEach(t => {
          const tableName = t.name;
          try {
            // Get Columns
            const colRows = db.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];
            const columns: TableColumnMeta[] = colRows.map(c => ({
              cid: c.cid,
              name: c.name,
              type: c.type || 'TEXT',
              notnull: c.notnull,
              dflt_value: c.dflt_value,
              pk: c.pk
            }));

            // Identify Primary Key
            const pkCol = columns.find(c => c.pk > 0)?.name || columns[0]?.name || 'id';

            // Get Row Count
            const countRow = db.prepare(`SELECT count(*) as count FROM "${tableName}"`).get() as any;
            const rowCount = countRow ? Number(countRow.count) : 0;

            results.push({
              storeKey,
              storeName,
              tableName,
              rowCount,
              primaryKey: pkCol,
              columns
            });
          } catch (tblErr) {
            // Ignore single table inspection failure
          }
        });
      } catch (storeErr) {
        // Store read error ignored
      }
    });

    return results;
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
  ): { columns: string[]; rows: any[]; total: number; limit: number; offset: number } {
    const storeEntry = this.stores.get(storeKey);
    if (!storeEntry) {
      throw new Error(`Store '${storeKey}' not found.`);
    }

    const { db } = storeEntry;
    const cleanTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const limit = Math.min(Math.max(1, options?.limit || 25), 250);
    const offset = Math.max(0, options?.offset || 0);

    // Get count
    let countSql = `SELECT count(*) as count FROM "${cleanTable}"`;
    const countParams: any[] = [];
    if (options?.filterCol && options?.filterVal !== undefined && options.filterVal !== '') {
      const cleanCol = options.filterCol.replace(/[^a-zA-Z0-9_]/g, '');
      countSql += ` WHERE "${cleanCol}" LIKE ?`;
      countParams.push(`%${options.filterVal}%`);
    }

    const countStmt = db.prepare(countSql);
    const totalRow = countParams.length > 0 ? countStmt.get(...countParams) as any : countStmt.get() as any;
    const total = totalRow ? Number(totalRow.count) : 0;

    // Get rows
    let selectSql = `SELECT * FROM "${cleanTable}"`;
    const selectParams: any[] = [];
    if (options?.filterCol && options?.filterVal !== undefined && options.filterVal !== '') {
      const cleanCol = options.filterCol.replace(/[^a-zA-Z0-9_]/g, '');
      selectSql += ` WHERE "${cleanCol}" LIKE ?`;
      selectParams.push(`%${options.filterVal}%`);
    }

    if (options?.orderBy) {
      const cleanOrder = options.orderBy.replace(/[^a-zA-Z0-9_]/g, '');
      const dir = options.orderDir === 'DESC' ? 'DESC' : 'ASC';
      selectSql += ` ORDER BY "${cleanOrder}" ${dir}`;
    }

    selectSql += ` LIMIT ? OFFSET ?`;
    selectParams.push(limit, offset);

    const rowsStmt = db.prepare(selectSql);
    const rows = rowsStmt.all(...selectParams) as any[];

    // Extract columns from schema
    const colRows = db.prepare(`PRAGMA table_info("${cleanTable}")`).all() as any[];
    const columns = colRows.map(c => c.name);

    return {
      columns,
      rows,
      total,
      limit,
      offset
    };
  }

  public updateRecord(
    storeKey: string,
    tableName: string,
    pkCol: string,
    pkVal: any,
    updates: Record<string, any>
  ): { success: boolean; changes: number } {
    const storeEntry = this.stores.get(storeKey);
    if (!storeEntry) throw new Error(`Store '${storeKey}' not found.`);

    const { db } = storeEntry;
    const cleanTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const cleanPk = pkCol.replace(/[^a-zA-Z0-9_]/g, '');

    const fields = Object.keys(updates).filter(k => k !== cleanPk);
    if (fields.length === 0) return { success: true, changes: 0 };

    const setClauses = fields.map(f => `"${f.replace(/[^a-zA-Z0-9_]/g, '')}" = ?`).join(', ');
    const sql = `UPDATE "${cleanTable}" SET ${setClauses} WHERE "${cleanPk}" = ?`;

    const values = fields.map(f => {
      const v = updates[f];
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
    });
    values.push(pkVal);

    const stmt = db.prepare(sql);
    const result = stmt.run(...values) as any;

    return {
      success: true,
      changes: result?.changes || 1
    };
  }

  public insertRecord(
    storeKey: string,
    tableName: string,
    data: Record<string, any>
  ): { success: boolean; insertedId?: any } {
    const storeEntry = this.stores.get(storeKey);
    if (!storeEntry) throw new Error(`Store '${storeKey}' not found.`);

    const { db } = storeEntry;
    const cleanTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    const fields = Object.keys(data);
    if (fields.length === 0) throw new Error('No fields provided for insertion.');

    const colNames = fields.map(f => `"${f.replace(/[^a-zA-Z0-9_]/g, '')}"`).join(', ');
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO "${cleanTable}" (${colNames}) VALUES (${placeholders})`;

    const values = fields.map(f => {
      const v = data[f];
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
    });

    const stmt = db.prepare(sql);
    const result = stmt.run(...values) as any;

    return {
      success: true,
      insertedId: result?.lastInsertRowid || data.id || null
    };
  }

  public deleteRecord(
    storeKey: string,
    tableName: string,
    pkCol: string,
    pkVal: any
  ): { success: boolean; changes: number } {
    const storeEntry = this.stores.get(storeKey);
    if (!storeEntry) throw new Error(`Store '${storeKey}' not found.`);

    const { db } = storeEntry;
    const cleanTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const cleanPk = pkCol.replace(/[^a-zA-Z0-9_]/g, '');

    const sql = `DELETE FROM "${cleanTable}" WHERE "${cleanPk}" = ?`;
    const stmt = db.prepare(sql);
    const result = stmt.run(pkVal) as any;

    return {
      success: true,
      changes: result?.changes || 1
    };
  }

  public executeRawSql(
    storeKey: string,
    sqlQuery: string
  ): { success: boolean; isSelect: boolean; columns?: string[]; rows?: any[]; changes?: number; executionTimeMs: number } {
    const storeEntry = this.stores.get(storeKey);
    if (!storeEntry) throw new Error(`Store '${storeKey}' not found.`);

    const { db } = storeEntry;
    const trimmed = sqlQuery.trim();
    const isSelect = /^SELECT\b/i.test(trimmed) || /^PRAGMA\b/i.test(trimmed);

    const startTime = performance.now();

    try {
      if (isSelect) {
        const stmt = db.prepare(trimmed);
        const rows = stmt.all() as any[];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        const duration = Math.round((performance.now() - startTime) * 10) / 10;
        return {
          success: true,
          isSelect: true,
          columns,
          rows: rows.slice(0, 100), // Protect against unbounded rendering
          executionTimeMs: duration
        };
      } else {
        const stmt = db.prepare(trimmed);
        const res = stmt.run() as any;
        const duration = Math.round((performance.now() - startTime) * 10) / 10;
        return {
          success: true,
          isSelect: false,
          changes: res?.changes || 0,
          executionTimeMs: duration
        };
      }
    } catch (err: any) {
      throw new Error(`SQL Execution Error: ${err.message}`);
    }
  }

  public async triggerMigration(): Promise<{ success: boolean; message: string; timestamp: string }> {
    try {
      await runMigrations();
      return {
        success: true,
        message: 'Database schema migration executed successfully across all stores.',
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Migration failed: ${err.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}
