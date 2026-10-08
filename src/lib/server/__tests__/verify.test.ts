/**
 * Security tests for identity and chain verification:
 *  - Privy access tokens are verified server-side (signature, issuer, audience, expiry).
 *  - The wallet comes from Privy's API, never the request.
 *  - A transaction hash from the browser only counts if Monad's receipt
 *    carries the exact event, from our contract, for this permission and owner.
 */
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { encodeAbiParameters, encodeEventTopics, type Address, type Hex, type Log } from "viem";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { contextPassPermissionsAbi as abi } from "@/lib/chain/abi";
import { ApiError } from "../http";
import { createFakeDb } from "./fake-db";

const env = vi.hoisted(() => {
  const values = {
    NEXT_PUBLIC_PRIVY_APP_ID: "test-app-id",
    PRIVY_APP_SECRET: "test-only-secret",
    SUPABASE_URL: "http://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-only",
    NEXT_PUBLIC_CONTEXTPASS_CONTRACT_ADDRESS: "0xD6CEB04bC6C4F6c4b3AD3Ef742Dd0615B0eA248f",
  };
  Object.assign(process.env, values);
  return values;
});

/* ── Stubs ─────────────────────────────────────────────────── */

const keys = vi.hoisted(() => ({ jwks: { keys: [] as JWK[] } }));
vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  // Privy's published keys, replaced with a local key pair.
  return { ...actual, createRemoteJWKSet: () => actual.createLocalJWKSet(keys.jwks) };
});

const rpc = vi.hoisted(() => ({ receipt: undefined as unknown }));
vi.mock("@/lib/chain/permissions", () => ({
  publicClient: { waitForTransactionReceipt: vi.fn(async () => rpc.receipt) },
  readPermissions: vi.fn(),
  readIsActive: vi.fn(),
  readPermission: vi.fn(),
  findTransaction: vi.fn(),
}));

let fake = createFakeDb({});
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: (t: string) => fake.client.from(t) }) }));

const { requireOwner } = await import("../auth");
const { verifyPermissionTx } = await import("../chain");

/* ── Identity ──────────────────────────────────────────────── */

const PRIVY_WALLET = "0x00000000000000000000000000000000000000a1" as Address;
let signingKey: CryptoKey;
let strangerKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  signingKey = pair.privateKey;
  keys.jwks.keys = [{ ...(await exportJWK(pair.publicKey)), alg: "ES256" }];
  strangerKey = (await generateKeyPair("ES256")).privateKey;
});

beforeEach(() => {
  fake = createFakeDb({ profiles: [] });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        linked_accounts: [
          { type: "email", address: "someone@example.com" },
          { type: "wallet", chain_type: "ethereum", wallet_client_type: "metamask", address: "0x00000000000000000000000000000000000000ee" },
          { type: "wallet", chain_type: "ethereum", wallet_client_type: "privy", address: PRIVY_WALLET },
        ],
      }),
    ),
  );
});

function token(opts: { key?: CryptoKey; sub?: string; aud?: string; iss?: string; exp?: string | number } = {}) {
  return new SignJWT({ sid: "session" })
    .setProtectedHeader({ alg: "ES256" })
    .setSubject(opts.sub ?? "did:privy:alice")
    .setAudience(opts.aud ?? env.NEXT_PUBLIC_PRIVY_APP_ID)
    .setIssuer(opts.iss ?? "privy.io")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "1h")
    .sign(opts.key ?? signingKey);
}

const call = (auth?: string, bodyJson?: unknown) =>
  new Request("http://localhost/api/requests", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
    body: bodyJson ? JSON.stringify(bodyJson) : undefined,
  });

async function status(p: Promise<unknown>) {
  try {
    await p;
    return 200;
  } catch (e) {
    return e instanceof ApiError ? e.status : 500;
  }
}

