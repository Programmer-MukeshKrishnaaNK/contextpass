"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { chainConfigured } from "@/lib/chain/config";
import { appKey, permissionId, scopeKey, SCOPE_LOOKUP } from "@/lib/chain/ids";
import {
  describeFailure,
  grantCall,
  readIsActive,
  readPermissions,
  revokeCall,
  waitForConfirmation,
  type ChainRecord,
  type TxFailure,
} from "@/lib/chain/permissions";
import { callContextPass, type Result } from "@/lib/contextpass-sdk";
import { useIdentity } from "@/lib/identity/IdentityProvider";
import { DURATIONS, whenLabel } from "./clock";
import { SCOPE_INFO } from "./scopes";
import type {
  ActivityEvent,
  AppRecord,
  ContextItem,
  DurationId,
  Hex,
  LedgerEvent,
  Permission,
  PermissionRequest,
  PermissionStatus,
  ScopeId,
  Timestamp,
} from "./types";

/* ─────────────────────────────────────────────────────────────
   Where state comes from

     Context, apps, requests, activity → ContextPass API (Supabase)
     Permission state                  → Monad, read directly

   Allow  → Privy approval → grantPermission()  → confirmed → active on-chain
          → server verifies the transaction itself → request approved
   Revoke → Privy approval → revokePermission() → confirmed → inactive on-chain
          → server verifies → ledger records it
   Deny   → no transaction → server records the decision

   The UI never shows Active or Revoked before the chain does.
   ───────────────────────────────────────────────────────────── */

export function isPermissionActive(p: Permission, now: Timestamp): boolean {
  return p.status === "active" && (p.expiresAt === undefined || p.expiresAt > now);
}

/** Status as the user should see it right now (active → expired once the clock passes). */
export function statusOf(p: Permission, now: Timestamp): PermissionStatus {
  if (p.status === "active" && !isPermissionActive(p, now)) return "expired";
  return p.status;
}

export type TxProgress =
  | { phase: "signing" }
  | { phase: "confirming"; hash: Hex }
  | { phase: "failed"; failure: TxFailure };

export type ChainStatus = "unconfigured" | "waiting" | "loading" | "ready" | "error";
export type DataStatus = "waiting" | "loading" | "ready" | "error";

/* ───────────────────────────────────────────────────────────── */

interface ContextPassValue {
  apps: AppRecord[];
  appById: (slug: string) => AppRecord;
  context: ContextItem[];
  requests: PermissionRequest[];
  /** Open requests, plus every permission recorded on Monad. */
  permissions: Permission[];
  ledger: LedgerEvent[];
  requestById: (id: string) => { request: PermissionRequest; recorded?: Permission } | undefined;
  progress: Record<string, TxProgress | undefined>;
  chainStatus: ChainStatus;
  dataStatus: DataStatus;
  /** Records or chain still loading: screens must not claim "nothing" yet. */
  loading: boolean;
  dataError?: string;
  refresh: () => Promise<void>;
  refreshChain: () => Promise<void>;
  grant: (requestId: string, scopes: ScopeId[], duration: DurationId) => Promise<void>;
  deny: (requestId: string) => Promise<void>;
  revoke: (permissionId: string) => Promise<void>;
  clearProgress: (key: string) => void;
  addContext: (input: { scope: ScopeId; title: string; content: string }) => Promise<Result<{ item: ContextItem }>>;
  updateContext: (id: string, patch: { scope?: ScopeId; title?: string; content?: string }) => Promise<Result<{ item: ContextItem }>>;
  deleteContext: (id: string) => Promise<Result<object>>;
  addSampleContext: () => Promise<Result<{ items: ContextItem[] }>>;
}

const ContextPassContext = createContext<ContextPassValue | null>(null);
const NowContext = createContext<Timestamp>(0);

