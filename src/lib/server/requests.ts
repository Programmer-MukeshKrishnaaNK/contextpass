import "server-only";
import type { Hex } from "viem";
import { DURATIONS } from "@/lib/contextpass/clock";
import { isScopeId, SCOPE_INFO, type ScopeId } from "@/lib/contextpass/scopes";
import type { DurationId, PermissionRequest } from "@/lib/contextpass/types";
import { appKey, canonicalScopes, permissionId, scopeKey, SCOPE_LOOKUP } from "@/lib/chain/ids";
import { findTransaction, readPermissions } from "@/lib/chain/permissions";
import { resolveAppAndScopes } from "./access";
import type { Owner } from "./auth";
import { isActiveOnChain, parsePermissionId, parseTxHash, permissionOnChain, verifyPermissionTx } from "./chain";
import { check, db, recordActivity, REQUEST_COLUMNS, toRequest, type RequestRow } from "./db";
import { conflict, forbidden, invalid, notFound } from "./http";

const DURATION_IDS = Object.keys(DURATIONS) as DurationId[];
const scopeList = (scopes: ScopeId[]) => scopes.map((s) => SCOPE_INFO[s].label).join(", ");

/** The granted duration in words, from the chain record ("1 day"). */
function durationLabel(ms: number): string {
  const nearest = DURATION_IDS.reduce((best, d) =>
    Math.abs(DURATIONS[d].ms - ms) < Math.abs(DURATIONS[best].ms - ms) ? d : best,
  );
  return DURATIONS[nearest].label;
}

async function ownRequest(owner: Owner, id: string): Promise<RequestRow & { app_id: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("That request");
  const row = check(
    await db().from("permission_requests").select(REQUEST_COLUMNS).eq("id", id).eq("owner_id", owner.id).maybeSingle(),
    "read request",
  ) as (RequestRow & { app_id: string }) | null;
  if (!row) throw notFound("That request");
  return row;
}

async function reload(owner: Owner, id: string): Promise<PermissionRequest> {
  return toRequest(await ownRequest(owner, id));
}

/* ── Create ─────────────────────────────────────────────────── */

/** An app asks. Returns the open request for this app if one already exists. */
export async function createRequest(
  owner: Owner,
  input: { app?: unknown; scopes?: unknown; duration?: unknown },
): Promise<{ request: PermissionRequest; created: boolean }> {
  const { app, scopes } = await resolveAppAndScopes(input.app, input.scopes);
  const duration = (input.duration ?? app.default_duration) as DurationId;
  if (!DURATION_IDS.includes(duration)) throw invalid("Duration must be one of 15m, 1h, 1d or 30d.");

  const open = check(
    await db()
      .from("permission_requests")
      .select(REQUEST_COLUMNS)
      .eq("owner_id", owner.id)
      .eq("app_id", app.id)
      .in("status", ["pending", "failed"])
      .maybeSingle(),
    "find open request",
  ) as RequestRow | null;
  if (open) return { request: toRequest(open), created: false };

  const inserted = check(
    await db()
      .from("permission_requests")
      .insert({ owner_id: owner.id, app_id: app.id, requested_scopes: canonicalScopes(scopes), duration, reason: app.reason })
      .select(REQUEST_COLUMNS)
      .single(),
    "create request",
  ) as RequestRow;

  await recordActivity({
    ownerId: owner.id,
    appId: app.id,
    requestId: inserted.id,
    type: "requested",
    scopes,
    detail: `For ${DURATIONS[duration].label}`,
  });
  return { request: toRequest(inserted), created: true };
}

/* ── Approve (after Monad confirmed the grant) ──────────────── */

/**
 * Marks a request approved only after the server itself confirms, on Monad:
 * the transaction succeeded, it emitted PermissionGranted for exactly
 * permissionId(owner wallet, app, granted scopes), and isPermissionActive().
 */
