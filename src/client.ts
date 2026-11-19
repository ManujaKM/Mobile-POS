import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>

const STORAGE_KEY = 'mentura-local-pos'
const LOCAL_USER = 'local-till'

type Filter =
  | { kind: 'eq' | 'gte' | 'lt' | 'like'; column: string; value: unknown }
  | { kind: 'in'; column: string; value: unknown[] }

function readTables(): Tables {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Tables
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeTables(tables: Tables) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tables))
}

function same(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (left == null || right == null) return left == null && right == null
  return String(left) === String(right)
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left ?? '').localeCompare(String(right ?? ''))
}

function like(value: unknown, pattern: string): boolean {
  const source = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${source}$`).test(String(value ?? ''))
}

function matches(row: Row, filter: Filter): boolean {
  const value = row[filter.column]
  if (filter.kind === 'eq') return same(value, filter.value)
  if (filter.kind === 'in') return filter.value.some((item) => same(value, item))
  if (filter.kind === 'like') return like(value, String(filter.value ?? ''))
  if (filter.kind === 'gte') return compare(value, filter.value) >= 0
  return compare(value, filter.value) < 0
}

class LocalQuery {
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private filters: Filter[] = []
  private sort: { column: string; ascending: boolean } | null = null
  private start = 0
  private end = Number.POSITIVE_INFINITY
  private payload: Row[] = []
  private shape: 'many' | 'single' | 'maybe' = 'many'

  constructor(private readonly table: string) {}

  select(): this {
    return this
  }

  insert(row: Row | Row[]): this {
    this.operation = 'insert'
    const rows = Array.isArray(row) ? row : [row]
    this.payload = rows.map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...item,
    }))
    return this
  }

  update(patch: Row): this {
    this.operation = 'update'
    this.payload = [patch]
    return this
  }

  delete(): this {
    this.operation = 'delete'
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: 'eq', column, value })
    return this
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ kind: 'gte', column, value })
    return this
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ kind: 'lt', column, value })
    return this
  }

  like(column: string, value: string): this {
    this.filters.push({ kind: 'like', column, value })
    return this
  }

  in(column: string, value: unknown[]): this {
    this.filters.push({ kind: 'in', column, value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.sort = { column, ascending: options?.ascending !== false }
    return this
  }

  limit(count: number): this {
    this.end = this.start + count - 1
    return this
  }

  range(from: number, to: number): this {
    this.start = from
    this.end = to
    return this
  }

  maybeSingle(): this {
    this.shape = 'maybe'
    return this
  }

  single(): this {
    this.shape = 'single'
    return this
  }

  then<TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }

  private execute(): { data: unknown; error: { message: string } | null } {
    const tables = readTables()
    const rows = tables[this.table] ?? []
    if (this.operation === 'insert') {
      tables[this.table] = [...rows, ...this.payload]
      writeTables(tables)
      return this.pack(this.payload.map((row) => ({ ...row })))
    }
    const matched = rows.filter((row) => this.filters.every((filter) => matches(row, filter)))
    if (this.operation === 'update') {
      const patch = this.payload[0] ?? {}
      for (const row of rows) {
        if (this.filters.every((filter) => matches(row, filter))) Object.assign(row, patch)
      }
      tables[this.table] = rows
      writeTables(tables)
      return this.pack(matched.map((row) => ({ ...row, ...patch })))
    }
    if (this.operation === 'delete') {
      tables[this.table] = rows.filter((row) => !this.filters.every((filter) => matches(row, filter)))
      writeTables(tables)
      return { data: null, error: null }
    }
    const sorted = [...matched]
    if (this.sort) {
      const { column, ascending } = this.sort
      sorted.sort((left, right) => {
        const delta = compare(left[column], right[column])
        return ascending ? delta : -delta
      })
    }
    const sliceEnd = Number.isFinite(this.end) ? this.end + 1 : sorted.length
    return this.pack(sorted.slice(this.start, sliceEnd))
  }

  private pack(rows: Row[]): { data: unknown; error: { message: string } | null } {
    if (this.shape === 'many') return { data: rows, error: null }
    if (rows.length > 1) return { data: null, error: { message: 'More than one row' } }
    if (rows.length === 0) {
      return this.shape === 'maybe'
        ? { data: null, error: null }
        : { data: null, error: { message: 'No rows' } }
    }
    return { data: rows[0], error: null }
  }
}

const localClient = {
  from(table: string) {
    return new LocalQuery(table)
  },
  auth: {
    async getUser() {
      return { data: { user: { id: LOCAL_USER } }, error: null }
    },
    async getSession() {
      return { data: { session: null }, error: null }
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } }
    },
    async signOut() {
      return { error: null }
    },
  },
}

export function getClient(): SupabaseClient {
  return localClient as unknown as SupabaseClient
}
