"use client";

import { useState } from "react";
import { CheckGlyph, DashGlyph } from "@/components/ui/marks";

type Key = "projects" | "preferences" | "study" | "notes";

const ROWS: { key: Key; label: string; field: string; payload: string[] }[] = [
  {
    key: "projects",
    label: "Projects",
    field: "projects",
    payload: ['"Thesis: cache coherence"', '"Ledger: finance tool"'],
  },
  {
    key: "preferences",
    label: "Preferences",
    field: "preferences",
    payload: ['"Worked examples first"', '"Short sessions"'],
  },
  {
    key: "study",
    label: "Study history",
    field: "study_history",
    payload: ['"Linear algebra · 14"', '"Operating systems · 9"'],
  },
  {
    key: "notes",
    label: "Private notes",
    field: "private_notes",
    payload: ['"12 entries"'],
  },
];

export function ChooseContext() {
  const [on, setOn] = useState<Record<Key, boolean>>({
    projects: true,
    preferences: true,
    study: false,
    notes: false,
  });
  const shared = ROWS.filter((r) => on[r.key]);

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
      <div className="min-w-0 lg:col-span-7">
        <ul className="border-t border-ink" aria-label="Choose what to share">
          {ROWS.map((r) => {
            const active = on[r.key];
            return (
              <li key={r.key} className="border-b border-line">
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => setOn((s) => ({ ...s, [r.key]: !s[r.key] }))}
                  className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 py-5 text-left sm:py-6"
                >
                  <span className="relative inline-block justify-self-start">
                    <span
                      className={`type-headline block transition-colors duration-300 ${active ? "text-ink" : "text-muted/70"}`}
                    >
                      {r.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 right-0 top-[55%] h-[2px] origin-left bg-muted/70 transition-transform duration-500 ease-out ${
                        active ? "scale-x-0" : "scale-x-100"
                      }`}
                    />
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`type-small hidden w-20 text-right sm:block ${active ? "text-ink" : "text-muted"}`}>
                      {active ? "Shared" : "Not shared"}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`grid size-11 place-items-center border transition-colors duration-300 ${
                        active ? "border-ink bg-ink text-paper" : "border-line text-muted group-hover:border-ink-2"
                      }`}
                    >
                      {active ? <CheckGlyph className="size-4" /> : <DashGlyph className="size-4" />}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="type-small mt-4 text-muted" aria-live="polite">
          <span className="text-ink">{shared.length} of {ROWS.length} shared.</span> Change it whenever you like.
        </p>
      </div>

      {/* What the app actually receives */}
      <div className="min-w-0 lg:col-span-5">
        <div className="border border-ink bg-paper-2">
          <div className="flex items-center justify-between border-b border-ink px-4 py-3">
            <p className="type-label">What StudyOS receives</p>
            <p className="type-small text-muted">For 1 hour</p>
          </div>
          <pre className="type-mono overflow-x-auto px-4 py-5 text-[0.8125rem] leading-[1.75] text-ink" aria-label="Context payload preview">
            <code>
              <span className="text-muted">{"{"}</span>
              {"\n"}
              {ROWS.map((r) =>
                on[r.key] ? (
                  <span key={r.key} className="block animate-ticker">
                    {"  "}
                    <span className="text-ink">&quot;{r.field}&quot;</span>
                    <span className="text-muted">: [</span>
                    {r.payload.map((v, i) => (
                      <span key={v} className="block">
                        {"    "}
                        {v}
                        {i < r.payload.length - 1 && <span className="text-muted">,</span>}
                      </span>
                    ))}
                    {"  "}
                    <span className="text-muted">],</span>
                  </span>
                ) : (
                  <span key={r.key} className="block text-muted/80">
                    {"  "}
                    {"// "}
                    {r.field}: not shared
                  </span>
                ),
              )}
              <span className="text-muted">{"}"}</span>
            </code>
          </pre>
          <p className="type-small border-t border-line px-4 py-3 text-muted">
            Context you keep is never sent. Not summarized, not hinted at.
          </p>
        </div>
      </div>
    </div>
  );
}