export async function approveRequest(owner: Owner, id: string, input: { transactionHash?: unknown; scopes?: unknown }) {
  const row = await ownRequest(owner, id);
  if (row.status === "approved") return reload(owner, id);
  if (row.status !== "pending" && row.status !== "failed") throw conflict("This request has already been decided.");
  if (!owner.wallet) throw forbidden("Your signing key isn’t ready yet.");

  const hash = parseTxHash(input.transactionHash);
  if (!Array.isArray(input.scopes) || input.scopes.length === 0 || !input.scopes.every(isScopeId)) {
    throw invalid("Granted scopes must be a non-empty list of known scopes.");
  }
  const granted = canonicalScopes(input.scopes as ScopeId[]);
  if (granted.some((s) => !row.requested_scopes.includes(s))) throw invalid("You can only grant scopes the app asked for.");

  const slug = row.apps?.slug ?? "";
  const id32 = permissionId(owner.wallet, appKey(slug), scopeKey(granted)).toLowerCase() as Hex;

  await verifyPermissionTx("PermissionGranted", hash, id32, owner.wallet);
  if (!(await isActiveOnChain(id32))) throw conflict("Monad doesn’t report this permission as active.");
  const record = await permissionOnChain(id32);
  if (!record) throw conflict("Monad has no record of this permission.");

  check(
    await db()
      .from("permission_requests")
      .update({
        status: "approved",
        decision_at: new Date().toISOString(),
        granted_scopes: granted,
        permission_id: id32,
        permission_expires_at: new Date(record.expiresAt).toISOString(),
        transaction_hash: hash,
        failure_reason: null,
      })
      .eq("id", id)
      .eq("owner_id", owner.id)
      .in("status", ["pending", "failed"]),
    "approve request",
  );

  await recordActivity({
    ownerId: owner.id,
    appId: row.app_id,
    requestId: id,
    type: "allowed",
    scopes: granted,
    permissionId: id32,
    transactionHash: hash,
    detail: `For ${durationLabel(record.expiresAt - record.grantedAt)}`,
    occurredAt: new Date(record.grantedAt),
  });
  return reload(owner, id);
}

/* ── Deny (no transaction) ──────────────────────────────────── */

export async function denyRequest(owner: Owner, id: string) {
  const row = await ownRequest(owner, id);
  if (row.status === "denied") return reload(owner, id);
  if (row.status !== "pending" && row.status !== "failed") throw conflict("This request has already been decided.");
  check(
    await db()
      .from("permission_requests")
      .update({ status: "denied", decision_at: new Date().toISOString(), failure_reason: null })
      .eq("id", id)
      .eq("owner_id", owner.id)
      .in("status", ["pending", "failed"]),
    "deny request",
  );
  await recordActivity({
    ownerId: owner.id,
    appId: row.app_id,
    requestId: id,
    type: "denied",
    scopes: row.requested_scopes,
    detail: "Nothing was shared. No transaction was needed.",
  });
  return reload(owner, id);
}

/* ── Failed attempt (retryable) ─────────────────────────────── */

export async function failRequest(owner: Owner, id: string, input: { reason?: unknown }) {
  const row = await ownRequest(owner, id);
  if (row.status !== "pending" && row.status !== "failed") throw conflict("This request has already been decided.");
  const reason = typeof input.reason === "string" ? input.reason.slice(0, 200) : "The permission wasn’t recorded.";
  check(
    await db()
      .from("permission_requests")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", id)
      .eq("owner_id", owner.id),
    "fail request",
  );
  await recordActivity({ ownerId: owner.id, appId: row.app_id, requestId: id, type: "failed", scopes: row.requested_scopes, detail: reason });
  return reload(owner, id);
}

/* ── Revoke (after Monad confirmed it) ──────────────────────── */

export async function confirmRevocation(owner: Owner, rawId: string, input: { transactionHash?: unknown }) {
  const id = parsePermissionId(rawId);
  if (!owner.wallet) throw forbidden("Your signing key isn’t ready yet.");
  const record = await permissionOnChain(id);
  if (!record) throw notFound("That permission");
  if (record.owner.toLowerCase() !== owner.wallet.toLowerCase()) throw forbidden("That permission isn’t yours.");

  const hash = parseTxHash(input.transactionHash);
  await verifyPermissionTx("PermissionRevoked", hash, id, owner.wallet);
  if (await isActiveOnChain(id)) throw conflict("Monad still reports this permission as active.");

  await recordRevoked(owner, record.app, id, hash, record.revokedAt);
  return { permissionId: id, revoked: true, transactionHash: hash };
}

async function appIdForKey(key: string): Promise<{ id: string } | undefined> {
  const apps = check(await db().from("apps").select("id, slug"), "read apps") as { id: string; slug: string }[];
  return apps.find((a) => appKey(a.slug).toLowerCase() === key.toLowerCase());
}

