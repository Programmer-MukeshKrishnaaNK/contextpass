"use client";

import { useId, useState } from "react";
import { clockTime, DURATIONS, whenLabel } from "@/lib/contextpass/clock";
import type { ScopeInfo } from "@/lib/contextpass/scopes";
import type { AppRecord, DurationId, ScopeId, Timestamp } from "@/lib/contextpass/types";
import { AppMonogram, CheckGlyph, DashGlyph, Microprint } from "./marks";
import { TxHash } from "./TxHash";

export type Resolution =
  | {
      kind: "granted";
      scopes: ScopeId[];
      duration: DurationId;
      at: Timestamp;
      expiresAt: Timestamp;
      /** True only when this grant was read back from the contract on Monad. */
      onChain: boolean;
      /** The confirmed transaction, when known. */
      tx?: string;
    }
  | { kind: "denied"; at: Timestamp };

/** Where a real decision is, while it is being recorded. */
export type Progress =
  | { phase: "signing" }
  | { phase: "confirming"; hash: string }
  | { phase: "failed"; detail: string };

interface Props {
  app: Pick<AppRecord, "name" | "kind" | "monogram" | "developer">;
  requestId: string;
  requestedAt: Timestamp;
  scopes: (ScopeInfo & { private?: boolean })[];
  defaultDuration: DurationId;
  reason?: string;
  now: Timestamp;
  resolution?: Resolution;
  /** Recording state of an Allow. Absent for the landing-page rehearsal. */
  progress?: Progress;
  /** Set when decisions can't be recorded at all (e.g. no contract configured). */
  blocked?: string;
  onAllow: (scopes: ScopeId[], duration: DurationId) => void;
  onDeny: () => void;
  onDone?: () => void;
  doneLabel?: string;
  headingLevel?: "h2" | "h3";
  className?: string;
}

const DURATION_ORDER: DurationId[] = ["15m", "1h", "1d", "30d"];

/** Height of the header strip + "who is asking" block: where the pass is perforated. */
const STUB = 176;

/**
 * The ContextPass request: the moment an app asks and the user decides.
 * Read top to bottom: who is asking → what for → for how long → your decision.
 * Drawn as a pass — a stub, a perforation, and a stamp once you decide.
 */
