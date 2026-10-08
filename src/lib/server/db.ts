import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ActivityEvent, AppRecord, ContextItem, DurationId, Hex, PermissionRequest, ScopeId } from "@/lib/contextpass/types";
import { serverEnv } from "./env";
import { unavailable } from "./http";

/**
 * The server's database handle. It uses the service role, so every query in
 * this codebase is explicitly scoped to the verified owner — see auth.ts.
 * The browser never receives this client or its key.
 */
let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  client ??= createClient(serverEnv.supabaseUrl(), serverEnv.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Throws a safe 503 for database failures; logs the cause in development. */
export function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) {
    if (process.env.NODE_ENV !== "production") console.error(`[contextpass] db ${what}:`, result.error.message);
    throw unavailable("ContextPass couldn’t reach its records just now. Try again.");
  }
  return result.data;
}

const ms = (value: string | null | undefined) => (value ? new Date(value).getTime() : undefined);

/* ── Rows → API records ─────────────────────────────────────── */

export interface AppRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: string;
  developer: string;
  monogram: string;
  requested_scopes: ScopeId[];
  default_duration: DurationId;
  reason: string;
}

export const toApp = (r: AppRow): AppRecord => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  kind: r.kind,
  description: r.description,
  developer: r.developer,
  monogram: r.monogram,
  requestedScopes: r.requested_scopes,
  defaultDuration: r.default_duration,
  reason: r.reason,
});

export interface ContextRow {
  id: string;
  scope: ScopeId;
  title: string;
  content: string;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export const toContextItem = (r: ContextRow): ContextItem => ({
  id: r.id,
  scope: r.scope,
  title: r.title,
  content: r.content,
  isSample: r.is_sample,
  createdAt: ms(r.created_at)!,
  updatedAt: ms(r.updated_at)!,
});

export interface RequestRow {
  id: string;
  app_id: string;
  apps?: { slug: string } | null;
  requested_scopes: ScopeId[];
  duration: DurationId;
  reason: string;
  status: PermissionRequest["status"];
  requested_at: string;
  expires_at: string;
  decision_at: string | null;
  granted_scopes: ScopeId[] | null;
  permission_id: string | null;
  permission_expires_at: string | null;
  transaction_hash: string | null;
  failure_reason: string | null;
}

export const REQUEST_COLUMNS =
  "id, app_id, apps(slug), requested_scopes, duration, reason, status, requested_at, expires_at, decision_at, granted_scopes, permission_id, permission_expires_at, transaction_hash, failure_reason";

export const toRequest = (r: RequestRow): PermissionRequest => ({
  id: r.id,
  appSlug: r.apps?.slug ?? "unknown",
  requestedScopes: r.requested_scopes,
  duration: r.duration,
  reason: r.reason,
  status: r.status,
  requestedAt: ms(r.requested_at)!,
  expiresAt: ms(r.expires_at)!,
  decisionAt: ms(r.decision_at),
  grantedScopes: r.granted_scopes ?? undefined,
  permissionId: (r.permission_id as Hex) ?? undefined,
  permissionExpiresAt: ms(r.permission_expires_at),
  transactionHash: (r.transaction_hash as Hex) ?? undefined,
  failureReason: r.failure_reason ?? undefined,
});

export interface ActivityRow {
  id: string;
  type: ActivityEvent["type"];
  apps?: { slug: string } | null;
  request_id: string | null;
  scopes: ScopeId[];
  permission_id: string | null;
  transaction_hash: string | null;
  detail: string | null;
  occurred_at: string;
}

export const ACTIVITY_COLUMNS = "id, type, apps(slug), request_id, scopes, permission_id, transaction_hash, detail, occurred_at";

export const toActivity = (r: ActivityRow): ActivityEvent => ({
  id: r.id,
  type: r.type,
  appSlug: r.apps?.slug ?? undefined,
  requestId: r.request_id ?? undefined,
  scopes: r.scopes ?? [],
  permissionId: (r.permission_id as Hex) ?? undefined,
  transactionHash: (r.transaction_hash as Hex) ?? undefined,
  detail: r.detail ?? undefined,
  occurredAt: ms(r.occurred_at)!,
});

/* ── Shared writes ──────────────────────────────────────────── */

export interface NewActivity {
  ownerId: string;
  appId?: string | null;
  requestId?: string | null;
  type: ActivityEvent["type"];
  scopes?: ScopeId[];
  permissionId?: string | null;
  transactionHash?: string | null;
  detail?: string | null;
  occurredAt?: Date;
}

/**
 * Appends to the ledger. Chain-derived events are idempotent: a transaction
 * (or an expiry) already recorded is silently skipped.
 */
export async function recordActivity(e: NewActivity): Promise<void> {
  const row = {
    owner_id: e.ownerId,
    app_id: e.appId ?? null,
    request_id: e.requestId ?? null,
    type: e.type,
    scopes: e.scopes ?? [],
    permission_id: e.permissionId?.toLowerCase() ?? null,
    transaction_hash: e.transactionHash?.toLowerCase() ?? null,
    detail: e.detail ?? null,
    occurred_at: (e.occurredAt ?? new Date()).toISOString(),
  };
  const result = await db().from("activity_events").insert(row);
  if (result.error && result.error.code !== "23505") check(result, "record activity");
}

export async function appBySlug(slug: string): Promise<AppRow | undefined> {
  const { data } = await db()
    .from("apps")
    .select("id, slug, name, kind, description, developer, monogram, requested_scopes, default_duration, reason")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return (data as AppRow | null) ?? undefined;
}
