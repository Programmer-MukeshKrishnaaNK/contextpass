/**
 * Security tests for the permission request lifecycle.
 * Allow is recorded only after the server verifies the grant on Monad for the
 * verified owner's wallet; Deny never touches the chain.
 */
import type { Address, Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appKey, permissionId, scopeKey } from "@/lib/chain/ids";
import { ApiError } from "../http";
import { createFakeDb } from "./fake-db";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
  process.env.NEXT_PUBLIC_CONTEXTPASS_CONTRACT_ADDRESS = "0xD6CEB04bC6C4F6c4b3AD3Ef742Dd0615B0eA248f";
});

const chain = vi.hoisted(() => ({
  verified: [] as { event: string; id: string; owner: string }[],
  active: true,
}));

vi.mock("../chain", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../chain")>();
  return {
    ...actual,
    verifyPermissionTx: vi.fn(async (event: string, _hash: Hex, id: Hex, owner: Address) => {
      chain.verified.push({ event, id, owner });
      return { blockNumber: BigInt(1) };
    }),
    isActiveOnChain: vi.fn(async () => chain.active),
    permissionOnChain: vi.fn(async () => ({ expiresAt: Date.now() + 86_400_000, grantedAt: Date.now() })),
  };
});
vi.mock("@/lib/chain/permissions", () => ({
  publicClient: {},
  readPermissions: vi.fn(async () => []),
  readIsActive: vi.fn(),
  readPermission: vi.fn(),
  findTransaction: vi.fn(),
}));

let fake = createFakeDb({});
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: (t: string) => fake.client.from(t) }) }));

const { approveRequest, denyRequest, reconcile } = await import("../requests");
const permissions = await import("@/lib/chain/permissions");

const WALLET_A = "0x00000000000000000000000000000000000000a1" as Address;
const OWNER_A = { id: "owner-a", privyUserId: "did:privy:a", wallet: WALLET_A };
const OWNER_B = { id: "owner-b", privyUserId: "did:privy:b", wallet: "0x00000000000000000000000000000000000000b2" as Address };
const REQ = "11111111-1111-4111-8111-111111111111";
const TX = `0x${"ab".repeat(32)}`;

