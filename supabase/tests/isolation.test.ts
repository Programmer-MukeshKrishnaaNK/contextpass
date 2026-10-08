/**
 * Database isolation tests.
 *
 * Runs the real migrations against PGlite (Postgres in-process) with a small
 * shim for Supabase's roles and auth.jwt(), then attacks the policies as
 * anon, as user A, and as user B.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const migrations = readdirSync(join(root, "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(root, "migrations", f), "utf8"));

const A = "did:privy:user-a";
const B = "did:privy:user-b";

let db: PGlite;
let aId: string;
let bId: string;
let bItem: string;

/** Run `sql` as a Supabase role, optionally with JWT claims, inside a transaction that is rolled back. */
async function as<T = Record<string, unknown>>(
  role: "anon" | "authenticated",
  sub: string | null,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [sub ? JSON.stringify({ sub, role }) : ""]);
    await db.exec(`set local role ${role}`);
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("rollback");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(root, "tests", "supabase-shim.sql"), "utf8"));
  for (const m of migrations) await db.exec(m);
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("delete from public.activity_events; delete from public.permission_requests; delete from public.context_items; delete from public.profiles;");
  aId = (await db.query<{ id: string }>(`insert into public.profiles (privy_user_id) values ($1) returning id`, [A])).rows[0].id;
  bId = (await db.query<{ id: string }>(`insert into public.profiles (privy_user_id) values ($1) returning id`, [B])).rows[0].id;
  await db.query(`insert into public.context_items (owner_id, scope, title, content) values ($1, 'projects', 'A project', 'A secret')`, [aId]);
  bItem = (
    await db.query<{ id: string }>(
      `insert into public.context_items (owner_id, scope, title, content) values ($1, 'projects', 'B project', 'B secret') returning id`,
      [bId],
    )
  ).rows[0].id;
});

describe("context isolation", () => {
  it("user A reads only their own context", async () => {
    const { rows } = await as<{ title: string }>("authenticated", A, `select title from public.context_items`);
    expect(rows.map((r) => r.title)).toEqual(["A project"]);
  });

  it("user A cannot read user B's context by id", async () => {
    const { rows } = await as("authenticated", A, `select * from public.context_items where id = $1`, [bItem]);
    expect(rows).toHaveLength(0);
  });

  it("user A cannot update user B's context", async () => {
    const { affectedRows } = await as("authenticated", A, `update public.context_items set content = 'pwned' where id = $1`, [bItem]);
    expect(affectedRows).toBe(0);
    const { rows } = await db.query<{ content: string }>(`select content from public.context_items where id = $1`, [bItem]);
    expect(rows[0].content).toBe("B secret");
  });

  it("user A cannot move their own item to user B", async () => {
    await expect(
      as("authenticated", A, `update public.context_items set owner_id = $1 where owner_id = $2`, [bId, aId]),
    ).rejects.toThrow(/row-level security/);
  });

  it("user A cannot delete user B's context", async () => {
    const { affectedRows } = await as("authenticated", A, `delete from public.context_items where id = $1`, [bItem]);
    expect(affectedRows).toBe(0);
    const { rows } = await db.query(`select 1 from public.context_items where id = $1`, [bItem]);
    expect(rows).toHaveLength(1);
  });

  it("user A cannot insert context as user B", async () => {
    await expect(
      as("authenticated", A, `insert into public.context_items (owner_id, scope, title, content) values ($1, 'about', 'x', 'y')`, [bId]),
    ).rejects.toThrow(/row-level security/);
  });

  it("a JWT for an unknown subject sees nothing", async () => {
    const { rows } = await as("authenticated", "did:privy:nobody", `select * from public.context_items`);
    expect(rows).toHaveLength(0);
  });
});

describe("unauthenticated access", () => {
  it("anon cannot read context", async () => {
    await expect(as("anon", null, `select * from public.context_items`)).rejects.toThrow(/permission denied/);
  });

  it("anon cannot write context", async () => {
    await expect(
      as("anon", null, `insert into public.context_items (owner_id, scope, title, content) values ($1, 'about', 'x', 'y')`, [aId]),
    ).rejects.toThrow(/permission denied/);
  });

  it("anon cannot read profiles, requests or activity", async () => {
    for (const table of ["profiles", "permission_requests", "activity_events"]) {
      await expect(as("anon", null, `select * from public.${table}`)).rejects.toThrow(/permission denied/);
    }
  });

  it("anon can read the active app registry, and only that", async () => {
    const { rows } = await as<{ slug: string }>("anon", null, `select slug from public.apps order by slug`);
    expect(rows.map((r) => r.slug)).toEqual(["code-pilot", "margin", "study-os"]);
  });
});

describe("server-only records", () => {
  beforeEach(async () => {
    const app = (await db.query<{ id: string }>(`select id from public.apps where slug = 'code-pilot'`)).rows[0].id;
    await db.query(
      `insert into public.permission_requests (owner_id, app_id, requested_scopes, duration, reason) values ($1, $2, array['projects']::public.context_scope[], '1d', 'r'), ($3, $2, array['projects']::public.context_scope[], '1d', 'r')`,
      [aId, app, bId],
    );
    await db.query(`insert into public.activity_events (owner_id, type) values ($1, 'requested'), ($2, 'requested')`, [aId, bId]);
  });

  it("owners see only their own requests and activity", async () => {
    expect((await as("authenticated", A, `select * from public.permission_requests`)).rows).toHaveLength(1);
    expect((await as("authenticated", A, `select * from public.activity_events`)).rows).toHaveLength(1);
  });

  it("clients cannot approve requests or forge activity", async () => {
    await expect(as("authenticated", A, `update public.permission_requests set status = 'denied', decision_at = now()`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(as("authenticated", A, `insert into public.activity_events (owner_id, type) values ($1, 'allowed')`, [aId])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("clients cannot edit the app registry or profiles", async () => {
    await expect(as("authenticated", A, `update public.apps set name = 'x'`)).rejects.toThrow(/permission denied/);
    await expect(as("authenticated", A, `update public.profiles set wallet_address = null`)).rejects.toThrow(/permission denied/);
  });
});

describe("schema guarantees", () => {
  it("an approved request must carry its chain record", async () => {
    const app = (await db.query<{ id: string }>(`select id from public.apps where slug = 'code-pilot'`)).rows[0].id;
    await expect(
      db.query(
        `insert into public.permission_requests (owner_id, app_id, requested_scopes, duration, reason, status, decision_at) values ($1, $2, array['projects']::public.context_scope[], '1d', 'r', 'approved', now())`,
        [aId, app],
      ),
    ).rejects.toThrow(/approved_has_chain_record/);
  });

  it("rejects unknown scopes", async () => {
    await expect(
      db.query(`insert into public.context_items (owner_id, scope, title, content) values ($1, 'passwords', 'x', 'y')`, [aId]),
    ).rejects.toThrow(/context_scope/);
  });
});
