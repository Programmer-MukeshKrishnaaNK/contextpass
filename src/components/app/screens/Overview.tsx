"use client";

import Link from "next/link";
import { useState } from "react";
import { BoundRequest } from "@/components/app/BoundRequest";
import { Band, Page, PageHeader } from "@/components/app/primitives";
import { Arrow } from "@/components/ui/Button";
import { LedgerEntry, LedgerSpine } from "@/components/ui/LedgerEntry";
import { AppMonogram } from "@/components/ui/marks";
import { calendarDate, clockTime, countdown, greeting, relative, span } from "@/lib/contextpass/clock";
import { SCOPE_INFO, SCOPES } from "@/lib/contextpass/scopes";
import { isPermissionActive, useContextPass, useNow } from "@/lib/contextpass/store";

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six"];
const word = (n: number) => WORDS[n] ?? String(n);

export function Overview() {
  const { apps, context, permissions, ledger, appById, requestById, loading } = useContextPass();
  const now = useNow();
  // Requests decided here stay on screen until dismissed, so the stamp can be read.
  const [kept, setKept] = useState<string[]>([]);

  // Pending requests, plus any decided here that are still showing their stamp.
  const pendingIds = permissions.filter((p) => p.status === "pending" || p.status === "failed").map((p) => p.id);
  const toReview = [...pendingIds, ...kept.filter((id) => !pendingIds.includes(id))]
    .map((id) => requestById(id)?.request)
    .filter((r) => r !== undefined);
  const pendingCount = pendingIds.length;
  const active = permissions.filter((p) => p.source === "chain" && isPermissionActive(p, now));
  const appsWithAccess = new Set(active.map((p) => p.appId)).size;

  return (
    <Page>
      <PageHeader
        index="01"
        label="Overview"
        title={
          <>
            {greeting(now).replace(".", "")}
            <span className="text-oxide">.</span>
          </>
        }
        lede="Your context is under your control."
        aside={
          <p className="type-mono hidden text-muted sm:block">
            {calendarDate(now)} · <span className="text-ink">{clockTime(now)}</span>
          </p>
        }
      />

      {/* ── The state of things, in a sentence ── */}
      <section aria-label="Status" className="mt-10 border-t border-ink pt-6 sm:mt-14 sm:pt-8">
        {loading ? (
          <p className="type-headline max-w-[34ch] text-muted">Reading your permissions from Monad…</p>
        ) : (
          <p className="type-headline max-w-[34ch] text-ink-2">
            <span className="text-ink">
              {word(appsWithAccess)} app{appsWithAccess === 1 ? "" : "s"}
            </span>{" "}
            {appsWithAccess === 0 ? "can see your context right now." : "can see part of your context right now."}{" "}
            {pendingCount > 0 ? (
              <a href="#decide" className="text-oxide underline decoration-1 underline-offset-[0.18em] hover:decoration-2">
                {word(pendingCount)} {pendingCount === 1 ? "is" : "are"} waiting for you.
              </a>
            ) : (
              <span>Nothing is waiting for you.</span>
            )}
          </p>
        )}
        <ul className="type-small mt-5 flex flex-wrap gap-x-6 gap-y-2 text-muted">
          <li>
            <Link href="/app/apps" className="underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink">
              <span className="text-ink">{apps.length}</span> apps can ask
            </Link>
          </li>
          <li>
            <Link href="/app/permissions" className="underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink">
              <span className="text-ink">{active.length}</span> active permissions
            </Link>
          </li>
          <li>
            <Link href="/app/activity" className="underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink">
              <span className="text-ink">{ledger.length}</span> access events
            </Link>
          </li>
        </ul>
      </section>

      {/* ── Needs a decision ── */}
      <Band id="decide" title="Needs your decision" meta={pendingCount > 0 ? `${pendingCount} waiting` : undefined}>
        {toReview.length > 0 ? (
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,32rem)_1fr] lg:gap-14">
            <div className="grid gap-8">
              {toReview.map((p) => (
                <BoundRequest
                  key={p.id}
                  permissionId={p.id}
                  onDecided={(id) => setKept((k) => (k.includes(id) ? k : [...k, id]))}
                  onDone={() => setKept((k) => k.filter((x) => x !== p.id))}
                />
              ))}
            </div>
            <aside className="max-w-[24rem] lg:pt-1">
              <p className="type-title">Nothing is shared until you say so.</p>
              <p className="type-body mt-3 text-ink-2">
                {appById(toReview[0].appSlug).name} asked {relative(toReview[0].requestedAt, now).toLowerCase()}. It has seen nothing yet.
              </p>
              <ul className="type-small mt-6 grid gap-2.5 border-t border-line pt-4 text-ink-2">
                <li>Untick any scope to keep it.</li>
                <li>Shorter is safer. You can always allow again.</li>
                <li>Revoking takes effect on the next read.</li>
              </ul>
            </aside>
          </div>
        ) : (
          <div className="flex flex-col gap-4 border-b border-line py-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="type-title">Nothing is waiting for you.</p>
              <p className="type-small mt-1 text-muted">When an app asks for context, the request appears here first.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["code-pilot", "study-os"].map((slug) => (
                <Link
                  key={slug}
                  href={`/apps/${slug}`}
                  className="group type-action inline-flex h-10 items-center gap-2 border border-dashed border-ink px-4 transition-colors hover:bg-ink hover:text-paper"
                >
                  Open {appById(slug).name === "Unknown app" ? slug : appById(slug).name} <Arrow />
                </Link>
              ))}
            </div>
          </div>
        )}
      </Band>

      <div className="grid gap-x-14 lg:grid-cols-2">
        {/* ── Active now ── */}
        <Band title="Active now" meta={`${active.length} permission${active.length === 1 ? "" : "s"}`}>
          {active.length === 0 && loading ? (
            <p className="type-small border-b border-line py-8 text-muted">Reading from Monad…</p>
          ) : active.length === 0 ? (
            <p className="type-small border-b border-line py-8 text-muted">No active permissions. Nothing is being shared.</p>
          ) : (
            <ul className="divide-y divide-line border-b border-line">
              {active.map((p) => {
                const app = appById(p.appId);
                const left = (p.expiresAt ?? now) - now;
                const total = (p.expiresAt ?? now) - (p.grantedAt ?? now);
                return (
                  <li key={p.id}>
                    <Link href="/app/permissions" className="group block py-5">
                      <span className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                        <AppMonogram app={app} />
                        <span className="min-w-0">
                          <span className="type-subtitle block group-hover:underline group-hover:underline-offset-4">{app.name}</span>
                          <span className="type-small block truncate text-muted">
                            {p.scopes.map((s) => SCOPE_INFO[s].label).join(", ")}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="type-small block text-muted">Expires in</span>
                          <span className="type-title block tabular-nums">{left < 86_400_000 ? countdown(left) : span(left)}</span>
                        </span>
                      </span>
                      <span className="mt-4 block h-[2px] bg-line" aria-hidden="true">
                        <span
                          className="block h-full bg-active transition-[width] duration-1000 ease-linear"
                          style={{
                            width: `${Math.max(0, Math.min(100, (left / total) * 100))}%`,
                          }}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/app/permissions" className="group type-action mt-5 inline-flex items-center gap-2">
            Manage permissions <Arrow />
          </Link>
        </Band>

        {/* ── Ledger ── */}
        <Band title="Latest in the ledger" meta={`${ledger.length} events`}>
          <ol className="relative border-b border-line">
            <LedgerSpine />
            {ledger.slice(0, 4).map((e) => (
              <LedgerEntry key={e.id} event={e} app={appById(e.appId)} compact />
            ))}
          </ol>
          <Link href="/app/activity" className="group type-action mt-5 inline-flex items-center gap-2">
            Open the ledger <Arrow />
          </Link>
        </Band>
      </div>

      {/* ── Your context at a glance ── */}
      <Band title="Your context" meta="Held by you">
        <ul className="grid gap-px border-b border-line bg-line lg:grid-cols-5">
          {SCOPES.map((scope) => {
            const count = context.filter((c) => c.scope === scope).length;
            const holders = [...new Set(active.filter((p) => p.scopes.includes(scope)).map((p) => p.appId))].map(appById);
            return (
              <li key={scope} className="bg-paper py-4 lg:px-4 lg:py-5 lg:first:pl-0 lg:last:pr-0">
                <Link href="/app/context" className="group flex h-full items-center justify-between gap-4 lg:flex-col lg:items-start">
                  <span>
                    <span className="type-subtitle block group-hover:underline group-hover:underline-offset-4">
                      {SCOPE_INFO[scope].label}
                    </span>
                    <span className="type-small block text-muted">
                      {count} item{count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="flex min-h-7 items-center gap-1.5 lg:mt-auto lg:pt-3">
                    {holders.length > 0 ? (
                      <>
                        <span className="type-small mr-1 text-ink-2">Readable by</span>
                        {holders.map((a) => (
                          <AppMonogram key={a.slug} app={a} size="sm" />
                        ))}
                      </>
                    ) : (
                      <span className="type-small text-muted">Not shared</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Band>
    </Page>
  );
}
