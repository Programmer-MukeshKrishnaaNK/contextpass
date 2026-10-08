"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequestDialog } from "@/components/app/BoundRequest";
import { Empty, Page, PageHeader, Segmented } from "@/components/app/primitives";
import { RevokeControl } from "@/components/app/RevokeControl";
import { AppMonogram, Short, StatusTag } from "@/components/ui/marks";
import { TxHash } from "@/components/ui/TxHash";
import { SCOPE_INFO } from "@/lib/contextpass/scopes";
import { clockTime, countdown, DURATIONS, relative, span, whenLabel } from "@/lib/contextpass/clock";
import { statusOf, useContextPass, useNow } from "@/lib/contextpass/store";
import type { Permission, PermissionStatus } from "@/lib/contextpass/types";

type Filter = "all" | "active" | "pending" | "ended";

/**
 * Stable order: open requests first, then on-chain permissions by grant time,
 * then denials. A row changes state in place (active → revoked) rather than
 * jumping away from the cursor.
 */
function rank(p: Permission): number {
  if (p.source === "chain") return 1;
  return p.status === "denied" ? 2 : 0;
}

export function Permissions() {
  const { permissions, chainStatus, refreshChain, loading } = useContextPass();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");
  const [reviewing, setReviewing] = useState<string | null>(null);

  // Deep link from an app: /app/permissions?review=<request>&return=/apps/<slug>
  const params = useSearchParams();
  const router = useRouter();
  const reviewParam = params.get("review");
  const returnTo = params.get("return");
  const safeReturn = returnTo && /^\/apps\/[a-z0-9-]+$/.test(returnTo) ? returnTo : null;
  useEffect(() => {
    // Opening the requested review once the request has loaded is this effect's job.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reviewParam && permissions.some((p) => p.id === reviewParam)) setReviewing(reviewParam);
  }, [reviewParam, permissions]);

  const closeReview = () => {
    setReviewing(null);
    if (safeReturn && reviewParam) router.push(safeReturn);
  };

  const withStatus = permissions
    .map((p) => ({ p, status: statusOf(p, now) }))
    .sort((a, b) => rank(a.p) - rank(b.p) || b.p.requestedAt - a.p.requestedAt);

  const count = (f: Filter) => withStatus.filter((x) => matches(x.status, f)).length;
  const visible = withStatus.filter((x) => matches(x.status, filter));

  return (
    <Page>
      <PageHeader
        index="04"
        label="Permissions"
        title="Every grant, and when it ends."
        lede="Each permission names an app, the context it covers, and its expiry. Granted permissions are recorded on Monad; revoke any of them at any time."
      />

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <Segmented
          label="Filter permissions"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: count("all") },
            { value: "active", label: "Active", count: count("active") },
            { value: "pending", label: "Pending", count: count("pending") },
            { value: "ended", label: "Ended", count: count("ended") },
          ]}
        />
        <ChainNote status={chainStatus} onRetry={refreshChain} />
      </div>

      <ul className="mt-8 border-t border-ink" aria-live="polite">
        {visible.length === 0 && loading && (
          <li>
            <Empty title="Reading your permissions…">{null}</Empty>
          </li>
        )}
        {visible.length === 0 && !loading && (
          <li>
            <Empty title={filter === "active" ? "No active permissions." : filter === "pending" ? "Nothing is waiting for you." : "Nothing here yet."}>
              {filter === "active" ? "Nothing is being shared right now." : null}
            </Empty>
          </li>
        )}
        {visible.map(({ p, status }) => (
          <PermissionRow key={p.id} p={p} status={status} now={now} onReview={() => setReviewing(p.id)} />
        ))}
      </ul>

      <RequestDialog permissionId={reviewing} onClose={closeReview} />
    </Page>
  );
}

function ChainNote({ status, onRetry }: { status: string; onRetry: () => void }) {
  if (status === "unconfigured") return <p className="type-small text-muted">The permission contract isn’t configured yet.</p>;
  if (status === "loading" || status === "waiting") return <p className="type-small text-muted">Reading your permissions from Monad…</p>;
  if (status === "error")
    return (
      <p className="type-small text-ink">
        Couldn’t read from Monad.{" "}
        <button type="button" onClick={onRetry} className="underline underline-offset-4">
          Try again
        </button>
      </p>
    );
  return <p className="type-small text-muted">Permissions read from Monad. Requests and decisions are kept by ContextPass.</p>;
}

function matches(s: PermissionStatus, f: Filter) {
  if (f === "all") return true;
  if (f === "ended") return s === "expired" || s === "revoked" || s === "denied";
  if (f === "pending") return s === "pending" || s === "failed";
  return s === f;
}

