import "server-only";
import type { Hex } from "viem";
import { appKey, SCOPE_LOOKUP } from "@/lib/chain/ids";
import { readPermissions } from "@/lib/chain/permissions";
import { CONTRACT_ADDRESS, chain } from "@/lib/chain/config";
import { isScopeId, SCOPE_INFO, type ScopeId } from "@/lib/contextpass/scopes";
import type { Owner } from "./auth";
import { isActiveOnChain } from "./chain";
import { appBySlug, check, db, recordActivity, type AppRow } from "./db";
import { forbidden, invalid, notFound, unavailable } from "./http";

/**
 * THE ACCESS GATE.
 *
 * The only path by which an app receives a person's context:
 *
 *   verified owner → known app → declared scopes → Monad:
 *   isPermissionActive(permissionId(owner, app, scope set)) → context
 *
 * Context is released per scope, only for scopes covered by a permission the
 * contract reports active at this moment. Nothing else is returned. A UI
 * saying "Active" is never enough on its own.
 */

import type { AuthorizedContext, BlockReason } from "@/lib/contextpass-sdk";

export type { AuthorizedContext, BlockReason };

/** Validates an app slug and requested scopes against the registry. */
export async function resolveAppAndScopes(appSlug: unknown, scopes: unknown): Promise<{ app: AppRow; scopes: ScopeId[] }> {
  if (typeof appSlug !== "string" || !appSlug) throw invalid("An app identifier is required.");
  const app = await appBySlug(appSlug);
  if (!app) throw notFound("That app");
  if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every(isScopeId)) {
    throw invalid("Scopes must be a non-empty list of known context scopes.");
  }
  const undeclared = scopes.filter((s) => !app.requested_scopes.includes(s));
  if (undeclared.length) throw invalid(`${app.name} can’t ask for ${undeclared.map((s) => SCOPE_INFO[s].label).join(", ")}.`);
  return { app, scopes: [...new Set(scopes)] };
}

/** Which of `requested` the owner's active on-chain permissions cover for this app. */
async function chainAuthorization(owner: Owner, app: AppRow, requested: ScopeId[]) {
  if (!owner.wallet) {
    return { granted: [] as ScopeId[], covering: [], reason: "no-permission" as BlockReason };
  }
  let records;
  try {
    records = await readPermissions(owner.wallet);
  } catch {
    throw unavailable("Monad couldn’t be reached to check this permission. Nothing was shared.");
  }
  const key = appKey(app.slug).toLowerCase();
  const forApp = records.filter((r) => r.app.toLowerCase() === key);

  // The contract decides what is active, at chain time.
  const checks = await Promise.all(forApp.map(async (r) => ({ r, active: await isActiveOnChain(r.id) })));
  const covering = checks
    .filter((c) => c.active)
    .map((c) => ({ record: c.r, scopes: SCOPE_LOOKUP.get(c.r.scope) ?? [] }))
    .filter((c) => c.scopes.some((s) => requested.includes(s)));

  const granted = requested.filter((s) => covering.some((c) => c.scopes.includes(s)));

  let reason: BlockReason | undefined;
  if (granted.length === 0) {
    const relevant = checks.filter((c) => (SCOPE_LOOKUP.get(c.r.scope) ?? []).some((s) => requested.includes(s)));
    const latest = relevant.sort((a, b) => b.r.grantedAt - a.r.grantedAt)[0]?.r;
    reason = !latest ? "no-permission" : latest.revokedAt ? "revoked" : "expired";
  }
  return { granted, covering, reason };
}

const BLOCK_MESSAGE: Record<BlockReason, string> = {
  "no-permission": "You haven’t given this app access to that context.",
  revoked: "Access revoked. ContextPass blocked this request.",
  expired: "Access expired. ContextPass blocked this request.",
};

/**
 * Returns only the context the owner has authorized this app to read, right
 * now, according to Monad. Throws 403 (and records the block) otherwise.
 */
export async function getAuthorizedContext(owner: Owner, appSlug: unknown, scopes: unknown): Promise<AuthorizedContext> {
  const { app, scopes: requested } = await resolveAppAndScopes(appSlug, scopes);
  const { granted, covering, reason } = await chainAuthorization(owner, app, requested);

  if (granted.length === 0) {
    await recordActivity({
      ownerId: owner.id,
      appId: app.id,
      type: "blocked",
      scopes: requested,
      detail: BLOCK_MESSAGE[reason ?? "no-permission"],
    });
    throw forbidden(BLOCK_MESSAGE[reason ?? "no-permission"], { reason: reason ?? "no-permission" });
  }

  // Owner-scoped, scope-scoped read. The only query that returns context to an app.
  const rows = check(
    await db()
      .from("context_items")
      .select("scope, title, content, is_sample")
      .eq("owner_id", owner.id)
      .in("scope", granted)
      .order("created_at", { ascending: true }),
    "read authorized context",
  ) as { scope: ScopeId; title: string; content: string; is_sample: boolean }[];

  const permissionIds = covering.map((c) => c.record.id.toLowerCase());
  const txs = check(
    await db()
      .from("permission_requests")
      .select("permission_id, transaction_hash")
      .eq("owner_id", owner.id)
      .eq("status", "approved")
      .in("permission_id", permissionIds)
      .order("decision_at", { ascending: false }),
    "read grant transactions",
  ) as { permission_id: string; transaction_hash: string }[];

  await recordActivity({
    ownerId: owner.id,
    appId: app.id,
    type: "accessed",
    scopes: granted,
    permissionId: covering[0]?.record.id,
    detail: rows.filter((r) => granted.includes(r.scope)).length === 0 ? "Allowed, but nothing is stored in these scopes yet." : null,
  });

  return {
    app: { slug: app.slug, name: app.name },
    granted,
    withheld: requested.filter((s) => !granted.includes(s)),
    context: granted.map((scope) => ({
      scope,
      label: SCOPE_INFO[scope].label,
      items: rows.filter((r) => r.scope === scope).map((r) => ({ title: r.title, content: r.content, isSample: r.is_sample })),
    })),
    receipt: {
      verifiedAt: Date.now(),
      chainId: chain.id,
      contract: CONTRACT_ADDRESS ?? "",
      permissions: covering.map((c) => ({
        id: c.record.id,
        scopes: c.scopes.filter((s) => requested.includes(s)),
        expiresAt: c.record.expiresAt,
        transactionHash: txs.find((t) => t.permission_id === c.record.id.toLowerCase())?.transaction_hash as Hex | undefined,
      })),
    },
  };
}
