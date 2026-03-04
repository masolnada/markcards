// Shim that maps bun:sqlite API → node:sqlite (for use in vitest/Node.js context)
import { DatabaseSync } from 'node:sqlite';
import type { StatementSync } from 'node:sqlite';

class Statement<T, P extends unknown[]> {
  constructor(private stmt: StatementSync) {}

  get(...params: P): T | null {
    const result = this.stmt.get(...(params as unknown[])) as T | undefined;
    return result ?? null;
  }

  all(...params: P): T[] {
    return this.stmt.all(...(params as unknown[])) as T[];
  }

  run(...params: P): void {
    this.stmt.run(...(params as unknown[]));
  }
}

export class Database {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  query<T = unknown, P extends unknown[] = unknown[]>(sql: string): Statement<T, P> {
    return new Statement<T, P>(this.db.prepare(sql));
  }
}
