/**
 * Security tests for the ContextPass access gate.
 *
 * Runs the real route handler and gate code with Monad and Supabase stubbed,
 * then tries to get context it shouldn't.
 */
import type { Address, Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appKey, permissionId, scopeKey } from "@/lib/chain/ids";
import type { ChainRecord } from "@/lib/chain/permissions";
import { createFakeDb } from "./fake-db";

const WALLET_A = "0x00000000000000000000000000000000000000a1" as Address;
const WALLET_B = "0x00000000000000000000000000000000000000b2" as Address;
const OWNER_A = { id: "owner-a", privyUserId: "did:privy:a", wallet: WALLET_A };
const OWNER_B = { id: "owner-b", privyUserId: "did:privy:b", wallet: WALLET_B };

/* ── Stubs ─────────────────────────────────────────────────── */

const chain = vi.hoisted(() => ({
  records: new Map<string, ChainRecord[]>(),
  active: new Set<string>(),
}));

vi.mock("@/lib/chain/permissions", () => ({
  readPermissions: vi.fn(async (owner: string) => chain.records.get(owner.toLowerCase()) ?? []),
  readIsActive: vi.fn(async (id: string) => chain.active.has(id.toLowerCase())),
  readPermission: vi.fn(),
  findTransaction: vi.fn(),
  publicClient: {},
}));

vi.mock("../auth", async () => {
  const { unauthenticated } = await import("../http");
  return {
    requireOwner: vi.fn(async (request: Request) => {
      const token = request.headers.get("authorization");
      if (token === "Bearer token-a") return OWNER_A;
      if (token === "Bearer token-b") return OWNER_B;
      throw unauthenticated();
    }),
  };
});

let fake = createFakeDb({});
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: (t: string) => fake.client.from(t) }) }));
process.env.SUPABASE_URL = "http://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";

const { POST } = await import("@/app/api/contextpass/context/route");

/* ── Fixtures ──────────────────────────────────────────────── */

const APPS = [
  { id: "app-cp", slug: "code-pilot", name: "CodePilot", requested_scopes: ["projects", "coding-preferences"] },
  { id: "app-st", slug: "study-os", name: "StudyOS", requested_scopes: ["study-preferences"] },
];

function grant(owner: Address, slug: string, scopes: string[], state: "active" | "revoked" | "expired") {
  const id = permissionId(owner, appKey(slug), scopeKey(scopes)).toLowerCase() as Hex;
  const now = Date.now();
  const record: ChainRecord = {
    id,
    owner,
    app: appKey(slug),
    scope: scopeKey(scopes),
    grantedAt: now - 60_000,
    expiresAt: state === "expired" ? now - 1_000 : now + 3_600_000,
    revokedAt: state === "revoked" ? now - 5_000 : undefined,
    grantedBlock: BigInt(1),
    revokedBlock: state === "revoked" ? BigInt(2) : undefined,
  };
  const list = chain.records.get(owner.toLowerCase()) ?? [];
  chain.records.set(owner.toLowerCase(), [...list, record]);
  if (state === "active") chain.active.add(id);
  return id;
}

