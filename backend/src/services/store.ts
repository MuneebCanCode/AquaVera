/**
 * In-memory data store — replaces Supabase for zero-dependency deployment.
 * Data lives in the Express process and seeds on startup.
 * Provides a fluent query API compatible with how services use Supabase.
 */

import type {
  User, WaterProject, SensorReading, WscMintingEvent,
  MarketplaceListing, Trade, Retirement, CommunityReward,
  Notification, ComplianceReport, ScheduledTransaction,
} from '../types';

// ─── Table Types ─────────────────────────────────────────────────────────────

type TableName =
  | 'users' | 'water_projects' | 'sensor_readings' | 'wsc_minting_events'
  | 'marketplace_listings' | 'trades' | 'retirements' | 'community_rewards'
  | 'notifications' | 'compliance_reports' | 'scheduled_transactions';

type TableRecord =
  | User | WaterProject | SensorReading | WscMintingEvent
  | MarketplaceListing | Trade | Retirement | CommunityReward
  | Notification | ComplianceReport | ScheduledTransaction;

// ─── Store ───────────────────────────────────────────────────────────────────

const tables: Record<string, Record<string, unknown>[]> = {
  users: [],
  water_projects: [],
  sensor_readings: [],
  wsc_minting_events: [],
  marketplace_listings: [],
  trades: [],
  retirements: [],
  community_rewards: [],
  notifications: [],
  compliance_reports: [],
  scheduled_transactions: [],
};

/** Direct access to raw table arrays (for seeding) */
export function getTable<T = Record<string, unknown>>(name: string): T[] {
  if (!tables[name]) tables[name] = [];
  return tables[name] as T[];
}

/** Clear all data (for testing) */
export function clearAll(): void {
  for (const key of Object.keys(tables)) {
    tables[key] = [];
  }
}

// ─── Fluent Query Builder (Supabase-compatible API) ──────────────────────────

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike';

interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
}

interface OrderSpec {
  column: string;
  ascending: boolean;
}

