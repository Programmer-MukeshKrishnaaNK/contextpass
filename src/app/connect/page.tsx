import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ConnectPanel, IdentityPass } from "@/components/connect/ConnectExperience";
import { EXAMPLE_APPS } from "@/lib/contextpass/examples";

export const metadata: Metadata = { title: "Connect" };

export default function ConnectPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <main id="main" className="flex flex-col px-[var(--gutter)] pb-12 pt-6">
        <div className="flex items-center justify-between">
          <Wordmark />
          <Link href="/" className="type-action text-muted transition-colors hover:text-ink">
            Back
          </Link>
        </div>

        <div className="my-auto max-w-[30rem] py-16">
          <p className="type-label text-ink-2">Connect</p>
          <h1 className="type-display mt-6">
            One pass. Every AI app<span className="text-oxide">.</span>
          </h1>
          <p className="type-lede mt-6 text-ink-2">
            Connecting gives you an identity that AI apps can ask. It doesn’t share anything on its own.
          </p>
          <div className="mt-10">
            <Suspense fallback={<div className="h-14 bg-ink-2" />}>
              <ConnectPanel />
            </Suspense>
          </div>
        </div>

        <p className="type-small text-muted">Real identity. Permissions recorded on Monad.</p>
      </main>

      {/* The pass itself */}
      <aside aria-label="Your ContextPass" className="on-night flex items-center justify-center bg-night px-[var(--gutter)] py-16">
        <IdentityPass apps={EXAMPLE_APPS.map((a) => a.name)} />
      </aside>
    </div>
  );
}