beforeEach(() => {
  chain.verified = [];
  chain.active = true;
  vi.mocked(permissions.readPermissions).mockResolvedValue([]);
  vi.mocked(permissions.findTransaction).mockReset();
  fake = createFakeDb({
    apps: [{ id: "app-cp", slug: "code-pilot" }],
    permission_requests: [
      {
        id: REQ,
        owner_id: "owner-a",
        app_id: "app-cp",
        apps: { slug: "code-pilot" },
        requested_scopes: ["coding-preferences", "projects"],
        duration: "1d",
        status: "pending",
        reason: "",
        requested_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ],
    activity_events: [],
  });
});

async function status(p: Promise<unknown>) {
  try {
    await p;
    return 200;
  } catch (e) {
    return e instanceof ApiError ? e.status : 500;
  }
}

const request = () => fake.tables.permission_requests[0] as Record<string, unknown>;

describe("approve", () => {
  it("verifies the grant for the server-known wallet and records it", async () => {
    await approveRequest(OWNER_A, REQ, { transactionHash: TX, scopes: ["projects"] });
    const expected = permissionId(WALLET_A, appKey("code-pilot"), scopeKey(["projects"])).toLowerCase();
    expect(chain.verified).toEqual([{ event: "PermissionGranted", id: expected, owner: WALLET_A }]);
    expect(request().status).toBe("approved");
    expect(request().permission_id).toBe(expected);
    expect(request().transaction_hash).toBe(TX);
  });

  it("another user can't approve (or even see) my request — 404", async () => {
    expect(await status(approveRequest(OWNER_B, REQ, { transactionHash: TX, scopes: ["projects"] }))).toBe(404);
    expect(request().status).toBe("pending");
  });

  it("422 for scopes the app never asked for", async () => {
    expect(await status(approveRequest(OWNER_A, REQ, { transactionHash: TX, scopes: ["about"] }))).toBe(422);
    expect(chain.verified).toHaveLength(0);
  });

  it("422 for a malformed transaction hash", async () => {
    expect(await status(approveRequest(OWNER_A, REQ, { transactionHash: "0x1234", scopes: ["projects"] }))).toBe(422);
  });

  it("409 — stays pending — when Monad doesn't report the permission active", async () => {
    chain.active = false;
    expect(await status(approveRequest(OWNER_A, REQ, { transactionHash: TX, scopes: ["projects"] }))).toBe(409);
    expect(request().status).toBe("pending");
    expect(fake.tables.activity_events).toHaveLength(0);
  });

  it("404 for ids that aren't request ids", async () => {
    expect(await status(approveRequest(OWNER_A, "../../profiles", { transactionHash: TX, scopes: ["projects"] }))).toBe(404);
  });

  it("can't approve a request that was denied", async () => {
    await denyRequest(OWNER_A, REQ);
    expect(await status(approveRequest(OWNER_A, REQ, { transactionHash: TX, scopes: ["projects"] }))).toBe(409);
  });
});

describe("deny", () => {
  it("records the decision without any chain call or transaction", async () => {
    await denyRequest(OWNER_A, REQ);
    expect(request().status).toBe("denied");
    expect(request().transaction_hash).toBeUndefined();
    expect(chain.verified).toHaveLength(0);
    const events = fake.tables.activity_events as { type: string; transaction_hash: string | null }[];
    expect(events.map((e) => e.type)).toEqual(["denied"]);
    expect(events[0].transaction_hash).toBeNull();
  });

  it("another user can't deny my request", async () => {
    expect(await status(denyRequest(OWNER_B, REQ))).toBe(404);
    expect(request().status).toBe("pending");
  });
});

describe("reconcile", () => {
  it("records on-chain history ContextPass didn't issue, once, with its transactions", async () => {
    const scope = scopeKey(["projects"]);
    const id = permissionId(WALLET_A, appKey("code-pilot"), scope).toLowerCase() as Hex;
    const grantedAt = Date.now() - 3_600_000;
    vi.mocked(permissions.readPermissions).mockResolvedValue([
      {
        id,
        owner: WALLET_A,
        app: appKey("code-pilot"),
        scope,
        grantedAt,
        expiresAt: grantedAt + 86_400_000,
        revokedAt: grantedAt + 60_000,
        grantedBlock: BigInt(10),
        revokedBlock: BigInt(20),
      },
    ]);
    vi.mocked(permissions.findTransaction).mockImplementation(async (kind) =>
      kind === "granted" ? `0x${"aa".repeat(32)}` : `0x${"bb".repeat(32)}`,
    );

    await reconcile(OWNER_A);
    const events = fake.tables.activity_events as { type: string; transaction_hash: string; app_id: string }[];
    expect(events.map((e) => [e.type, e.transaction_hash, e.app_id])).toEqual([
      ["allowed", `0x${"aa".repeat(32)}`, "app-cp"],
      ["revoked", `0x${"bb".repeat(32)}`, "app-cp"],
    ]);

    // Already in the ledger: the chain isn't searched again.
    vi.mocked(permissions.findTransaction).mockClear();
    await reconcile(OWNER_A);
    expect(permissions.findTransaction).not.toHaveBeenCalled();
    expect(fake.tables.activity_events).toHaveLength(2);
  });

  it("invents nothing when the transaction can't be found", async () => {
    const scope = scopeKey(["projects"]);
    vi.mocked(permissions.readPermissions).mockResolvedValue([
      {
        id: permissionId(WALLET_A, appKey("code-pilot"), scope),
        owner: WALLET_A,
        app: appKey("code-pilot"),
        scope,
        grantedAt: Date.now() - 1000,
        expiresAt: Date.now() + 86_400_000,
        grantedBlock: BigInt(10),
      },
    ]);
    vi.mocked(permissions.findTransaction).mockResolvedValue(undefined);
    await reconcile(OWNER_A);
    expect(fake.tables.activity_events).toHaveLength(0);
  });
});