class QueryBuilder<T = any> {
  private tableName: string;
  private filters: Filter[] = [];
  private orders: OrderSpec[] = [];
  private limitVal: number | null = null;
  private offsetVal: number = 0;
  private selectColumns: string[] | null = null;
  private countMode: 'exact' | null = null;
  private headMode = false;
  private singleMode = false;
  private insertData: any | any[] | null = null;
  private updateData: Record<string, unknown> | null = null;
  private deleteMode = false;
  private upsertMode = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns?: string, opts?: { count?: 'exact'; head?: boolean }): this {
    if (columns && columns !== '*') {
      this.selectColumns = columns.split(',').map(c => c.trim());
    }
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headMode = true;
    return this;
  }

  insert(data: any | any[]): this {
    this.insertData = data;
    return this;
  }

  upsert(data: any | any[]): this {
    this.insertData = data;
    this.upsertMode = true;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.deleteMode = true;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ column, op: 'gt', value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }

  like(column: string, pattern: string): this {
    this.filters.push({ column, op: 'like', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters.push({ column, op: 'ilike', value: pattern });
    return this;
  }

  is(column: string, value: null): this {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.limitVal = n;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetVal = from;
    this.limitVal = to - from + 1;
    return this;
  }

  single(): { data: any; error: any; count?: number } {
    this.singleMode = true;
    const result = this.execute();
    const row = (result.data as any[])?.length ? (result.data as any[])[0] : null;
    return { data: row, error: null, count: result.count };
  }

  maybeSingle(): { data: any; error: any; count?: number } {
    return this.single();
  }

  then(resolve: (value: { data: any[] | null; error: any; count?: number }) => void): void {
    resolve(this.execute());
  }

  execute(): { data: any[] | null; error: any; count?: number } {
    const table = getTable(this.tableName);

    // INSERT
    if (this.insertData !== null) {
      const rows = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      for (const row of rows) {
        table.push({ ...row });
      }
      // If select columns were chained after insert, return inserted data
      if (this.selectColumns !== null || this.singleMode) {
        const inserted = rows as any[];
        return { data: inserted, error: null };
      }
      return { data: null, error: null };
    }

    // DELETE
    if (this.deleteMode) {
      const before = table.length;
      const filtered = table.filter(row => !this.matchesFilters(row));
      tables[this.tableName] = filtered;
      return { data: null, error: null };
    }

    // UPDATE
    if (this.updateData !== null) {
      let updated: Record<string, unknown>[] = [];
      for (const row of table) {
        if (this.matchesFilters(row)) {
          Object.assign(row, this.updateData);
          updated.push(row);
        }
      }
      // If select() was chained, return updated rows
      if (this.selectColumns !== null || this.singleMode) {
        return { data: this.projectColumns(updated) as any[], error: null };
      }
      return { data: null, error: null };
    }

    // SELECT
    let rows = table.filter(row => this.matchesFilters(row));

    // Count before pagination
    const count = this.countMode ? rows.length : undefined;

    if (this.headMode) {
      return { data: null, error: null, count };
    }

    // Order
    for (const o of this.orders.reverse()) {
      rows.sort((a, b) => {
        const av = (a as Record<string, unknown>)[o.column];
        const bv = (b as Record<string, unknown>)[o.column];
        if (av == null && bv == null) return 0;
        if (av == null) return o.ascending ? -1 : 1;
        if (bv == null) return o.ascending ? 1 : -1;
        if (av < bv) return o.ascending ? -1 : 1;
        if (av > bv) return o.ascending ? 1 : -1;
        return 0;
      });
    }

    // Pagination
    if (this.offsetVal > 0) rows = rows.slice(this.offsetVal);
    if (this.limitVal !== null) rows = rows.slice(0, this.limitVal);

    // Project columns
    const projected = this.projectColumns(rows);

    return { data: projected as any[], error: null, count };
  }

  private matchesFilters(row: Record<string, unknown>): boolean {
    for (const f of this.filters) {
      const val = row[f.column];
      switch (f.op) {
        case 'eq': if (f.value === null ? (val !== null && val !== undefined) : val !== f.value) return false; break;
        case 'neq': if (val === f.value) return false; break;
        case 'gt': if (!(val as number > (f.value as number))) return false; break;
        case 'gte': if (!(val as number >= (f.value as number))) return false; break;
        case 'lt': if (!(val as number < (f.value as number))) return false; break;
        case 'lte': if (!(val as number <= (f.value as number))) return false; break;
        case 'in': if (!(f.value as unknown[]).includes(val)) return false; break;
        case 'like': {
          const pattern = (f.value as string).replace(/%/g, '.*');
          if (!new RegExp(`^${pattern}$`).test(String(val))) return false;
          break;
        }
        case 'ilike': {
          const pattern = (f.value as string).replace(/%/g, '.*');
          if (!new RegExp(`^${pattern}$`, 'i').test(String(val))) return false;
          break;
        }
      }
    }
    return true;
  }

  private projectColumns(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    if (!this.selectColumns) return rows;
    return rows.map(row => {
      const projected: Record<string, unknown> = {};
      for (const col of this.selectColumns!) {
        projected[col] = row[col];
      }
      return projected;
    });
  }
}

// ─── Public API (drop-in replacement for getSupabase()) ──────────────────────

export interface InMemoryDB {
  from: (table: string) => QueryBuilder<any>;
  auth: {
    admin: {
      createUser: (opts: { email: string; password: string; email_confirm?: boolean }) =>
        Promise<{ data: { user: { id: string } } | null; error: { message: string } | null }>;
      deleteUser: (id: string) => Promise<{ error: null }>;
      listUsers: () => Promise<{ data: { users: { id: string; email: string }[] }; error: null }>;
    };
    getUser: (token: string) =>
      Promise<{ data: { user: { id: string; email: string } | null }; error: { message: string } | null }>;
    signInWithPassword: (opts: { email: string; password: string }) =>
      Promise<{ data: { user: { id: string }; session: { access_token: string } } | null; error: { message: string } | null }>;
  };
  storage: {
    from: (bucket: string) => {
      upload: (path: string, data: unknown, opts?: any) => Promise<{ data: { path: string } | null; error: any }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
}

/** Password store (email → hashed password) — separate from user records */
const passwords: Map<string, string> = new Map();

/** Token store (token → userId) */
const tokens: Map<string, string> = new Map();

export function getPasswordStore(): Map<string, string> {
  return passwords;
}

export function getTokenStore(): Map<string, string> {
  return tokens;
}

function simpleHash(str: string): string {
  // Simple hash for demo passwords (not bcrypt — fine for testnet demo)
  const { createHash } = require('crypto');
  return createHash('sha256').update(str).digest('hex');
}

function generateToken(): string {
  const { randomBytes } = require('crypto');
  return randomBytes(32).toString('hex');
}

/**
 * Get the in-memory DB client (drop-in replacement for getSupabase()).
 */
export function getDB(): InMemoryDB {
  return {
    from: (table: string) => new QueryBuilder(table),

    auth: {
      admin: {
        createUser: async (opts) => {
          const existing = getTable<Record<string, unknown>>('users').find(u => u.email === opts.email);
          if (existing) return { data: null, error: { message: 'User already exists' } };
          const id = require('uuid').v4();
          passwords.set(opts.email, simpleHash(opts.password));
          return { data: { user: { id } }, error: null };
        },
        deleteUser: async (id: string) => {
          const user = getTable<Record<string, unknown>>('users').find(u => u.id === id);
          if (user) passwords.delete(user.email as string);
          tables['users'] = getTable('users').filter(u => (u as Record<string, unknown>).id !== id);
          return { error: null };
        },
        listUsers: async () => {
          const users = getTable<Record<string, unknown>>('users').map(u => ({
            id: u.id as string,
            email: u.email as string,
          }));
          return { data: { users }, error: null };
        },
      },
      getUser: async (token: string) => {
        const userId = tokens.get(token);
        if (!userId) return { data: { user: null }, error: { message: 'Invalid token' } };
        const user = getTable<Record<string, unknown>>('users').find(u => u.id === userId);
        if (!user) return { data: { user: null }, error: { message: 'User not found' } };
        return { data: { user: { id: user.id as string, email: user.email as string } }, error: null };
      },
      signInWithPassword: async (opts) => {
        const hashed = simpleHash(opts.password);
        const stored = passwords.get(opts.email);
        if (!stored || stored !== hashed) {
          return { data: null, error: { message: 'Invalid credentials' } };
        }
        const user = getTable<Record<string, unknown>>('users').find(u => u.email === opts.email);
        if (!user) return { data: null, error: { message: 'User not found' } };
        const token = generateToken();
        tokens.set(token, user.id as string);
        return {
          data: { user: { id: user.id as string }, session: { access_token: token } },
          error: null,
        };
      },
    },

    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, _data: unknown, _opts?: any) => {
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => {
          return { data: { publicUrl: `/storage/${path}` } };
        },
      }),
    },
  };
}

// Backward-compatible alias
export function getSupabase(): InMemoryDB {
  return getDB();
}
