"use client";

import Link from "next/link";
import { useState } from "react";
import { RequestDialog } from "@/components/app/BoundRequest";
import { RevokeControl } from "@/components/app/RevokeControl";
import { Page, PageHeader } from "@/components/app/primitives";
import { Arrow } from "@/components/ui/Button";
import { ACTION_COPY } from "@/components/ui/LedgerEntry";
import { AppMonogram, CheckGlyph, Short, StatusTag } from "@/components/ui/marks";
import { clockTime, countdown, relative, span } from "@/lib/contextpass/clock";
import { appKey } from "@/lib/chain/ids";
import { statusOf, useContextPass, useNow } from "@/lib/contextpass/store";
import type { AppRecord } from "@/lib/contextpass/types";
import { SCOPE_INFO } from "@/lib/contextpass/scopes";

export function Apps() {
  const { apps, loading } = useContextPass();
  const [reviewing, setReviewing] = useState<string | null>(null);

  return (
    <Page>
      <PageHeader
        index="03"
        label="Apps"
        title="Your guests."
        lede="Apps that can ask you for context. None of them hold it. Each one sees only what you allow, while you allow it."
        aside={<p className="type-small hidden text-muted sm:block">CodePilot and StudyOS are demo apps. Their access is real.</p>}
      />

      <ul className="mt-12 grid gap-4">
        {apps.length === 0 && loading && (
          <li className="border border-dashed border-line px-5 py-10 sm:px-8">
            <p className="type-title text-muted">Loading apps…</p>
          </li>
        )}
        {apps.length === 0 && !loading && (
          <li className="border border-dashed border-line px-5 py-10 sm:px-8">
            <p className="type-title">No connected apps yet.</p>
            <p className="type-small mt-1 text-muted">An app appears here the first time it asks for context.</p>
          </li>
        )}
        {apps.map((app) => (
          <AppRecord key={app.id} app={app} onReview={setReviewing} />
        ))}

        <li className="border border-dashed border-line px-5 py-6 sm:px-8">
          <p className="type-subtitle text-ink-2">Any AI app can connect.</p>
          <p className="type-small mt-1 max-w-[34rem] text-muted">
            Connecting gives an app the right to ask. Nothing more.
          </p>
        </li>
      </ul>

      <RequestDialog permissionId={reviewing} onClose={() => setReviewing(null)} />
    </Page>
  );
}

/** One guest. Drawn dashed: it is in your space by invitation. */
function AppRecord({ app, onReview }: { app: AppRecord; onReview: (id: string) => void }) {
  const { permissions, ledger } = useContextPass();
  const now = useNow();

  const mine = permissions.filter((p) => p.appId === app.id).map((p) => ({ p, status: statusOf(p, now) }));
  const active = mine.filter((x) => x.status === "active");
  const pending = mine.find((x) => x.status === "pending");
  const lastEvent = ledger.find((e) => e.appId === app.id);
  const soonest = active.map((x) => x.p.expiresAt!).sort((a, b) => a - b)[0];
  const visible = [...new Set(active.flatMap((x) => x.p.scopes))];

  return (
    <li>
      <article aria-labelledby={`app-${app.id}`} className="guest-outline p-5 text-line sm:p-7">
        {/* Who */}
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 text-ink">
          <div className="flex items-center gap-3.5">
            <AppMonogram app={app} />
            <div>
              <h2 id={`app-${app.id}`} className="type-title">
                {app.name}
              </h2>
              <p className="type-small text-muted">
                {app.kind} · {app.developer}
              </p>
            </div>
          </div>
          <dl className="type-mono grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-muted sm:text-right">
            <dt>Slug</dt>
            <dd className="text-ink-2">{app.slug}</dd>
            <dt>App ID</dt>
            <dd className="text-ink-2">
              <Short hash={appKey(app.slug)} />
            </dd>
          </dl>
        </header>

        <div className="mt-6 grid gap-6 border-t border-line pt-6 text-ink sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_auto] lg:gap-10">
          {/* What it can see */}
          <div>
            <div className="flex items-center gap-3">
              <p className="type-label text-ink-2">Can see now</p>
              {visible.length > 0 && <StatusTag status="active" />}
            </div>
            {visible.length > 0 ? (
              <>
                <ul className="mt-3 grid gap-1">
                  {visible.map((s) => (
                    <li key={s} className="type-subtitle flex items-center gap-2.5">
                      <CheckGlyph className="size-3.5 text-active" />
                      {SCOPE_INFO[s].label}
                    </li>
                  ))}
                </ul>
                <p className="type-small mt-2 text-muted">
                  Expires in{" "}
                  <span className="type-mono text-ink-2">
                    {soonest - now < 86_400_000 ? countdown(soonest - now) : span(soonest - now)}
                  </span>
                </p>
              </>
            ) : (
              <p className="type-subtitle mt-3 text-muted">Nothing right now.</p>
            )}
          </div>

          {/* When */}
          <div>
            <p className="type-label text-ink-2">Last activity</p>
            {lastEvent ? (
              <p className="mt-3">
                <span className="type-subtitle block">{ACTION_COPY[lastEvent.action]}</span>
                <span className="type-mono mt-0.5 block text-muted">
                  {clockTime(lastEvent.at)} · {relative(lastEvent.at, now)}
                </span>
              </p>
            ) : (
              <p className="type-small mt-3 text-muted">Nothing yet.</p>
            )}
            <Link
              href="/app/permissions"
              className="group type-small mt-3 inline-flex items-center gap-1.5 text-ink-2 underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink"
            >
              {mine.length} permission{mine.length === 1 ? "" : "s"} on record
            </Link>
          </div>

          {/* What you can do */}
          <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1 lg:w-56">
            {pending && (
              <div className="border border-dashed border-oxide p-3">
                <p className="type-label text-oxide">Asking for</p>
                <p className="type-small mt-0.5 text-ink">{pending.p.scopes.map((s) => SCOPE_INFO[s].label).join(", ")}</p>
                <button
                  type="button"
                  onClick={() => onReview(pending.p.id)}
                  className="type-action mt-3 h-10 w-full bg-ink text-[0.75rem] text-paper transition-colors hover:bg-ink-2"
                >
                  Review request
                </button>
              </div>
            )}

            {active.some((x) => x.p.source === "chain") && (
              <RevokeControl
                ids={active.filter((x) => x.p.source === "chain").map((x) => x.p.id)}
                appName={app.name}
                compact
              />
            )}

            {(app.slug === "code-pilot" || app.slug === "study-os") && (
              <Link
                href={`/apps/${app.slug}`}
                className="group type-action inline-flex h-10 items-center justify-center gap-2 border border-dashed border-ink px-4 text-[0.75rem] transition-colors hover:bg-ink hover:text-paper"
              >
                Open {app.name} <Arrow />
              </Link>
            )}
            <Link href="/app/activity" className="group type-action inline-flex h-10 items-center gap-2 text-[0.75rem]">
              View activity <Arrow />
            </Link>
          </div>
        </div>
      </article>
    </li>
  );
}
