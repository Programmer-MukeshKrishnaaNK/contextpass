/**
 * ContextPass domain model.
 *
 *  - Context items, the app registry, permission requests and the activity
 *    ledger live off-chain in Supabase, reached only through the ContextPass
 *    server (src/app/api).
 *  - Permissions — grant, expiry, revocation — live on Monad. The chain is
 *    the source of truth for whether access is allowed.
 *  - The owner comes from the identity layer (src/lib/identity).
 */
import type { ScopeId } from "./scopes";

export type { ScopeId } from "./scopes";

/** Unix epoch milliseconds. */
export type Timestamp = number;
export type Hex = `0x${string}`;
export type DurationId = "15m" | "1h" | "1d" | "30d";

/* ── Records served by the ContextPass API ──────────────────── */

export interface AppRecord {
  id: string;
  /** Stable identity. On-chain: keccak256("contextpass.app:<slug>"). */
  slug: string;
  name: string;
  kind: string;
  description: string;
  developer: string;
  /** Two-letter mark drawn inside a dashed (guest) frame. */
  monogram: string;
  requestedScopes: ScopeId[];
  defaultDuration: DurationId;
  reason: string;
}

export interface ContextItem {
  id: string;
  scope: ScopeId;
  title: string;
  content: string;
  /** Added from "Add sample context" — not the owner's own words. */
  isSample: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RequestStatus = "pending" | "approved" | "denied" | "failed" | "expired";

export interface PermissionRequest {
  id: string;
  appSlug: string;
  requestedScopes: ScopeId[];
  duration: DurationId;
  reason: string;
  status: RequestStatus;
  requestedAt: Timestamp;
  /** When the request lapses if undecided. */
  expiresAt: Timestamp;
  decisionAt?: Timestamp;
  /** Approved only — read back from the chain. */
  grantedScopes?: ScopeId[];
  permissionId?: Hex;
  permissionExpiresAt?: Timestamp;
  transactionHash?: Hex;
  failureReason?: string;
}

export type LedgerAction = "requested" | "granted" | "denied" | "accessed" | "blocked" | "revoked" | "expired" | "failed";

export interface ActivityEvent {
  id: string;
  type: "requested" | "allowed" | "denied" | "revoked" | "expired" | "accessed" | "blocked" | "failed";
  appSlug?: string;
  requestId?: string;
  scopes: ScopeId[];
  permissionId?: Hex;
  transactionHash?: Hex;
  detail?: string;
  occurredAt: Timestamp;
}

/* ── View models the screens render ─────────────────────────── */

export type PermissionStatus = "active" | "pending" | "expired" | "revoked" | "denied" | "failed";

/** A request awaiting or after a decision, or a permission read from Monad. */
export interface Permission {
  /** Request id, or the on-chain permission id for recorded permissions. */
  id: string;
  source: "request" | "chain";
  /** App slug. */
  appId: string;
  scopes: ScopeId[];
  requestedScopes?: ScopeId[];
  status: PermissionStatus;
  duration?: DurationId;
  requestedAt: Timestamp;
  grantedAt?: Timestamp;
  expiresAt?: Timestamp;
  revokedAt?: Timestamp;
  deniedAt?: Timestamp;
  grantTx?: Hex;
  revokeTx?: Hex;
  reason?: string;
  failureReason?: string;
}

export interface LedgerEvent {
  id: string;
  at: Timestamp;
  /** App slug. */
  appId: string;
  action: LedgerAction;
  scopes: ScopeId[];
  permissionId?: string;
  /** "chain": a Monad transaction or chain state. "contextpass": recorded by ContextPass, off-chain. "example": landing illustration. */
  source: "chain" | "contextpass" | "example";
  tx?: Hex;
  note?: string;
}
