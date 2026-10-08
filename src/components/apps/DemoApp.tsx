"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mark } from "@/components/brand/Wordmark";
import { Arrow } from "@/components/ui/Button";
import { AppMonogram, CheckGlyph, Microprint, Short } from "@/components/ui/marks";
import { TxHash } from "@/components/ui/TxHash";
import { createContextPassClient, type AppAnswer, type AuthorizedContext, type BlockReason } from "@/lib/contextpass-sdk";
import { clockTime, DURATIONS, whenLabel } from "@/lib/contextpass/clock";
import { SCOPE_INFO } from "@/lib/contextpass/scopes";
import type { AppRecord, PermissionRequest } from "@/lib/contextpass/types";
import { useIdentity } from "@/lib/identity/IdentityProvider";

/**
 * A demo AI app that uses ContextPass the way any app would: through the
 * consumer SDK, never the database. It asks; the person decides in
 * ContextPass; the gate on the server checks Monad on every read.
 */

const COPY: Record<string, { tagline: string; task: string; action: string }> = {
  "code-pilot": {
    tagline: "Coding guidance that fits your projects and the way you write code.",
    task: "What should I work on next, and how should I approach it?",
    action: "Ask CodePilot",
  },
  "study-os": {
    tagline: "Study sessions planned around how you like to learn.",
    task: "Plan a 30-minute study session for tonight.",
    action: "Ask StudyOS",
  },
};

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "answered"; answer: AppAnswer; authorized: AuthorizedContext }
  | { kind: "needs-access" }
  | { kind: "requested"; request: PermissionRequest }
  | { kind: "blocked"; reason: BlockReason; message: string }
  | { kind: "error"; message: string };

