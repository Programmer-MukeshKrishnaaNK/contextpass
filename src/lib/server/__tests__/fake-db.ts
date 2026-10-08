/**
 * A tiny in-memory stand-in for the Supabase query builder, enough to run the
 * server's real query code in tests. Filters are applied for real, and every
 * query is logged so tests can assert how data was scoped.
 */
type Row = Record<string, unknown>;
type Filter = { op: "eq" | "in" | "lt"; column: string; value: unknown };

export interface QueryLog {
  table: string;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  filters: Filter[];
}

export function createFakeDb(tables: Record<string, Row[]>) {
  const log: QueryLog[] = [];

  class Query implements PromiseLike<{ data: unknown; error: null }> {
    private filters: Filter[] = [];
    private action: QueryLog["action"] = "select";
    private payload: Row | Row[] | undefined;
    private singleMode: "one" | "maybe" | undefined;
    private limitN: number | undefined;

    constructor(private table: string) {}

    select() {
      return this;
    }
    insert(payload: Row | Row[]) {
      this.action = "insert";
      this.payload = payload;
      return this;
    }
    update(payload: Row) {
      this.action = "update";
      this.payload = payload;
      return this;
    }
    upsert(payload: Row) {
      this.action = "upsert";
      this.payload = payload;
      return this;
    }
    delete() {
      this.action = "delete";
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push({ op: "eq", column, value });
      return this;
    }
    in(column: string, value: unknown[]) {
      this.filters.push({ op: "in", column, value });
      return this;
    }
    lt(column: string, value: unknown) {
      this.filters.push({ op: "lt", column, value });
      return this;
    }
    order() {
      return this;
    }
    limit(n: number) {
      this.limitN = n;
      return this;
    }
    maybeSingle() {
      this.singleMode = "maybe";
      return this;
    }
    singleRow() {
      this.singleMode = "one";
      return this;
    }

    private matches(row: Row) {
      return this.filters.every((f) =>
        f.op === "eq"
          ? row[f.column] === f.value
          : f.op === "in"
            ? (f.value as unknown[]).includes(row[f.column])
            : String(row[f.column]) < String(f.value),
      );
    }

    private run() {
      log.push({ table: this.table, action: this.action, filters: [...this.filters] });
      const rows = (tables[this.table] ??= []);
      let data: Row[] = [];
      if (this.action === "select") data = rows.filter((r) => this.matches(r));
      if (this.action === "insert") {
        const items = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((p) => ({ id: crypto.randomUUID(), ...p }));
        rows.push(...items);
        data = items;
      }
      if (this.action === "update") {
        data = rows.filter((r) => this.matches(r));
        for (const r of data) Object.assign(r, this.payload);
      }
      if (this.action === "upsert") {
        const p = this.payload as Row;
        const existing = rows.find((r) => r.privy_user_id === p.privy_user_id);
        if (existing) Object.assign(existing, p);
        else rows.push({ id: crypto.randomUUID(), ...p });
        data = [existing ?? rows[rows.length - 1]];
      }
      if (this.action === "delete") {
        data = rows.filter((r) => this.matches(r));
        tables[this.table] = rows.filter((r) => !data.includes(r));
      }
      if (this.limitN !== undefined) data = data.slice(0, this.limitN);
      const out = this.singleMode ? (data[0] ?? null) : data;
      return { data: out, error: null };
    }

    then<T1, T2>(onfulfilled?: (v: { data: unknown; error: null }) => T1 | PromiseLike<T1>, onrejected?: (e: unknown) => T2 | PromiseLike<T2>) {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }
  }

  // supabase-js names it `.single()`.
  const proto = Query.prototype as unknown as Record<string, unknown>;
  proto.single = proto.singleRow;

  return {
    client: { from: (table: string) => new Query(table) },
    log,
    tables,
  };
}