describe("Privy token verification", () => {
  it("accepts a valid token and takes the wallet from Privy, not the request", async () => {
    const owner = await requireOwner(call(`Bearer ${await token()}`, { wallet: "0x00000000000000000000000000000000000000b2", owner_id: "x" }));
    expect(owner.privyUserId).toBe("did:privy:alice");
    expect(owner.wallet).toBe(PRIVY_WALLET);
    expect((fake.tables.profiles[0] as { privy_user_id: string }).privy_user_id).toBe("did:privy:alice");
  });

  it("ignores external wallets linked to the account", async () => {
    const owner = await requireOwner(call(`Bearer ${await token({ sub: "did:privy:bob" })}`));
    expect(owner.wallet).toBe(PRIVY_WALLET);
  });

  it.each([
    ["no header", undefined],
    ["empty bearer", "Bearer "],
    ["not a JWT", "Bearer not-a-token"],
    ["wrong scheme", "Basic abc"],
  ])("401 for %s", async (_label, header) => {
    expect(await status(requireOwner(call(header)))).toBe(401);
  });

  it("401 for a token signed by someone else", async () => {
    expect(await status(requireOwner(call(`Bearer ${await token({ key: strangerKey })}`)))).toBe(401);
  });

  it("401 for a token issued for another Privy app", async () => {
    expect(await status(requireOwner(call(`Bearer ${await token({ aud: "another-app" })}`)))).toBe(401);
  });

  it("401 for a token from another issuer", async () => {
    expect(await status(requireOwner(call(`Bearer ${await token({ iss: "evil.example" })}`)))).toBe(401);
  });

  it("401 for an expired token", async () => {
    expect(await status(requireOwner(call(`Bearer ${await token({ exp: Math.floor(Date.now() / 1000) - 60 })}`)))).toBe(401);
  });

  it("401 for a subject that isn't a Privy user", async () => {
    expect(await status(requireOwner(call(`Bearer ${await token({ sub: "admin" })}`)))).toBe(401);
  });

  it("never creates a profile for a rejected caller", async () => {
    await status(requireOwner(call(`Bearer ${await token({ key: strangerKey })}`)));
    expect(fake.tables.profiles).toHaveLength(0);
  });
});

/* ── Transaction verification ──────────────────────────────── */

const CONTRACT = env.NEXT_PUBLIC_CONTEXTPASS_CONTRACT_ADDRESS as Address;
const OWNER = PRIVY_WALLET;
const ID = `0x${"11".repeat(32)}` as Hex;
const APP = `0x${"22".repeat(32)}` as Hex;
const HASH = `0x${"33".repeat(32)}` as Hex;

function grantedLog(opts: { address?: Address; id?: Hex; owner?: Address } = {}): Log {
  return {
    address: opts.address ?? CONTRACT,
    topics: encodeEventTopics({
      abi,
      eventName: "PermissionGranted",
      args: { id: opts.id ?? ID, owner: opts.owner ?? OWNER, app: APP },
    }) as [Hex, ...Hex[]],
    data: encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint64" }],
      [`0x${"44".repeat(32)}`, BigInt(Math.floor(Date.now() / 1000) + 3600)],
    ),
    blockHash: HASH,
    blockNumber: BigInt(10),
    logIndex: 0,
    transactionHash: HASH,
    transactionIndex: 0,
    removed: false,
  };
}

function receipt(status: "success" | "reverted", logs: Log[]) {
  rpc.receipt = { status, logs, blockNumber: BigInt(10) };
}

describe("transaction verification", () => {
  it("accepts the exact event from our contract for this permission and owner", async () => {
    receipt("success", [grantedLog()]);
    await expect(verifyPermissionTx("PermissionGranted", HASH, ID, OWNER)).resolves.toEqual({ blockNumber: BigInt(10) });
  });

  it("409 for a reverted transaction", async () => {
    receipt("reverted", [grantedLog()]);
    expect(await status(verifyPermissionTx("PermissionGranted", HASH, ID, OWNER))).toBe(409);
  });

  it("409 when the event was emitted by a different contract", async () => {
    receipt("success", [grantedLog({ address: "0x000000000000000000000000000000000000dEaD" })]);
    expect(await status(verifyPermissionTx("PermissionGranted", HASH, ID, OWNER))).toBe(409);
  });

  it("409 when the event is for another owner", async () => {
    receipt("success", [grantedLog({ owner: "0x00000000000000000000000000000000000000b2" })]);
    expect(await status(verifyPermissionTx("PermissionGranted", HASH, ID, OWNER))).toBe(409);
  });

  it("409 when the event is for another permission", async () => {
    receipt("success", [grantedLog({ id: `0x${"99".repeat(32)}` })]);
    expect(await status(verifyPermissionTx("PermissionGranted", HASH, ID, OWNER))).toBe(409);
  });

  it("409 when a grant transaction is offered as proof of revocation", async () => {
    receipt("success", [grantedLog()]);
    expect(await status(verifyPermissionTx("PermissionRevoked", HASH, ID, OWNER))).toBe(409);
  });

  it("503 (not success) when Monad can't be reached", async () => {
    rpc.receipt = undefined;
    const { publicClient } = await import("@/lib/chain/permissions");
    vi.mocked(publicClient.waitForTransactionReceipt).mockRejectedValueOnce(new Error("timeout"));
    expect(await status(verifyPermissionTx("PermissionGranted", HASH, ID, OWNER))).toBe(503);
  });
});
