import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { D1Database, D1PreparedStatement, D1Result } from './d1Types.ts';

class SqlitePreparedStatement implements D1PreparedStatement {
  private readonly db: DatabaseSync;
  private readonly sql: string;
  private readonly params: SQLInputValue[];

  constructor(db: DatabaseSync, sql: string, params: SQLInputValue[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new SqlitePreparedStatement(
      this.db,
      this.sql,
      values.map((v) => (v === undefined ? null : (v as SQLInputValue)))
    );
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.params) as Record<string, unknown> | undefined;
    if (!row) return null;
    if (colName) {
      return (row[colName] as T) ?? null;
    }
    return row as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...this.params) as T[];
    return {
      results: rows,
      success: true,
      meta: { changes: 0 },
    };
  }

  runSync(): D1Result {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...this.params);
    return {
      results: [],
      success: true,
      meta: {
        changes: Number(info.changes ?? 0),
        last_row_id: Number(info.lastInsertRowid ?? 0),
      },
    };
  }

  async run(): Promise<D1Result> {
    return this.runSync();
  }
}

export class LocalSqliteD1Adapter implements D1Database {
  public readonly sqlite: DatabaseSync;

  constructor(dbPath = ':memory:') {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.sqlite = new DatabaseSync(dbPath);
    this.sqlite.exec('PRAGMA foreign_keys = ON;');
  }

  applyMigration(sqlContent: string): void {
    this.sqlite.exec(sqlContent);
  }

  prepare(query: string): D1PreparedStatement {
    return new SqlitePreparedStatement(this.sqlite, query);
  }

  async batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[]
  ): Promise<D1Result<T>[]> {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        const res =
          stmt instanceof SqlitePreparedStatement
            ? stmt.runSync()
            : await stmt.run();
        results.push(res as D1Result<T>);
      }
      this.sqlite.exec('COMMIT');
      return results;
    } catch (err) {
      this.sqlite.exec('ROLLBACK');
      throw err;
    }
  }

  async exec(query: string): Promise<unknown> {
    this.sqlite.exec(query);
    return { ok: true };
  }
}
