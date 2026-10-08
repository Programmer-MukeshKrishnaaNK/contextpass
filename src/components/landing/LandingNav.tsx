"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#request", label: "The request" },
  { href: "#control", label: "Your control" },
  { href: "#developers", label: "For AI apps" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-[80rem] items-center justify-between gap-6 px-[var(--gutter)]">
        <Wordmark />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="font-display text-[0.9375rem] text-ink-2 transition-colors hover:text-ink"
                  style={{ fontWeight: 500 }}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          <ButtonLink href="/app" variant="quiet">
            Open the app
          </ButtonLink>
          <ButtonLink href="/connect" size="sm" className="h-10 px-4">
            Connect ContextPass
          </ButtonLink>
        </div>

        <button
          type="button"
          className="type-action -mr-2 inline-flex h-10 items-center gap-2 px-2 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span>{open ? "Close" : "Menu"}</span>
          <span aria-hidden="true" className="relative block h-2.5 w-5">
            <span className={`absolute left-0 h-[1.5px] w-5 bg-ink transition-transform duration-300 ${open ? "top-[4px] rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 h-[1.5px] w-5 bg-ink transition-transform duration-300 ${open ? "top-[4px] -rotate-45" : "top-[8px]"}`} />
          </span>
        </button>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="border-t border-line bg-paper lg:hidden"
      >
        <nav aria-label="Mobile" className="px-[var(--gutter)] pb-8 pt-4">
          <ul className="divide-y divide-line">
            {LINKS.map((l, i) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline justify-between py-4"
                >
                  <span className="type-title">{l.label}</span>
                  <span className="type-mono text-muted">0{i + 1}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-3">
            <ButtonLink href="/connect" size="lg">
              Connect ContextPass
            </ButtonLink>
            <ButtonLink href="/app" variant="outline" size="lg">
              Open the app
            </ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