function PermissionRow({
  p,
  status,
  now,
  onReview,
}: {
  p: Permission;
  status: PermissionStatus;
  now: number;
  onReview: () => void;
}) {
  const { appById } = useContextPass();
  const app = appById(p.appId);
  const ended = status === "expired" || status === "revoked" || status === "denied";
  const left = (p.expiresAt ?? now) - now;
  const total = (p.expiresAt ?? now) - (p.grantedAt ?? now);

  return (
    <li
      className={`-mx-3 border-b border-line px-3 py-7 transition-colors duration-500 sm:-mx-5 sm:px-5 sm:py-8 ${
        status === "pending" ? "bg-oxide-soft/40" : ""
      }`}
    >
      <article
        aria-label={`${app.name}, ${status}`}
        className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6 lg:grid-cols-[1.1fr_1.1fr_1fr_auto] lg:gap-8"
      >
        {/* App */}
        <div className="col-span-2 flex items-start gap-4 sm:col-span-1">
          <AppMonogram app={app} className={ended ? "text-muted" : ""} />
          <div className="min-w-0">
            <h2 className={`type-title ${ended ? "text-ink-2" : ""}`}>{app.name}</h2>
            <p className="type-small text-muted">{app.kind}</p>
            <p className="type-mono mt-2 text-muted">{p.source === "chain" ? <Short hash={p.id} /> : p.id}</p>
          </div>
        </div>

        {/* Scope */}
        <div>
          <p className="type-label text-ink-2">Context scope</p>
          <ul className="mt-2 grid gap-0.5">
            {p.scopes.map((s) => (
              <li key={s} className={`type-subtitle ${status === "revoked" || status === "denied" ? "text-muted line-through decoration-1" : ended ? "text-muted" : ""}`}>
                {SCOPE_INFO[s].label}
              </li>
            ))}
          </ul>
          {p.requestedScopes && p.requestedScopes.length > p.scopes.length && (
            <p className="type-small mt-1 text-muted">
              Not shared: {p.requestedScopes.filter((s) => !p.scopes.includes(s)).map((s) => SCOPE_INFO[s].label).join(", ")}
            </p>
          )}
        </div>

        {/* Status + time */}
        <div>
          <StatusTag status={status} />
          <div key={status} className="mt-3 animate-ticker">
            {status === "active" && (
              <>
                <p className="type-label text-ink-2">Expires in</p>
                <p className="type-headline mt-1 tabular-nums">{left < 24 * 3600_000 ? countdown(left) : span(left)}</p>
                <p className="type-small mt-1 text-muted">
                  Ends <span className="type-mono text-[0.8125rem] text-ink-2">{whenLabel(p.expiresAt!, now)}</span>
                </p>
                <div className="mt-3 h-[2px] max-w-[14rem] bg-line" aria-hidden="true">
                  <div className="h-full bg-active transition-[width] duration-1000 ease-linear" style={{ width: `${Math.max(0, (left / total) * 100)}%` }} />
                </div>
              </>
            )}
            {status === "pending" && (
              <>
                <p className="type-small text-ink-2">
                  Asking for <span className="text-ink">{p.duration ? DURATIONS[p.duration].label : "a while"}</span>
                </p>
                <p className="type-small mt-1 text-muted">
                  Requested <span className="type-mono text-[0.8125rem] text-ink-2">{relative(p.requestedAt, now).toLowerCase()}</span>
                </p>
              </>
            )}
            {status === "expired" && (
              <p className="type-small text-muted">
                Ended on its own at <span className="type-mono text-[0.8125rem] text-ink-2">{clockTime(p.expiresAt!)}</span>
              </p>
            )}
            {status === "revoked" && (
              <p className="type-small text-ink-2">
                You revoked it at <span className="type-mono text-[0.8125rem] text-ink-2">{clockTime(p.revokedAt!)}</span>
              </p>
            )}
            {status === "denied" && (
              <p className="type-small text-ink-2">
                You denied it at <span className="type-mono text-[0.8125rem] text-ink-2">{clockTime(p.deniedAt ?? p.requestedAt)}</span>. Nothing was shared.
              </p>
            )}
          </div>
        </div>

        {/* Record + action */}
        <div className="col-span-2 flex flex-col gap-4 sm:col-span-1 lg:w-56">
          <div>
            <p className="type-label text-ink-2">Record</p>
            {p.source === "chain" ? (
              <>
                <p className="type-small mt-1 text-active">Secured on Monad</p>
                {p.grantTx && (
                  <p className="type-small mt-1 text-muted">
                    Granted <TxHash hash={p.grantTx} />
                  </p>
                )}
                {p.revokeTx && (
                  <p className="type-small mt-1 text-muted">
                    Revoked <TxHash hash={p.revokeTx} />
                  </p>
                )}
              </>
            ) : status === "denied" ? (
              <p className="type-small mt-1 text-muted">You declined. No transaction was needed.</p>
            ) : (
              <p className="type-small mt-1 text-muted">
                {status === "failed"
                  ? "Not recorded on Monad. You can try again."
                  : status === "expired"
                    ? "Expired before you decided. Nothing was shared."
                    : "Waiting for your decision. Nothing is recorded on Monad yet."}
              </p>
            )}
          </div>

          {status === "active" && p.source === "chain" && <RevokeControl ids={[p.id]} appName={app.name} />}

          {(status === "pending" || status === "failed") && (
            <button
              type="button"
              onClick={onReview}
              className="type-action h-11 bg-ink px-4 text-paper transition-colors hover:bg-ink-2"
            >
              Review request
            </button>
          )}
        </div>
      </article>
    </li>
  );
}
