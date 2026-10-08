"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Mark, Wordmark } from "@/components/brand/Wordmark";
import { useContextPass } from "@/lib/contextpass/store";
import { useIdentity } from "@/lib/identity/IdentityProvider";
import { AppGate } from "./AppGate";
import { IdentityControl } from "./IdentityControl";

const NAV = [
  { href: "/app", label: "Overview" },
  { href: "/app/context", label: "Context" },
  { href: "/app/apps", label: "Apps" },
  { href: "/app/permissions", label: "Permissions" },
  { href: "/app/activity", label: "Activity" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { permissions } = useContextPass();
  const { status } = useIdentity();
  // Requests belong to an owner: nothing is announced until one is signed in.
  const pending = status === "signed-in" ? permissions.filter((p) => p.status === "pending").length : 0;
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* ── Desktop rail ── */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line lg:flex">
        <div className="flex h-16 items-center px-6">
          <Wordmark href="/" />
        </div>

        {/* The owner sits above everything else, as in the authority diagram. */}
        <div className="mx-4">
          <IdentityControl variant="rail" />
        </div>

        <nav aria-label="App" className="mt-6 px-4">
          <ul>
            {NAV.map((item, i) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-11 items-center gap-3 px-3 transition-colors ${
                      active ? "bg-paper-2 text-ink" : "text-ink-2 hover:bg-paper-2/60 hover:text-ink"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-0 h-full w-[2px] bg-ink transition-transform duration-300 ease-out ${
                        active ? "scale-y-100" : "scale-y-0"
                      }`}
                    />
                    <span className="type-mono w-5 text-[0.6875rem] text-muted">0{i + 1}</span>
                    <span className="font-display text-[1rem] tracking-[-0.01em]" style={{ fontWeight: active ? 600 : 470 }}>
                      {item.label}
                    </span>
                    {item.href === "/app/permissions" && pending > 0 && (
                      <span className="type-system ml-auto border border-dashed border-oxide px-1.5 py-0.5 text-oxide">
                        {pending}
                        <span className="sr-only"> pending</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {pending > 0 && (
          <Link href="/app#decide" className="group mx-4 mt-6 block border border-dashed border-oxide px-4 py-3">
            <span className="type-label block text-oxide">Needs your decision</span>
            <span className="type-small mt-0.5 block text-ink-2 group-hover:text-ink">
              {pending === 1 ? "1 request is waiting." : `${pending} requests are waiting.`}
            </span>
          </Link>
        )}

        <p className="type-small mt-auto border-t border-line px-6 py-5 text-muted">
          Permissions are recorded on Monad. Context stays in your vault and is released only while a permission is active.
        </p>
      </aside>

      {/* ── Mobile / tablet top bar ── */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper px-[var(--gutter)] lg:hidden">
        <Link href="/" aria-label="ContextPass home" className="flex items-center gap-2">
          <Mark className="size-5" />
          <span className="font-display text-[1.05rem] tracking-[-0.03em]" style={{ fontWeight: 640 }}>
            ContextPass
          </span>
        </Link>
        <IdentityControl variant="bar" />
      </header>

      <main id="main" className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <AppGate>{children}</AppGate>
      </main>

      {/* ── Mobile / tablet tab bar ── */}
      <nav
        aria-label="App"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-[4.25rem] flex-col items-center justify-center gap-1 transition-colors ${
                    active ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-3 top-0 h-[2px] bg-ink transition-transform duration-300 ease-out ${active ? "scale-x-100" : "scale-x-0"}`}
                  />
                  <span className="font-display text-[0.75rem] tracking-[-0.015em] sm:text-[0.875rem]" style={{ fontWeight: active ? 620 : 480 }}>
                    {item.label}
                  </span>
                  {item.href === "/app/permissions" && pending > 0 ? (
                    <span className="type-system text-[0.625rem] text-oxide">
                      {pending}
                      <span className="sr-only"> waiting</span>
                    </span>
                  ) : (
                    <span aria-hidden="true" className="h-3" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
