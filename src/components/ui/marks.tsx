import type { AppRecord, PermissionStatus } from "@/lib/contextpass/types";

/* Small, functional glyphs. Drawn rather than pulled from an icon set,
   so they share stroke weight with the wordmark. */

export function CheckGlyph({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none">
      <path d="M2.5 8.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

export function DashGlyph({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

export function CloseGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

/** A guest is always drawn with a dashed frame. Only the user is solid. */
export function AppMonogram({
  app,
  size = "md",
  className = "",
}: {
  app: Pick<AppRecord, "monogram" | "name">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims =
    size === "sm"
      ? "size-7 text-[0.7rem]"
      : size === "lg"
        ? "size-14 text-[1.15rem]"
        : "size-10 text-[0.875rem]";
  return (
    <span
      aria-hidden="true"
      className={`guest-outline inline-grid shrink-0 place-items-center font-display ${dims} ${className}`}
      style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
    >
      {app.monogram}
    </span>
  );
}

const STATUS: Record<PermissionStatus, { label: string; cls: string; sr: string }> = {
  active: { label: "Active", cls: "border border-active bg-active text-paper", sr: "Access is active" },
  pending: { label: "Pending", cls: "border border-dashed border-oxide text-oxide", sr: "Waiting for your decision" },
  expired: { label: "Expired", cls: "border border-line text-muted", sr: "Access has expired" },
  revoked: { label: "Revoked", cls: "border border-ink text-ink", sr: "You revoked this access" },
  denied: { label: "Denied", cls: "border border-ink-2 text-ink-2", sr: "You denied this request" },
  failed: { label: "Not recorded", cls: "border border-dashed border-ink-2 text-ink-2", sr: "The last attempt wasn’t recorded; you can try again" },
};

/**
 * Status is carried by fill, line style and shape — never colour alone.
 *   Active   solid fill, live pulse
 *   Pending  dashed frame, open dot
 *   Expired  hairline frame, hollow ring
 *   Revoked  struck through, slashed ring
 *   Denied   solid frame, square
 */
export function StatusTag({ status, className = "" }: { status: PermissionStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span
      className={`type-system inline-flex h-6 items-center gap-1.5 px-2 transition-colors duration-500 ${s.cls} ${className}`}
      title={s.sr}
    >
      <StatusGlyph status={status} />
      <span className={status === "revoked" ? "line-through decoration-[1.5px]" : ""}>{s.label}</span>
      <span className="sr-only">. {s.sr}</span>
    </span>
  );
}

function StatusGlyph({ status }: { status: PermissionStatus }) {
  const base = "relative block size-[7px] shrink-0";
  switch (status) {
    case "active":
      return <span aria-hidden="true" className={`${base} animate-live rounded-full bg-paper [--live-color:var(--paper)]`} />;
    case "pending":
      return <span aria-hidden="true" className={`${base} rounded-full border border-dashed border-current`} />;
    case "expired":
      return <span aria-hidden="true" className={`${base} rounded-full border border-current`} />;
    case "revoked":
      return (
        <span aria-hidden="true" className={`${base} rounded-full border border-current`}>
          <span className="absolute left-1/2 top-1/2 h-px w-[9px] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current" />
        </span>
      );
    case "denied":
      return <span aria-hidden="true" className={`${base} bg-current`} />;
    case "failed":
      return <span aria-hidden="true" className={`${base} border border-dashed border-current`} />;
  }
}

/** Decorative security-document microprint. */
export function Microprint({
  text = "Your context · Your control · Issued by ContextPass · ",
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`microprint ${className}`}>
      {text.repeat(12)}
    </div>
  );
}

export function Short({ hash, head = 6, tail = 4 }: { hash: string; head?: number; tail?: number }) {
  return (
    <span title={hash}>
      {hash.slice(0, head)}…{hash.slice(-tail)}
    </span>
  );
}
