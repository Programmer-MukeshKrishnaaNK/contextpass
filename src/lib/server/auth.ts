import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Address } from "viem";
import { check, db } from "./db";
import { serverEnv } from "./env";
import { devLog, unauthenticated, unavailable } from "./http";

/**
 * Who is calling, established on the server.
 *
 *  1. The browser sends its Privy access token (Authorization: Bearer).
 *  2. The token's signature is verified against Privy's published keys,
 *     with issuer "privy.io" and audience = this app. Expired or forged
 *     tokens fail here.
 *  3. The owner's embedded wallet is looked up from Privy's API with the
 *     app secret — never taken from the request.
 *  4. The profile row is found or created for that identity.
 *
 * Every protected route calls requireOwner(); nothing downstream reads a user
 * id or wallet address from the request body.
 */

export interface Owner {
  /** profiles.id */
  id: string;
  privyUserId: string;
  /** Embedded wallet. Undefined only while Privy is still creating it. */
  wallet?: Address;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function privyKeys() {
  jwks ??= createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${serverEnv.privyAppId()}/jwks.json`));
  return jwks;
}

async function verifiedSubject(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw unauthenticated();
  try {
    const { payload } = await jwtVerify(token, privyKeys(), {
      issuer: "privy.io",
      audience: serverEnv.privyAppId(),
      algorithms: ["ES256"],
    });
    if (typeof payload.sub !== "string" || !payload.sub.startsWith("did:privy:")) throw new Error("bad subject");
    return payload.sub;
  } catch (error) {
    devLog("auth.rejected", { reason: error instanceof Error ? error.name : "unknown" });
    throw unauthenticated();
  }
}

const EMBEDDED = new Set(["privy", "privy-v2"]);
const walletCache = new Map<string, { wallet?: Address; at: number }>();
const WALLET_TTL_MS = 5 * 60_000;

interface PrivyLinkedAccount {
  type: string;
  address?: string;
  chain_type?: string;
  wallet_client_type?: string;
}

async function embeddedWallet(privyUserId: string): Promise<Address | undefined> {
  const cached = walletCache.get(privyUserId);
  if (cached && Date.now() - cached.at < WALLET_TTL_MS && cached.wallet) return cached.wallet;

  const appId = serverEnv.privyAppId();
  const auth = Buffer.from(`${appId}:${serverEnv.privyAppSecret()}`).toString("base64");
  const res = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(privyUserId)}`, {
    headers: { Authorization: `Basic ${auth}`, "privy-app-id": appId },
    cache: "no-store",
  });
  if (!res.ok) {
    devLog("auth.privy_lookup_failed", { status: res.status });
    throw unavailable("ContextPass couldn’t confirm your identity with Privy just now. Try again.");
  }
  const user = (await res.json()) as { linked_accounts?: PrivyLinkedAccount[] };
  const account = user.linked_accounts?.find(
    (a) => a.type === "wallet" && a.chain_type === "ethereum" && EMBEDDED.has(a.wallet_client_type ?? "") && a.address,
  );
  const wallet = account?.address as Address | undefined;
  walletCache.set(privyUserId, { wallet, at: Date.now() });
  return wallet;
}

/** Verifies the caller and returns their profile. Throws 401 when not signed in. */
export async function requireOwner(request: Request): Promise<Owner> {
  const privyUserId = await verifiedSubject(request);
  const wallet = await embeddedWallet(privyUserId);

  const result = await db()
    .from("profiles")
    .upsert(
      { privy_user_id: privyUserId, ...(wallet ? { wallet_address: wallet } : {}) },
      { onConflict: "privy_user_id" },
    )
    .select("id")
    .single();
  const profile = check(result, "upsert profile") as { id: string };

  return { id: profile.id, privyUserId, wallet };
}
