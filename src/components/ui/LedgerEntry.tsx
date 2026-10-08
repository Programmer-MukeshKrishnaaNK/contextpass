import { clockTime, isoTime } from "@/lib/contextpass/clock";
import { SCOPE_INFO } from "@/lib/contextpass/scopes";
import type { AppRecord, LedgerAction, LedgerEvent } from "@/lib/contextpass/types";
import { Short } from "./marks";
import { TxHash } from "./TxHash";

export const ACTION_COPY: Record<LedgerAction, string> = {
  requested: "Context requested",
  granted: "Access granted",
  denied: "Request denied",
  accessed: "Context accessed",
  blocked: "Request blocked",
  revoked: "Access revoked",
  expired: "Access expired",
  failed: "Not recorded",
};

/** Each action has its own node on the ledger spine. */
export function LedgerNode({ action }: { action: LedgerAction }) {
  const common = "relative z-10 block size-[11px] shrink-0";
  switch (action) {
    case "granted":
      return <span aria-hidden="true" className={`${common} rounded-full bg-active ring-4 ring-paper`} />;
    case "requested":
      return <span aria-hidden="true" className={`${common} rounded-full border border-dashed border-ink-2 bg-paper ring-4 ring-paper`} />;
    case "accessed":
      return (
        <span aria-hidden="true" className={`${common} grid place-items-center bg-paper ring-4 ring-paper`}>
          <span className="size-[5px] rounded-full bg-ink" />
        </span>
      );
    case "revoked":
      return (
        <span aria-hidden="true" className={`${common} rounded-full border-[1.5px] border-ink bg-paper ring-4 ring-paper`}>
          <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[13px] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-ink" />
        </span>
      );
    case "denied":
      return <span aria-hidden="true" className={`${common} bg-ink ring-4 ring-paper`} />;
    case "expired":
      return <span aria-hidden="true" className={`${common} rounded-full border border-expired bg-paper ring-4 ring-paper`} />;
    case "blocked":
      return (
        <span aria-hidden="true" className={`${common} grid place-items-center border-[1.5px] border-ink bg-paper ring-4 ring-paper`}>
          <span className="h-[1.5px] w-[7px] bg-ink" />
        </span>
      );
    case "failed":
      return <span aria-hidden="true" className={`${common} border border-dashed border-ink-2 bg-paper ring-4 ring-paper`} />;
  }
}

export function LedgerEntry({
  event,
  app,
  compact = false,
  fresh = false,
  showSource = true,
}: {
  event: LedgerEvent;
  app: Pick<AppRecord, "name">;
  compact?: boolean;
  fresh?: boolean;
  /** Label each row: On Monad, or Recorded by ContextPass. Off for the landing page's example. */
  showSource?: boolean;
}) {
  const scopeText = event.scopes.map((s) => SCOPE_INFO[s]?.label ?? s).join(", ");
  const tone =
    event.action === "revoked" || event.action === "denied" || event.action === "blocked"
      ? "text-ink"
      : event.action === "granted"
        ? "text-active"
        : event.action === "expired"
          ? "text-muted"
          : "text-ink-2";

  return (
    <li className={`relative grid grid-cols-[4.75rem_11px_1fr] gap-x-4 sm:grid-cols-[6rem_11px_1fr_auto] sm:gap-x-6 ${compact ? "py-3.5" : "py-4"} ${fresh ? "animate-rise" : ""}`}>
      <time dateTime={isoTime(event.at)} className="type-mono pt-[3px] text-ink-2">
        {clockTime(event.at)}
      </time>
      <span className="pt-[5px]">
        <LedgerNode action={event.action} />
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="type-subtitle">{app.name}</span>
          <span className={`font-display text-[1rem] ${tone}`} style={{ fontWeight: 500 }}>
            {ACTION_COPY[event.action]}
          </span>
        </p>
        <p className="type-small mt-0.5 text-muted">
          {scopeText}
          {event.note && <span className="text-ink-2"> · {event.note}</span>}
        </p>
      </div>
      <div className="col-start-3 mt-1.5 flex flex-col gap-0.5 sm:col-start-auto sm:mt-0 sm:items-end sm:pt-[3px] sm:text-right">
        {showSource &&
          event.source !== "example" &&
          (event.source === "chain" ? (
            <span className="type-small text-active">On Monad</span>
          ) : (
            <span className="type-small text-muted">Recorded by ContextPass</span>
          ))}
        {event.tx && !compact ? (
          <TxHash hash={event.tx} className="sm:justify-end" />
        ) : (
          event.permissionId && (
            <span className="type-mono text-muted">
              {event.permissionId.startsWith("0x") ? <Short hash={event.permissionId} /> : event.permissionId}
            </span>
          )
        )}
      </div>
    </li>
  );
}

/** The vertical spine running behind the nodes. */
export function LedgerSpine() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 top-0 w-px bg-line left-[calc(4.75rem+1rem+5px)] sm:left-[calc(6rem+1.5rem+5px)]"
    />
  );
}
