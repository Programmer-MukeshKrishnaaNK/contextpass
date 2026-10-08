"use client";

import { useState } from "react";
import { Empty, Page, PageHeader, Segmented } from "@/components/app/primitives";
import { LedgerEntry, LedgerNode, LedgerSpine } from "@/components/ui/LedgerEntry";
import { calendarDate, dayLabel } from "@/lib/contextpass/clock";
import { useContextPass, useNow } from "@/lib/contextpass/store";
import type { LedgerAction, LedgerEvent } from "@/lib/contextpass/types";

type Filter = "all" | "requests" | "grants" | "access" | "ended";

const GROUPS: Record<Exclude<Filter, "all">, LedgerAction[]> = {
  requests: ["requested"],
  grants: ["granted"],
  access: ["accessed", "blocked"],
  ended: ["revoked", "expired", "denied", "failed"],
};

const LEGEND: LedgerAction[] = ["requested", "granted", "accessed", "blocked", "revoked", "expired", "denied", "failed"];
const LEGEND_LABEL: Record<LedgerAction, string> = {
  requested: "Requested",
  granted: "Granted",
  accessed: "Accessed",
  blocked: "Blocked",
  failed: "Not recorded",
  revoked: "Revoked",
  expired: "Expired",
  denied: "Denied",
};

export function Activity() {
  const { ledger, appById, dataStatus } = useContextPass();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");
  // Anything recorded after this screen opened animates in.
  const [seen] = useState(() => new Set(ledger.map((e) => e.id)));

  const visible = filter === "all" ? ledger : ledger.filter((e) => GROUPS[filter].includes(e.action));
  const count = (f: Filter) => (f === "all" ? ledger.length : ledger.filter((e) => GROUPS[f].includes(e.action)).length);

  const days: { label: string; date: string; events: LedgerEvent[] }[] = [];
  for (const e of visible) {
    const label = dayLabel(e.at, now);
    const last = days[days.length - 1];
    if (last && last.label === label) last.events.push(e);
    else days.push({ label, date: calendarDate(e.at), events: [e] });
  }

  return (
    <Page>
      <PageHeader
        index="05"
        label="Activity"
        title="The permission ledger."
        lede="Every request, grant, read and revocation, in the order it happened. Nothing is left out."
      />

      <div className="mt-10 flex flex-col gap-5">
        <Segmented
          label="Filter events"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: count("all") },
            { value: "requests", label: "Requests", count: count("requests") },
            { value: "grants", label: "Grants", count: count("grants") },
            { value: "access", label: "Access", count: count("access") },
            { value: "ended", label: "Ended", count: count("ended") },
          ]}
        />
        <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
          {LEGEND.map((a) => (
            <li key={a} className="type-small flex items-center gap-2 text-ink-2">
              <LedgerNode action={a} />
              {LEGEND_LABEL[a]}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10">
        {days.length === 0 && (
          <Empty title={dataStatus === "loading" || dataStatus === "waiting" ? "Reading your ledger…" : "Nothing has happened yet."}>
            {dataStatus === "ready" ? "When an app asks for context, the request is recorded here first." : null}
          </Empty>
        )}
        {days.map((d) => (
          <section key={d.label} aria-label={`${d.label}, ${d.date}`} className="mb-12">
            <div className="sticky top-14 z-10 flex items-baseline justify-between border-b border-ink bg-paper py-3 lg:top-0">
              <h2 className="type-title">{d.label}</h2>
              <p className="type-mono text-muted">
                {d.date} · {d.events.length} event{d.events.length === 1 ? "" : "s"}
              </p>
            </div>
            <ol className="relative">
              <LedgerSpine />
              {d.events.map((e) => (
                <LedgerEntry key={e.id} event={e} app={appById(e.appId)} fresh={!seen.has(e.id)} />
              ))}
            </ol>
          </section>
        ))}
      </div>

      <p className="type-small flex items-center gap-2 border-t border-line pt-4 text-muted">
        Rows marked On Monad are permission changes on the contract, with their transactions. Everything else — requests,
        denials, reads, blocks — is recorded by ContextPass, off-chain. Context itself never goes on-chain.
      </p>
    </Page>
  );
}