/** Real time, ticking each second. Permissions expire in real time. */
function useClock(): Timestamp {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const UNKNOWN_APP: AppRecord = {
  id: "",
  slug: "unknown",
  name: "Unknown app",
  kind: "Not in the registry",
  description: "",
  developer: "",
  monogram: "?",
  requestedScopes: [],
  defaultDuration: "1h",
  reason: "",
};

const LEDGER_ACTION: Record<ActivityEvent["type"], LedgerEvent["action"]> = {
  requested: "requested",
  allowed: "granted",
  denied: "denied",
  revoked: "revoked",
  expired: "expired",
  accessed: "accessed",
  blocked: "blocked",
  failed: "failed",
};

export function ContextPassProvider({ children }: { children: ReactNode }) {
  const now = useClock();
  const identity = useIdentity();
  const signedIn = identity.status === "signed-in";
  const owner = signedIn ? identity.walletAddress : undefined;
  const { getAccessToken, send } = identity;

  const [apps, setApps] = useState<AppRecord[]>([]);
  const [context, setContext] = useState<ContextItem[]>([]);
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [records, setRecords] = useState<ChainRecord[]>([]);
  const [chainStatus, setChainStatus] = useState<ChainStatus>(chainConfigured ? "waiting" : "unconfigured");
  const [dataStatus, setDataStatus] = useState<DataStatus>("waiting");
  const [dataError, setDataError] = useState<string>();
  const [progress, setProgress] = useState<Record<string, TxProgress | undefined>>({});

  const api = useCallback(
    <T,>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown) =>
      callContextPass<T>({ getAccessToken }, method, path, body),
    [getAccessToken],
  );

  /* ── Loading ──────────────────────────────────────────────── */

  const refreshChain = useCallback(async () => {
    if (!chainConfigured || !owner) return;
    setChainStatus((s) => (s === "ready" ? s : "loading"));
    try {
      setRecords(await readPermissions(owner));
      setChainStatus("ready");
    } catch (error) {
      describeFailure(error);
      setChainStatus("error");
    }
  }, [owner]);

  const refreshRecords = useCallback(async () => {
    const [r, a] = await Promise.all([
      api<{ requests: PermissionRequest[] }>("GET", "/api/requests"),
      api<{ events: ActivityEvent[] }>("GET", "/api/activity"),
    ]);
    if (r.ok) setRequests(r.requests);
    if (a.ok) setEvents(a.events);
    return r.ok && a.ok ? undefined : (!r.ok ? r : (a as Exclude<typeof a, { ok: true }>)).message;
  }, [api]);

  // One refresh at a time: overlapping triggers (sign-in settling, tab focus) share it.
  const inFlight = useRef<Promise<void> | undefined>(undefined);
  const refresh = useCallback(async () => {
    if (!signedIn) return;
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      setDataStatus((s) => (s === "ready" ? s : "loading"));
      const [appsRes, ctxRes, recordError] = await Promise.all([
        api<{ apps: AppRecord[] }>("GET", "/api/apps"),
        api<{ items: ContextItem[] }>("GET", "/api/context"),
        refreshRecords(),
        refreshChain(),
      ]);
      if (appsRes.ok) setApps(appsRes.apps);
      if (ctxRes.ok) setContext(ctxRes.items);
      const error = !appsRes.ok ? appsRes.message : !ctxRes.ok ? ctxRes.message : recordError;
      setDataError(error);
      setDataStatus(error ? "error" : "ready");
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = undefined;
    }
  }, [signedIn, api, refreshRecords, refreshChain]);

  useEffect(() => {
    // Loading external state when the owner changes is this effect's purpose.
    if (signedIn && owner) void refresh();
  }, [signedIn, owner, refresh]);

  /* ── Derived view ─────────────────────────────────────────── */

  const appBySlug = useMemo(() => new Map(apps.map((a) => [a.slug, a])), [apps]);
  const appByKey = useMemo(() => new Map(apps.map((a) => [appKey(a.slug).toLowerCase(), a])), [apps]);
  const appById = useCallback((slug: string) => appBySlug.get(slug) ?? { ...UNKNOWN_APP, slug }, [appBySlug]);

  const recorded = useMemo<Permission[]>(
    () =>
      records.map((r) => {
        const id = r.id.toLowerCase();
        // The ledger event for this grant/revocation cycle (an id can be granted again after a revoke).
        const logged = (type: "allowed" | "revoked", since?: number) =>
          since === undefined
            ? undefined
            : events.find((e) => e.type === type && e.permissionId === id && e.transactionHash && e.occurredAt >= since - 120_000);
        const grantTx =
          requests.find((q) => q.permissionId === id && q.transactionHash && (q.decisionAt ?? 0) >= r.grantedAt - 120_000)?.transactionHash ??
          logged("allowed", r.grantedAt)?.transactionHash;
        return {
          id: r.id,
          source: "chain",
          appId: appByKey.get(r.app.toLowerCase())?.slug ?? "unknown",
          scopes: SCOPE_LOOKUP.get(r.scope) ?? [],
          status: r.revokedAt ? "revoked" : "active",
          requestedAt: r.grantedAt,
          grantedAt: r.grantedAt,
          expiresAt: r.expiresAt,
          revokedAt: r.revokedAt,
          grantTx,
          revokeTx: logged("revoked", r.revokedAt)?.transactionHash,
        } satisfies Permission;
      }),
    [records, requests, events, appByKey],
  );

  const permissions = useMemo<Permission[]>(() => {
    const open: Permission[] = requests
      .filter((r) => r.status === "pending" || r.status === "failed" || r.status === "denied")
      .map((r) => ({
        id: r.id,
        source: "request",
        appId: r.appSlug,
        scopes: r.requestedScopes,
        requestedScopes: r.requestedScopes,
        status: r.status === "failed" ? "failed" : r.status === "denied" ? "denied" : "pending",
        duration: r.duration,
        requestedAt: r.requestedAt,
        deniedAt: r.status === "denied" ? r.decisionAt : undefined,
        reason: r.reason,
        failureReason: r.failureReason,
      }));
    return [...open, ...recorded];
  }, [requests, recorded]);

  const ledger = useMemo<LedgerEvent[]>(
    () =>
      events.map((e) => ({
        id: e.id,
        at: e.occurredAt,
        appId: e.appSlug ?? "unknown",
        action: LEDGER_ACTION[e.type],
        scopes: e.scopes,
        permissionId: e.permissionId,
        source: e.type === "allowed" || e.type === "revoked" || e.type === "expired" ? "chain" : "contextpass",
        tx: e.transactionHash,
        note: e.detail,
      })),
    [events],
  );

  const requestById = useCallback<ContextPassValue["requestById"]>(
    (id) => {
      const request = requests.find((r) => r.id === id);
      if (!request) return undefined;
      const recordedFor = request.permissionId ? recorded.find((p) => p.id.toLowerCase() === request.permissionId) : undefined;
      return { request, recorded: recordedFor };
    },
    [requests, recorded],
  );

  /* ── Decisions ────────────────────────────────────────────── */

  const setStep = useCallback(
    (key: string, step: TxProgress | undefined) => setProgress((p) => ({ ...p, [key]: step })),
    [],
  );
  const failWith = useCallback(
    (key: string, kind: TxFailure["kind"], detail: string) => setStep(key, { phase: "failed", failure: { kind, detail } }),
    [setStep],
  );

  const grant = useCallback(
    async (requestId: string, scopes: ScopeId[], duration: DurationId) => {
      const r = requests.find((x) => x.id === requestId);
      if (!r || scopes.length === 0) return;
      if (!chainConfigured) return failWith(requestId, "unavailable", "Permissions can’t be recorded yet: the permission contract isn’t configured.");
      if (!owner) return failWith(requestId, "unavailable", "Your signing key isn’t ready yet. Try again in a moment.");

      const app = appById(r.appSlug);
      const appK = appKey(app.slug);
      const scopeK = scopeKey(scopes);
      const expiresAt = Date.now() + DURATIONS[duration].ms;
      const labels = scopes.map((s) => SCOPE_INFO[s].label).join(" and ");

      setStep(requestId, { phase: "signing" });
      let hash: Hex | undefined;
      try {
        hash = await send(grantCall(appK, scopeK, expiresAt), {
          description: `Record your decision on Monad: ${app.name} may read ${labels} until ${whenLabel(expiresAt, Date.now())}. Nothing else is shared.`,
          buttonText: "Record permission",
          successHeader: "Sent to Monad",
          successDescription: "Return to ContextPass. The permission shows as active once Monad confirms it.",
        });
        setStep(requestId, { phase: "confirming", hash });
        await waitForConfirmation(hash);
        if (!(await readIsActive(permissionId(owner, appK, scopeK)))) throw new Error("Permission was not active after confirmation (reverted)");
      } catch (error) {
        const failure = describeFailure(error);
        setStep(requestId, { phase: "failed", failure });
        // A closed approval isn't a failure worth recording; anything else is, so it stays visible and retryable.
        if (failure.kind !== "rejected") {
          await api("POST", `/api/requests/${requestId}/fail`, { reason: failure.detail });
          await refreshRecords();
        }
        return;
      }

      // Monad confirmed it. Now ContextPass verifies the transaction itself and records the decision.
      const approved = await api<{ request: PermissionRequest }>("POST", `/api/requests/${requestId}/approve`, {
        transactionHash: hash,
        scopes,
      });
      await Promise.all([refreshRecords(), refreshChain()]);
      if (!approved.ok) {
        return failWith(
          requestId,
          "network",
          "Recorded on Monad, but ContextPass couldn’t save its record yet. It will catch up the next time you open ContextPass.",
        );
      }
      setStep(requestId, undefined);
    },
    [requests, owner, appById, send, api, refreshRecords, refreshChain, setStep, failWith],
  );

  const revoke = useCallback(
    async (id: string) => {
      const p = recorded.find((x) => x.id === id);
      if (!p) return;
      if (!owner) return failWith(id, "unavailable", "Your signing key isn’t ready yet. Try again in a moment.");
      const app = appById(p.appId);

      setStep(id, { phase: "signing" });
      let hash: Hex;
      try {
        hash = await send(revokeCall(id as Hex), {
          description: `Record on Monad that ${app.name} no longer has access to ${p.scopes.map((s) => SCOPE_INFO[s].label).join(" and ")}. It ends immediately.`,
          buttonText: "Revoke access",
          successHeader: "Sent to Monad",
          successDescription: "Return to ContextPass. Access shows as revoked once Monad confirms it.",
        });
        setStep(id, { phase: "confirming", hash });
        await waitForConfirmation(hash);
        if (await readIsActive(id as Hex)) throw new Error("Permission still active after confirmation (reverted)");
      } catch (error) {
        setStep(id, { phase: "failed", failure: describeFailure(error) });
        return;
      }

      const confirmed = await api("POST", `/api/permissions/${id}/revoked`, { transactionHash: hash });
      await Promise.all([refreshRecords(), refreshChain()]);
      if (!confirmed.ok) {
        return failWith(id, "network", "Revoked on Monad, but ContextPass couldn’t save its record yet. It will catch up shortly.");
      }
      setStep(id, undefined);
    },
    [recorded, owner, appById, send, api, refreshRecords, refreshChain, setStep, failWith],
  );

  // Deny needs no transaction: nothing was granted, so nothing goes on-chain.
  const deny = useCallback(
    async (requestId: string) => {
      const res = await api<{ request: PermissionRequest }>("POST", `/api/requests/${requestId}/deny`);
      if (!res.ok) failWith(requestId, "network", res.message);
      // Show the recorded decision now; the ledger catches up in the background.
      else setRequests((list) => list.map((r) => (r.id === requestId ? res.request : r)));
      await refreshRecords();
    },
    [api, refreshRecords, failWith],
  );

  const clearProgress = useCallback((key: string) => setStep(key, undefined), [setStep]);

  /* ── Context vault ────────────────────────────────────────── */

  const addContext = useCallback<ContextPassValue["addContext"]>(
    async (input) => {
      const res = await api<{ item: ContextItem }>("POST", "/api/context", input);
      if (res.ok) setContext((c) => [...c, res.item]);
      return res;
    },
    [api],
  );

  const updateContext = useCallback<ContextPassValue["updateContext"]>(
    async (id, patch) => {
      const res = await api<{ item: ContextItem }>("PATCH", `/api/context/${id}`, patch);
      if (res.ok) setContext((c) => c.map((x) => (x.id === id ? res.item : x)));
      return res;
    },
    [api],
  );

  const deleteContext = useCallback<ContextPassValue["deleteContext"]>(
    async (id) => {
      const res = await api<object>("DELETE", `/api/context/${id}`);
      if (res.ok) setContext((c) => c.filter((x) => x.id !== id));
      return res;
    },
    [api],
  );

  const addSampleContext = useCallback<ContextPassValue["addSampleContext"]>(async () => {
    const res = await api<{ items: ContextItem[] }>("POST", "/api/context/sample");
    if (res.ok) setContext(res.items);
    return res;
  }, [api]);

  /* Refresh when the tab comes back into view, so other tabs' decisions show up. */
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refreshRef.current();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const loading = dataStatus === "waiting" || dataStatus === "loading" || chainStatus === "waiting" || chainStatus === "loading";

  const value = useMemo<ContextPassValue>(
    () => ({
      apps,
      appById,
      context,
      requests,
      permissions,
      ledger,
      requestById,
      progress,
      chainStatus,
      dataStatus,
      loading,
      dataError,
      refresh,
      refreshChain,
      grant,
      deny,
      revoke,
      clearProgress,
      addContext,
      updateContext,
      deleteContext,
      addSampleContext,
    }),
    [
      apps,
      appById,
      context,
      requests,
      permissions,
      ledger,
      requestById,
      progress,
      chainStatus,
      dataStatus,
      loading,
      dataError,
      refresh,
      refreshChain,
      grant,
      deny,
      revoke,
      clearProgress,
      addContext,
      updateContext,
      deleteContext,
      addSampleContext,
    ],
  );

  return (
    <ContextPassContext.Provider value={value}>
      <NowContext.Provider value={now}>{children}</NowContext.Provider>
    </ContextPassContext.Provider>
  );
}

export function useContextPass(): ContextPassValue {
  const ctx = useContext(ContextPassContext);
  if (!ctx) throw new Error("useContextPass must be used inside <ContextPassProvider>");
  return ctx;
}

export function useNow(): Timestamp {
  return useContext(NowContext);
}