function ask(token: string | null, body: unknown) {
  return POST(
    new Request("http://localhost/api/contextpass/context", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  chain.records.clear();
  chain.active.clear();
  fake = createFakeDb({
    apps: APPS.map((a) => ({ ...a, status: "active" })),
    context_items: [
      { owner_id: "owner-a", scope: "projects", title: "A project", content: "A secret project", is_sample: false },
      { owner_id: "owner-a", scope: "coding-preferences", title: "A style", content: "A coding style", is_sample: false },
      { owner_id: "owner-a", scope: "about", title: "A about", content: "A private bio", is_sample: false },
      { owner_id: "owner-a", scope: "study-preferences", title: "A study", content: "A study habits", is_sample: false },
      { owner_id: "owner-b", scope: "projects", title: "B project", content: "B secret project", is_sample: false },
    ],
    permission_requests: [],
    activity_events: [],
  });
});

const CP = { app: "code-pilot", scopes: ["projects", "coding-preferences"] };

/* ── Tests ─────────────────────────────────────────────────── */

describe("authentication", () => {
  it("rejects unauthenticated calls with 401 and no context", async () => {
    const res = await ask(null, CP);
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});

describe("authorization comes from the chain, not the request", () => {
  it("403 when there is no permission at all", async () => {
    const res = await ask("token-a", CP);
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("no-permission");
    expect(fake.log.some((q) => q.table === "context_items")).toBe(false);
  });

  it("returns the granted scopes when Monad reports the permission active", async () => {
    grant(WALLET_A, "code-pilot", ["projects", "coding-preferences"], "active");
    const res = await ask("token-a", CP);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.granted.sort()).toEqual(["coding-preferences", "projects"]);
    const contents = json.context.flatMap((c: { items: { content: string }[] }) => c.items.map((i) => i.content));
    expect(contents.sort()).toEqual(["A coding style", "A secret project"]);
  });

  it("403 'revoked' after revocation — and no context", async () => {
    grant(WALLET_A, "code-pilot", ["projects", "coding-preferences"], "revoked");
    const res = await ask("token-a", CP);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.reason).toBe("revoked");
    expect(json.message).toBe("Access revoked. ContextPass blocked this request.");
    expect(json.context).toBeUndefined();
  });

  it("403 'expired' after expiry, even if the local clock disagrees", async () => {
    grant(WALLET_A, "code-pilot", ["projects", "coding-preferences"], "expired");
    const res = await ask("token-a", CP);
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("expired");
  });

  it("trusts isPermissionActive over the stored expiry", async () => {
    // Stored expiry is in the future, but the contract says inactive.
    const id = grant(WALLET_A, "code-pilot", ["projects"], "active");
    chain.active.delete(id);
    expect((await ask("token-a", CP)).status).toBe(403);
  });

  it("ignores owner, wallet and user ids supplied in the body", async () => {
    grant(WALLET_B, "code-pilot", ["projects", "coding-preferences"], "active");
    const res = await ask("token-a", { ...CP, owner_id: "owner-b", wallet: WALLET_B, userId: "did:privy:b" });
    expect(res.status).toBe(403); // A has no permission; B's permission doesn't help A.
    const reads = fake.log.filter((q) => q.table === "context_items");
    expect(reads).toHaveLength(0);
  });

  it("a user's own permission never returns another user's context", async () => {
    grant(WALLET_A, "code-pilot", ["projects"], "active");
    const json = await (await ask("token-a", { app: "code-pilot", scopes: ["projects"] })).json();
    const contents = json.context.flatMap((c: { items: { content: string }[] }) => c.items.map((i) => i.content));
    expect(contents).toEqual(["A secret project"]);
    const read = fake.log.find((q) => q.table === "context_items")!;
    expect(read.filters).toContainEqual({ op: "eq", column: "owner_id", value: "owner-a" });
  });
});

describe("scope-level access", () => {
  it("returns only the authorized scope and withholds the rest", async () => {
    grant(WALLET_A, "code-pilot", ["projects"], "active");
    const res = await ask("token-a", CP);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.granted).toEqual(["projects"]);
    expect(json.withheld).toEqual(["coding-preferences"]);
    expect(JSON.stringify(json)).not.toContain("A coding style");
    expect(JSON.stringify(json)).not.toContain("A private bio");
    const read = fake.log.find((q) => q.table === "context_items")!;
    expect(read.filters).toContainEqual({ op: "in", column: "scope", value: ["projects"] });
  });

  it("rejects a scope the app never declared (422), e.g. CodePilot asking for About me", async () => {
    grant(WALLET_A, "code-pilot", ["projects"], "active");
    const res = await ask("token-a", { app: "code-pilot", scopes: ["projects", "about"] });
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });

  it("rejects unknown scopes (422)", async () => {
    expect((await ask("token-a", { app: "code-pilot", scopes: ["passwords"] })).status).toBe(422);
    expect((await ask("token-a", { app: "code-pilot", scopes: [] })).status).toBe(422);
  });
});

describe("app identity", () => {
  it("unknown app slug → 404", async () => {
    expect((await ask("token-a", { app: "evil-app", scopes: ["projects"] })).status).toBe(404);
  });

  it("swapping the slug doesn't borrow another app's permission", async () => {
    grant(WALLET_A, "study-os", ["study-preferences"], "active");
    const res = await ask("token-a", CP); // CodePilot asks; only StudyOS was allowed.
    expect(res.status).toBe(403);
  });

  it("a permission for one app only unlocks that app's scopes", async () => {
    grant(WALLET_A, "study-os", ["study-preferences"], "active");
    const json = await (await ask("token-a", { app: "study-os", scopes: ["study-preferences"] })).json();
    expect(json.granted).toEqual(["study-preferences"]);
    expect(JSON.stringify(json)).not.toContain("A secret project");
  });
});

describe("audit", () => {
  it("records a 'blocked' event for a refused read and an 'accessed' event for an allowed one", async () => {
    await ask("token-a", CP);
    grant(WALLET_A, "code-pilot", ["projects", "coding-preferences"], "active");
    await ask("token-a", CP);
    const types = (fake.tables.activity_events as { type: string; owner_id: string }[]).map((e) => `${e.owner_id}:${e.type}`);
    expect(types).toEqual(["owner-a:blocked", "owner-a:accessed"]);
  });

  it("malformed bodies are 422, never 500", async () => {
    const res = await POST(
      new Request("http://localhost/api/contextpass/context", { method: "POST", headers: { authorization: "Bearer token-a" }, body: "not json" }),
    );
    expect(res.status).toBe(422);
  });
});