async function latestRequestFor(owner: Owner, permission: string) {
  const { data } = await db()
    .from("permission_requests")
    .select("id")
    .eq("owner_id", owner.id)
    .eq("permission_id", permission.toLowerCase())
    .order("decision_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function recordRevoked(owner: Owner, app: string, id: Hex, hash: Hex | undefined, revokedAt?: number) {
  const record = await permissionOnChain(id);
  await recordActivity({
    ownerId: owner.id,
    appId: (await appIdForKey(app))?.id,
    requestId: await latestRequestFor(owner, id),
    type: "revoked",
    scopes: record ? SCOPE_LOOKUP.get(record.scope) ?? [] : [],
    permissionId: id,
    transactionHash: hash,
    detail: "Future reads are blocked.",
    occurredAt: revokedAt ? new Date(revokedAt) : undefined,
  });
}

/* ── Reconcile with the chain ───────────────────────────────── */

/**
 * Brings the off-chain records in line with Monad, so a closed tab or a
 * dropped request can never leave the ledger saying something false:
 *  - pending/failed requests whose grant landed on-chain → approved
 *  - granted permissions revoked on-chain → "revoked" event (with its tx)
 *  - granted permissions past expiry → "expired" event (contract-confirmed)
 *  - undecided requests past their own deadline → expired
 */
const reconciling = new Map<string, Promise<void>>();

/** Concurrent calls for the same owner (e.g. requests + activity loading together) share one pass. */
export function reconcile(owner: Owner): Promise<void> {
  const running = reconciling.get(owner.id);
  if (running) return running;
  const pass = reconcileOnce(owner).finally(() => reconciling.delete(owner.id));
  reconciling.set(owner.id, pass);
  return pass;
}

async function reconcileOnce(owner: Owner): Promise<void> {
  await db()
    .from("permission_requests")
    .update({ status: "expired" })
    .eq("owner_id", owner.id)
    .in("status", ["pending", "failed"])
    .lt("expires_at", new Date().toISOString());

  if (!owner.wallet) return;
  let records;
  try {
    records = await readPermissions(owner.wallet);
  } catch {
    return; // Chain unreachable: leave records as they are; nothing is invented.
  }
  if (records.length === 0) return;

  const rows = check(
    await db().from("permission_requests").select(REQUEST_COLUMNS).eq("owner_id", owner.id),
    "read requests for reconcile",
  ) as unknown as (RequestRow & { app_id: string })[];

  // What the ledger already says, so the chain is only searched for what's missing.
  const logged = check(
    await db()
      .from("activity_events")
      .select("permission_id, type, occurred_at")
      .eq("owner_id", owner.id)
      .in("type", ["allowed", "revoked", "expired"])
      .in("permission_id", records.map((r) => r.id.toLowerCase())),
    "read ledger for reconcile",
  ) as { permission_id: string; type: string; occurred_at: string }[];
  const hasEvent = (id: string, type: "allowed" | "revoked" | "expired", since: number) =>
    logged.some((e) => e.permission_id === id && e.type === type && new Date(e.occurred_at).getTime() >= since - 120_000);

  for (const r of records) {
    const id = r.id.toLowerCase() as Hex;
    const scopes = SCOPE_LOOKUP.get(r.scope) ?? [];

    // A grant the server never heard about (e.g. the tab closed after signing).
    const orphan = rows.find(
      (q) =>
        (q.status === "pending" || q.status === "failed") &&
        q.apps?.slug &&
        appKey(q.apps.slug).toLowerCase() === r.app.toLowerCase() &&
        scopes.length > 0 &&
        scopes.every((s) => q.requested_scopes.includes(s)) &&
        r.grantedAt >= new Date(q.requested_at).getTime() - 60_000,
    );
    if (orphan && !r.revokedAt && owner.wallet) {
      const hash = await findTransaction("granted", r.id, r.grantedBlock).catch(() => undefined);
      if (hash) {
        await approveRequest(owner, orphan.id, { transactionHash: hash, scopes }).catch(() => undefined);
      }
    }

    // A grant made outside a ContextPass request (e.g. before requests were
    // stored) is still the owner's history: record it, with its transaction.
    const known = rows.some((q) => q.permission_id === id) || (orphan && !r.revokedAt);
    if (!known && !hasEvent(id, "allowed", r.grantedAt)) {
      const hash = await findTransaction("granted", r.id, r.grantedBlock).catch(() => undefined);
      if (hash) {
        await recordActivity({
          ownerId: owner.id,
          appId: (await appIdForKey(r.app))?.id,
          type: "allowed",
          scopes,
          permissionId: id,
          transactionHash: hash,
          detail: `For ${durationLabel(r.expiresAt - r.grantedAt)}`,
          occurredAt: new Date(r.grantedAt),
        });
      }
    }

    if (r.revokedAt && r.revokedBlock) {
      if (!hasEvent(id, "revoked", r.revokedAt)) {
        const hash = await findTransaction("revoked", r.id, r.revokedBlock).catch(() => undefined);
        if (hash) await recordRevoked(owner, r.app, id, hash.toLowerCase() as Hex, r.revokedAt);
      }
    } else if (r.expiresAt <= Date.now() && !hasEvent(id, "expired", r.expiresAt) && !(await isActiveOnChain(id).catch(() => true))) {
      const appRow = await appIdForKey(r.app);
      await recordActivity({
        ownerId: owner.id,
        appId: appRow?.id,
        requestId: await latestRequestFor(owner, id),
        type: "expired",
        scopes,
        permissionId: id,
        detail: `Ended on its own. ${scopeList(scopes)} can no longer be read.`,
        occurredAt: new Date(r.expiresAt),
      });
    }
  }
}