export function DemoApp({ slug }: { slug: string }) {
  const identity = useIdentity();
  const cp = useMemo(() => createContextPassClient({ getAccessToken: identity.getAccessToken }), [identity.getAccessToken]);
  const copy = COPY[slug];

  const [app, setApp] = useState<AppRecord>();
  const [task, setTask] = useState(copy.task);
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    void cp.apps().then((res) => res.ok && setApp(res.apps.find((a) => a.slug === slug)));
  }, [cp, slug]);

  const scopes = app?.requestedScopes ?? [];
  const scopeNames = scopes.map((s) => SCOPE_INFO[s].label).join(" + ");

  const ask = useCallback(async () => {
    if (!app) return;
    setState({ kind: "working" });
    const res = await cp.respond({ app: app.slug, scopes: app.requestedScopes, task });
    if (res.ok) return setState({ kind: "answered", answer: res.answer, authorized: res.authorized });
    if (res.status === 403 && res.reason === "no-permission") return setState({ kind: "needs-access" });
    if (res.status === 403) return setState({ kind: "blocked", reason: res.reason ?? "no-permission", message: res.message });
    setState({ kind: "error", message: res.message });
  }, [app, cp, task]);

  const requestAccess = useCallback(async () => {
    if (!app) return;
    setState({ kind: "working" });
    const res = await cp.requestAccess({ app: app.slug, scopes: app.requestedScopes, duration: app.defaultDuration });
    if (res.ok) setState({ kind: "requested", request: res.request });
    else setState({ kind: "error", message: res.message });
  }, [app, cp]);

  const signedIn = identity.status === "signed-in";
  const reviewHref = (id: string) => `/app/permissions?review=${id}&return=${encodeURIComponent(`/apps/${slug}`)}`;

  return (
    <div className="min-h-dvh">
      {/* Guest frame: this is an app, not ContextPass */}
      <header className="border-b border-dashed border-ink-2">
        <div className="mx-auto flex h-16 max-w-[72rem] items-center justify-between gap-4 px-[var(--gutter)]">
          <div className="flex items-center gap-3">
            <AppMonogram app={app ?? { monogram: slug === "code-pilot" ? "Cp" : "St", name: slug }} />
            <div>
              <p className="type-subtitle leading-none">{app?.name ?? "…"}</p>
              <p className="type-small text-muted">{app?.kind ?? "AI app"} · demo</p>
            </div>
          </div>
          <Link href="/app" className="group type-small inline-flex items-center gap-2 text-ink-2 hover:text-ink">
            <Mark className="size-4" /> Back to ContextPass
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto grid max-w-[72rem] gap-10 px-[var(--gutter)] pb-24 pt-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14 lg:pt-14">
        <section aria-labelledby="app-title" className="min-w-0">
          <h1 id="app-title" className="type-display">
            {app?.name ?? "Loading…"}
          </h1>
          <p className="type-lede mt-4 max-w-[34rem] text-ink-2">{copy.tagline}</p>
          <p className="type-small mt-3 max-w-[34rem] text-muted">
            Reads {scopeNames || "your context"} only through ContextPass, and only while you allow it.
          </p>

          {!signedIn ? (
            <div className="mt-10 border border-dashed border-ink-2 px-5 py-6">
              <p className="type-title">Sign in with ContextPass to continue.</p>
              <p className="type-small mt-1 text-muted">{app?.name ?? "This app"} never sees your context unless you allow it.</p>
              <button
                type="button"
                onClick={identity.connect}
                disabled={identity.status === "initializing" || identity.connecting}
                className="type-action mt-5 h-11 bg-ink px-5 text-paper hover:bg-ink-2 disabled:opacity-50"
              >
                {identity.status === "initializing" ? "Establishing identity…" : "Connect ContextPass"}
              </button>
            </div>
          ) : (
            <>
              <form
                className="mt-10 grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask();
                }}
              >
                <label htmlFor="task" className="type-label text-ink-2">
                  What do you need?
                </label>
                <textarea
                  id="task"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="type-body resize-y border border-ink-2 bg-stock px-3 py-2 focus:border-ink focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!app || state.kind === "working" || !task.trim()}
                  className="group type-action inline-flex h-12 items-center justify-between gap-3 self-start border border-dashed border-ink px-5 transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
                >
                  {state.kind === "working" ? "Asking ContextPass…" : copy.action} {state.kind !== "working" && <Arrow />}
                </button>
              </form>

              <div className="mt-8" aria-live="polite">
                {state.kind === "needs-access" && app && (
                  <div className="border border-dashed border-oxide px-5 py-5">
                    <p className="type-label text-oxide">ContextPass says: no access yet</p>
                    <p className="type-title mt-2">
                      {app.name} wants {scopeNames} for {DURATIONS[app.defaultDuration].label}.
                    </p>
                    <p className="type-small mt-1 text-ink-2">{app.reason}</p>
                    <button
                      type="button"
                      onClick={requestAccess}
                      className="type-action mt-5 h-11 bg-ink px-5 text-paper transition-colors hover:bg-ink-2"
                    >
                      Ask ContextPass for access
                    </button>
                  </div>
                )}

                {state.kind === "requested" && (
                  <div className="border border-dashed border-oxide px-5 py-5">
                    <p className="type-label text-oxide">Waiting for your decision</p>
                    <p className="type-title mt-2">The request is in ContextPass.</p>
                    <p className="type-small mt-1 text-ink-2">
                      You decide there. {app?.name} can’t see anything until you allow it.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link href={reviewHref(state.request.id)} className="group type-action inline-flex h-11 items-center gap-2 bg-ink px-5 text-paper hover:bg-ink-2">
                        Review in ContextPass <Arrow />
                      </Link>
                      <button type="button" onClick={ask} className="type-action h-11 border border-ink px-5 hover:bg-paper-2">
                        Try again
                      </button>
                    </div>
                  </div>
                )}

                {state.kind === "blocked" && <Blocked state={state} appName={app?.name ?? "This app"} onRequest={requestAccess} />}

                {state.kind === "error" && (
                  <div role="alert" className="border-l-2 border-ink pl-4">
                    <p className="type-subtitle">That didn’t go through.</p>
                    <p className="type-small text-ink-2">{state.message}</p>
                  </div>
                )}

                {state.kind === "answered" && (
                  <article aria-label={`${app?.name} answer`} className="border border-dashed border-ink-2 px-5 py-5">
                    <p className="type-label text-ink-2">{app?.name}</p>
                    <div className="type-body mt-3 whitespace-pre-line text-ink">{state.answer.text}</div>
                    <p className="type-small mt-4 border-t border-line pt-3 text-muted">
                      {state.answer.provider === "claude" ? `Written by ${state.answer.model ?? "Claude"} from your authorized context.` : state.answer.note}
                    </p>
                    {state.answer.provider === "claude" && state.answer.note && <p className="type-small text-muted">{state.answer.note}</p>}
                  </article>
                )}
              </div>
            </>
          )}
        </section>

        <aside aria-label="ContextPass receipt" className="lg:pt-2">
          {state.kind === "answered" ? (
            <Receipt authorized={state.authorized} app={app} />
          ) : (
            <div className="border border-line px-5 py-5 text-muted">
              <p className="type-system">ContextPass receipt</p>
              <p className="type-small mt-3">
                When {app?.name ?? "the app"} reads your context, ContextPass shows exactly what it received, and why it
                was allowed.
              </p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function Blocked({ state, appName, onRequest }: { state: Extract<State, { kind: "blocked" }>; appName: string; onRequest: () => void }) {
  const title = state.reason === "revoked" ? "Access revoked" : state.reason === "expired" ? "Access expired" : "No access";
  return (
    <div role="alert" className="border border-ink bg-stock px-5 py-5">
      <div className="inline-block border-[3px] border-double border-ink px-4 py-2.5">
        <p className="type-system">ContextPass</p>
        <p className="mt-1 font-display text-[1.5rem] uppercase leading-none" style={{ fontWeight: 640 }}>
          {title}
        </p>
      </div>
      <p className="type-title mt-4">{state.message}</p>
      <p className="type-small mt-1 text-ink-2">
        Nothing was shared with {appName}. ContextPass checked Monad and found no active permission.
      </p>
      <button type="button" onClick={onRequest} className="type-action mt-5 h-11 border border-ink px-5 hover:bg-ink hover:text-paper">
        Ask for access again
      </button>
    </div>
  );
}

function Receipt({ authorized, app }: { authorized: AuthorizedContext; app?: AppRecord }) {
  return (
    <div className="bg-stock text-ink shadow-[inset_0_0_0_1px_var(--ink)]">
      <div className="flex h-10 items-center justify-between border-b border-ink px-5">
        <span className="flex items-center gap-2">
          <Mark className="size-4" />
          <span className="type-system">ContextPass receipt</span>
        </span>
        <span className="type-mono text-muted">{clockTime(authorized.receipt.verifiedAt)}</span>
      </div>
      <div className="grid gap-5 px-5 py-5">
        <div className="flex items-center gap-3">
          {app && <AppMonogram app={app} size="sm" />}
          <div>
            <p className="type-subtitle">{authorized.app.name}</p>
            <p className="type-small text-active">Access granted</p>
          </div>
        </div>

        <div>
          <p className="type-label text-ink-2">Granted scopes</p>
          <ul className="mt-1.5 grid gap-1">
            {authorized.granted.map((s) => (
              <li key={s} className="type-subtitle flex items-center gap-2">
                <CheckGlyph className="size-3.5 text-active" />
                {SCOPE_INFO[s].label}
              </li>
            ))}
            {authorized.withheld.map((s) => (
              <li key={s} className="type-subtitle text-muted line-through decoration-1">
                {SCOPE_INFO[s].label}
              </li>
            ))}
          </ul>
          {authorized.withheld.length > 0 && <p className="type-small mt-1 text-muted">Struck scopes weren’t authorized and weren’t sent.</p>}
        </div>

        <div className="border-t border-line pt-4">
          <p className="type-small text-active">Permission active · verified on Monad</p>
          <p className="type-small text-muted">Checked with isPermissionActive at {clockTime(authorized.receipt.verifiedAt)}.</p>
          {authorized.receipt.permissions.map((p) => (
            <dl key={p.id} className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="type-small text-muted">Permission</dt>
              <dd className="type-mono">
                <Short hash={p.id} />
              </dd>
              <dt className="type-small text-muted">Expires</dt>
              <dd className="type-mono">{whenLabel(p.expiresAt, authorized.receipt.verifiedAt)}</dd>
              {p.transactionHash && (
                <>
                  <dt className="type-small text-muted">Granted in</dt>
                  <dd>
                    <TxHash hash={p.transactionHash} />
                  </dd>
                </>
              )}
            </dl>
          ))}
        </div>

        <div className="border-t border-line pt-4">
          <p className="type-label text-ink-2">What {authorized.app.name} received</p>
          {authorized.context.map((c) => (
            <div key={c.scope} className="mt-3">
              <p className="type-small text-muted">{c.label}</p>
              {c.items.length === 0 ? (
                <p className="type-small text-ink-2">Nothing stored in this scope yet.</p>
              ) : (
                <ul className="mt-1 grid gap-1">
                  {c.items.map((i, n) => (
                    <li key={n} className="type-small break-words text-ink">
                      <span className="font-display" style={{ fontWeight: 560 }}>
                        {i.title}
                      </span>
                      : {i.content}
                      {i.isSample && <span className="text-muted"> (sample)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <p className="type-small mt-4 text-muted">
            The permission lives on Monad. This read was logged by ContextPass, off-chain; the context itself never goes on-chain.
          </p>
        </div>
      </div>
      <div className="border-t border-line px-5 py-2 text-muted">
        <Microprint />
      </div>
    </div>
  );
}
