"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Short } from "@/components/ui/marks";
import { useIdentity } from "@/lib/identity/IdentityProvider";

/**
 * The owner, as the top of the authority stack. One quiet control:
 * open it to see how you signed in, your signing key, and to disconnect.
 */
export function IdentityControl({ variant }: { variant: "rail" | "bar" }) {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pending = identity.status !== "signed-in";

  if (variant === "bar") {
    return (
      <div ref={root} className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          disabled={pending}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 items-center gap-2.5 bg-ink pl-3 pr-2.5 text-paper disabled:opacity-80"
        >
          <span className="type-subtitle text-[0.9375rem] leading-none">You</span>
          {identity.walletAddress ? (
            <span className="type-mono text-night-muted">
              <Short hash={identity.walletAddress} head={5} tail={3} />
            </span>
          ) : (
            <span className="type-small text-night-muted">
              {identity.status === "initializing" ? "Connecting…" : pending ? "Not connected" : "Owner"}
            </span>
          )}
          <span aria-hidden="true" className="size-1.5 rounded-full bg-oxide-night" />
          <span className="sr-only">Owner. Open identity controls.</span>
        </button>
        {open && (
          <div id={panelId} className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(20rem,calc(100vw-2rem))] animate-rise">
            <IdentityDetails onClose={() => setOpen(false)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={root}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className="group block w-full bg-ink px-4 py-4 text-left text-paper transition-colors hover:bg-ink-2 disabled:hover:bg-ink"
      >
        <span className="flex items-center justify-between">
          <span className="type-subtitle">You</span>
          <span className="type-system border border-oxide-night px-1.5 py-0.5 text-oxide-night">Owner</span>
        </span>
        {pending ? (
          <span className="type-small mt-1 block text-night-muted">
            {identity.status === "initializing" ? "Establishing identity…" : "Not connected"}
          </span>
        ) : (
          <>
            {identity.contact && <span className="type-small mt-1 block truncate text-night-muted">{identity.contact}</span>}
            <span className="type-mono mt-1 flex items-center justify-between text-night-muted">
              {identity.walletAddress ? <Short hash={identity.walletAddress} /> : <span>Preparing key…</span>}
              <span aria-hidden="true" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
                ⌄
              </span>
            </span>
          </>
        )}
        <span className="sr-only">Open identity controls.</span>
      </button>
      {open && (
        <div id={panelId} className="animate-rise">
          <IdentityDetails onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function IdentityDetails({ onClose }: { onClose: () => void }) {
  const identity = useIdentity();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const copy = async () => {
    if (!identity.walletAddress) return;
    try {
      await navigator.clipboard.writeText(identity.walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable: the address stays visible */
    }
  };

  const disconnect = async () => {
    setLeaving(true);
    await identity.disconnect();
    onClose();
    router.replace("/connect?disconnected=1");
  };

  return (
    <div className="border border-ink bg-stock text-ink shadow-[0_12px_24px_-16px_rgb(22_21_15/0.35)]">
      <dl className="grid gap-3 px-4 py-4">
        {identity.contact && (
          <div>
            <dt className="type-small text-muted">Signed in as</dt>
            <dd className="type-subtitle break-all">{identity.contact}</dd>
          </div>
        )}
        <div>
          <dt className="type-small text-muted">Signing key</dt>
          <dd className="mt-0.5 flex items-center justify-between gap-3">
            {identity.walletAddress ? (
              <>
                <span className="type-mono text-[0.8125rem]">
                  <Short hash={identity.walletAddress} head={8} tail={6} />
                </span>
                <button type="button" onClick={copy} className="type-small text-ink-2 underline decoration-line underline-offset-4 hover:text-ink">
                  {copied ? "Copied" : "Copy"}
                </button>
              </>
            ) : (
              <span className="type-small text-muted">Being prepared.</span>
            )}
          </dd>
          <p className="type-small mt-1 text-muted">Will sign your permission decisions.</p>
        </div>
        {identity.userId && (
          <div>
            <dt className="type-small text-muted">Owner ID</dt>
            <dd className="type-mono text-ink-2">
              <Short hash={identity.userId} head={14} tail={4} />
            </dd>
          </div>
        )}
      </dl>
      <div className="border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={disconnect}
          disabled={leaving}
          className="type-action h-9 w-full border border-ink text-[0.75rem] transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {leaving ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
    </div>
  );
}
