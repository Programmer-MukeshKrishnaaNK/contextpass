"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Mark } from "@/components/brand/Wordmark";
import { Arrow } from "@/components/ui/Button";
import { Microprint, Short } from "@/components/ui/marks";
import { calendarDate } from "@/lib/contextpass/clock";
import { useIdentity } from "@/lib/identity/IdentityProvider";

/** Only same-app paths are allowed as a return destination. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/app") ? raw : "/app";
}

export function ConnectPanel() {
  const identity = useIdentity();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const disconnected = params.get("disconnected") === "1";

  // Arriving signed-in from the sign-in flow: go straight on.
  const askedToConnect = useRef(false);
  useEffect(() => {
    if (identity.connecting) askedToConnect.current = true;
    if (identity.status === "signed-in" && askedToConnect.current) router.replace(next);
  }, [identity.status, identity.connecting, next, router]);

  if (identity.status === "unconfigured") {
    return (
      <div className="border-t border-ink pt-5">
        <p className="type-title">Sign-in isn’t set up yet.</p>
        <p className="type-body mt-2 text-ink-2">
          Add <code className="type-mono text-ink">NEXT_PUBLIC_PRIVY_APP_ID</code> to{" "}
          <code className="type-mono text-ink">.env.local</code>, then restart ContextPass.
        </p>
      </div>
    );
  }

  if (identity.status === "signed-in") {
    return (
      <div className="grid gap-3">
        <p className="type-body text-ink-2" role="status">
          Connected{identity.contact ? <> as <span className="text-ink">{identity.contact}</span></> : null}.
        </p>
        <button
          type="button"
          onClick={() => router.push(next)}
          className="group type-action flex h-14 items-center justify-between bg-ink px-6 text-paper transition-colors hover:bg-ink-2"
        >
          Continue to ContextPass <Arrow />
        </button>
        <button
          type="button"
          onClick={() => identity.disconnect()}
          className="type-small self-start text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          Not you? Disconnect
        </button>
      </div>
    );
  }

  const busy = identity.status === "initializing" || identity.connecting;
  const note = identity.issue
    ? identity.issue.message
    : disconnected
      ? "Disconnected. Connect again whenever you’re ready."
      : "Sign in with what you already use. Nothing is shared by connecting.";

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={identity.connect}
        disabled={busy}
        aria-describedby="connect-note"
        className="group type-action flex h-14 items-center justify-between bg-ink px-6 text-paper transition-colors hover:bg-ink-2 disabled:cursor-wait disabled:bg-ink-2"
      >
        <span className="flex items-center gap-3">
          {busy && <span aria-hidden="true" className="size-1.5 animate-live rounded-full bg-oxide-night [--live-color:var(--oxide-night)]" />}
          {identity.status === "initializing" ? "Establishing identity…" : identity.connecting ? "Connecting…" : "Connect ContextPass"}
        </span>
        {!busy && <Arrow />}
      </button>
      <p id="connect-note" role="status" aria-live="polite" className={`type-small min-h-[2.5rem] ${identity.issue ? "text-ink" : "text-muted"}`}>
        {note}
      </p>
    </div>
  );
}

/** The pass fills in once an owner exists. */
export function IdentityPass({ apps }: { apps: string[] }) {
  const identity = useIdentity();
  const signedIn = identity.status === "signed-in";

  return (
    <div className="w-full max-w-[26rem]">
      <div className="bg-stock text-ink">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <span className="flex items-center gap-2">
            <Mark className="size-5" />
            <span className="type-system">ContextPass</span>
          </span>
          <span className="type-system text-muted">{signedIn ? "Owner" : "Unissued"}</span>
        </div>
        <div className="px-6 pb-6 pt-8">
          <p className="type-system text-muted">Holder</p>
          <p className={`type-display mt-2 ${signedIn ? "" : "text-muted/60"}`}>{signedIn ? "You" : "—"}</p>
          {signedIn && identity.contact && <p className="type-small mt-1 truncate text-ink-2">{identity.contact}</p>}
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <dt className="type-system text-muted">Signing key</dt>
              <dd className="type-mono mt-1">
                {signedIn && identity.walletAddress ? <Short hash={identity.walletAddress} /> : signedIn ? "Preparing…" : "—"}
              </dd>
            </div>
            <div>
              <dt className="type-system text-muted">Since</dt>
              <dd className="type-mono mt-1">{signedIn && identity.since ? calendarDate(identity.since) : "—"}</dd>
            </div>
          </dl>
        </div>
        {/* Perforation with notches punched to the backdrop colour */}
        <div className="relative px-3" aria-hidden="true">
          <span className="absolute -left-[11px] top-1/2 size-[22px] -translate-y-1/2 rounded-full bg-night" />
          <span className="absolute -right-[11px] top-1/2 size-[22px] -translate-y-1/2 rounded-full bg-night" />
          <div className="perforation text-line" />
        </div>
        <div className="px-6 py-6">
          <p className="type-system text-muted">Apps that can ask</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {apps.map((a) => (
              <li key={a} className="guest-outline type-small px-2.5 py-1 text-ink">
                {a}
              </li>
            ))}
          </ul>
          <p className="type-small mt-5 text-ink-2">Guests may ask. Only the holder decides.</p>
        </div>
        <div className="border-t border-line px-6 py-2 text-muted">
          <Microprint />
        </div>
      </div>
      <p className="type-small mt-6 text-center text-night-muted">
        {signedIn ? "Your identity is real. Your permissions are recorded on Monad." : "Not connected yet."}
      </p>
    </div>
  );
}