export function PermissionRequest({
  app,
  requestId,
  requestedAt,
  scopes,
  defaultDuration,
  reason,
  now,
  resolution,
  progress,
  blocked,
  onAllow,
  onDeny,
  onDone,
  doneLabel = "Done",
  headingLevel: H = "h3",
  className = "",
}: Props) {
  const uid = useId();
  // Private scopes are never pre-selected. The user has to opt in.
  const [selected, setSelected] = useState<Set<ScopeId>>(
    () => new Set(scopes.filter((s) => !s.private).map((s) => s.id)),
  );
  const [duration, setDuration] = useState<DurationId>(defaultDuration);

  const toggle = (id: ScopeId) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const count = selected.size;
  const inFlight = progress?.phase === "signing" || progress?.phase === "confirming";
  const decided = Boolean(resolution) || inFlight;

  return (
    <article
      aria-labelledby={`${uid}-title`}
      style={{ ["--notch-y" as string]: `${STUB}px` }}
      className={`pass-notch relative min-w-0 bg-stock text-ink shadow-[inset_0_0_0_1px_var(--line)] ${className}`}
    >
      {/* Stub: who is asking */}
      <div style={{ height: STUB }} className="flex flex-col overflow-hidden">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-5 sm:px-7">
          <p className="type-system text-ink">Access request</p>
          <p className="type-mono text-muted">
            {requestId} · <time dateTime={new Date(requestedAt).toISOString()}>{clockTime(requestedAt)}</time>
          </p>
        </div>
        <div className="flex items-start gap-4 px-5 pt-5 sm:px-7">
          <AppMonogram app={app} size="lg" />
          <div className="min-w-0">
            <H id={`${uid}-title`} className="type-title">
              {app.name} <span className="sr-only">wants access to your context</span>
            </H>
            <p aria-hidden="true" className="type-body text-ink-2">
              wants access to your context
            </p>
            {reason && (
              <p className="type-small mt-1.5 line-clamp-2 text-muted">
                <span className="sr-only">Reason given: </span>“{reason}”
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4" aria-hidden="true">
        <div className="perforation text-line" />
      </div>

      {/* What it wants */}
      <div role="group" aria-labelledby={`${uid}-scope`} className="px-5 pt-5 sm:px-7">
        <div className="mb-2 flex items-baseline justify-between">
          <p id={`${uid}-scope`} className="type-label text-ink-2">
            Context scope
          </p>
          <p className="type-small text-muted">
            {count} of {scopes.length} shared
          </p>
        </div>
        <ul className="divide-y divide-line-soft border-y border-line-soft">
          {scopes.map((s) => {
            const on = selected.has(s.id);
            return (
              <li key={s.id}>
                <label className="group flex cursor-pointer items-center gap-3.5 py-3 has-[:disabled]:cursor-default">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={on}
                    disabled={decided}
                    onChange={() => toggle(s.id)}
                    aria-describedby={`${uid}-${s.id}`}
                  />
                  <span
                    aria-hidden="true"
                    className={`grid size-5 shrink-0 place-items-center border transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-oxide ${
                      on ? "border-ink bg-ink text-paper" : "border-line bg-stock text-muted group-hover:border-ink-2"
                    }`}
                  >
                    {on ? <CheckGlyph className="size-3" /> : <DashGlyph className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`type-subtitle block transition-colors duration-200 ${on ? "text-ink" : "text-muted line-through decoration-1"}`}
                    >
                      {s.label}
                    </span>
                    <span id={`${uid}-${s.id}`} className="type-small block text-muted">
                      {s.description}
                    </span>
                  </span>
                  <span className={`type-small shrink-0 ${on ? "text-ink" : "text-muted"}`}>
                    {on ? "Shared" : "Not shared"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {/* For how long */}
      <div role="radiogroup" aria-labelledby={`${uid}-duration`} className="px-5 pt-5 sm:px-7">
        <p id={`${uid}-duration`} className="type-label mb-2 text-ink-2">
          Access duration
        </p>
        <div className="grid grid-cols-4 border border-ink">
          {DURATION_ORDER.map((d, i) => (
            <label
              key={d}
              className={`relative flex h-11 cursor-pointer items-center justify-center text-center transition-colors duration-200 has-[:disabled]:cursor-default has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-4 has-[:focus-visible]:outline-oxide ${
                i > 0 ? "border-l border-ink" : ""
              } ${duration === d ? "bg-ink text-paper" : "text-ink hover:bg-paper has-[:disabled]:text-muted"}`}
            >
              <input
                type="radio"
                name={`${uid}-duration`}
                value={d}
                checked={duration === d}
                disabled={decided}
                onChange={() => setDuration(d)}
                className="sr-only"
              />
              <span className="font-display text-[0.9375rem]" style={{ fontWeight: 540 }}>
                {DURATIONS[d].short}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Your decision */}
      <div className="px-5 pb-6 pt-6 sm:px-7" aria-live="polite">
        {resolution ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Stamp resolution={resolution} />
            {onDone && (
              <button
                type="button"
                onClick={onDone}
                className="type-action h-10 border border-ink px-4 transition-colors hover:bg-ink hover:text-paper"
              >
                {doneLabel}
              </button>
            )}
          </div>
        ) : inFlight ? (
          <div role="status" className="border border-ink px-4 py-4">
            <p className="type-label text-oxide">Granting access</p>
            <p className="type-small mt-1 text-ink-2">
              {app.name} · {[...selected].map((id) => scopes.find((s) => s.id === id)?.label).join(", ")} ·{" "}
              {DURATIONS[duration].label}
            </p>
            <p className="mt-3 flex items-center gap-2.5">
              <span aria-hidden="true" className="size-1.5 animate-live rounded-full bg-oxide [--live-color:var(--oxide)]" />
              <span className="type-subtitle">
                {progress?.phase === "signing" ? "Waiting for your approval…" : "Confirming on Monad…"}
              </span>
            </p>
            {progress?.phase === "confirming" && <TxHash hash={progress.hash} className="mt-2" />}
          </div>
        ) : (
          <>
            {progress?.phase === "failed" && (
              <div role="alert" className="mb-4 border-l-2 border-ink pl-3">
                <p className="type-subtitle">Permission wasn’t recorded.</p>
                <p className="type-small text-ink-2">{progress.detail}</p>
              </div>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="type-label text-oxide">Your decision</p>
              <p className="type-small text-ink-2">
                {count === 0 ? (
                  "Choose a scope, or deny."
                ) : (
                  <>
                    Ends <span className="type-mono text-[0.8125rem] text-ink">{whenLabel(now + DURATIONS[duration].ms, now)}</span>
                  </>
                )}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_1.5fr] gap-2">
              <button
                type="button"
                onClick={onDeny}
                className="type-action h-12 border border-ink text-ink transition-colors hover:bg-paper active:bg-paper-2"
              >
                Deny
              </button>
              <button
                type="button"
                disabled={count === 0 || Boolean(blocked)}
                onClick={() => onAllow([...selected], duration)}
                className="type-action h-12 bg-ink text-paper transition-colors hover:bg-oxide active:bg-oxide disabled:cursor-not-allowed disabled:opacity-35"
              >
                {progress?.phase === "failed"
                  ? "Try again"
                  : count === scopes.length
                    ? "Allow"
                    : `Allow ${count} of ${scopes.length}`}
              </button>
            </div>
            <p className="type-small mt-3 text-muted">
              {blocked ?? "Nothing is shared until you allow it. You can revoke it later."}
            </p>
          </>
        )}
      </div>

      <div className="border-t border-line px-5 py-2 text-muted sm:px-7">
        <Microprint />
      </div>
    </article>
  );
}

/**
 * The decision. Oxide for a grant; ink for a refusal. Both are outcomes, not errors.
 * "Secured on Monad" appears only for a grant read back from the contract.
 */
function Stamp({ resolution }: { resolution: Resolution }) {
  const granted = resolution.kind === "granted";
  const onChain = resolution.kind === "granted" && resolution.onChain;
  const eyebrow = onChain ? "Secured on Monad" : granted ? "Rehearsal · nothing recorded" : "Your decision";
  return (
    <div className="grid gap-2">
      <div
        className={`animate-stamp origin-left border-[3px] border-double px-4 py-2.5 ${granted ? "border-oxide text-oxide" : "border-ink text-ink"}`}
      >
        <p className="type-system opacity-80">{eyebrow}</p>
        <p className="mt-1 font-display text-[1.5rem] uppercase leading-none tracking-[0.01em]" style={{ fontWeight: 640 }}>
          {granted ? "Access granted" : "Denied"}
        </p>
        <p className="type-mono mt-1.5 text-[0.6875rem]">
          {clockTime(resolution.at)}
          {granted ? <> · until {whenLabel(resolution.expiresAt, resolution.at)}</> : " · nothing was shared"}
        </p>
      </div>
      {onChain && resolution.kind === "granted" && resolution.tx && <TxHash hash={resolution.tx} />}
    </div>
  );
}
