"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useIdentity } from "@/lib/identity/IdentityProvider";

/**
 * The app belongs to an owner. Until one is established, the shell stays
 * in place and the content area says what is happening — no blank screen,
 * no layout jump.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { status } = useIdentity();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "signed-out") router.replace(`/connect?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  if (status === "signed-in") return <>{children}</>;

  if (status === "unconfigured") {
    return (
      <GateNote title="Sign-in isn’t set up yet.">
        ContextPass needs a Privy app ID before anyone can connect. Add <code className="type-mono text-ink">NEXT_PUBLIC_PRIVY_APP_ID</code> to{" "}
        <code className="type-mono text-ink">.env.local</code> and restart.{" "}
        <Link href="/" className="underline underline-offset-4">
          Back to ContextPass
        </Link>
      </GateNote>
    );
  }

  return <GateNote title={status === "initializing" ? "Establishing identity…" : "Taking you to Connect…"} quiet />;
}

function GateNote({ title, quiet = false, children }: { title: string; quiet?: boolean; children?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[76rem] px-[var(--gutter)] pt-10 sm:pt-14 lg:pt-16" role="status" aria-live="polite">
      <p className="flex items-center gap-3">
        <span aria-hidden="true" className={`size-1.5 rounded-full bg-oxide ${quiet ? "animate-live [--live-color:var(--oxide)]" : ""}`} />
        <span className="type-title">{title}</span>
      </p>
      {children && <p className="type-body mt-3 max-w-[34rem] text-ink-2">{children}</p>}
    </div>
  );
}
