"use client";

import { useEffect, useState } from "react";
import { Mark } from "@/components/brand/Wordmark";

/** What the gate is doing right now, in its own log voice. Cycles slowly. */
const WIRE = [
  { glyph: "↑", text: "CodePilot asks for Projects · 1 day" },
  { glyph: "…", text: "Waiting for your decision" },
  { glyph: "↓", text: "Granted until tomorrow, 21:42" },
  { glyph: "↓", text: "StudyOS reads Learning preferences" },
  { glyph: "×", text: "Margin asks for Private notes · denied" },
];

const GUESTS = ["St", "Cp", "Mg"];

/**
 * The product model, top to bottom: the user decides, ContextPass enforces,
 * apps ask. Weight falls with authority — filled, then solid, then dashed.
 */
export function AuthorityStack() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % WIRE.length), 2800);
    return () => window.clearInterval(id);
  }, []);

  const line = WIRE[i];

  return (
    <figure aria-labelledby="authority-caption" className="w-full">
      <figcaption id="authority-caption" className="type-label mb-3 text-muted">
        Who decides
      </figcaption>

      <ol>
        {/* You */}
        <li className="flex items-start justify-between gap-4 bg-ink px-5 py-5 text-paper sm:px-6">
          <div>
            <p className="type-title">You</p>
            <p className="type-small mt-0.5 text-night-muted">Own the context. Set the rules.</p>
          </div>
          <span className="type-system border border-oxide-night px-2 py-1 text-oxide-night">Owner</span>
        </li>

        <Lane up="asks" down="your rules" />

        {/* ContextPass */}
        <li className="border border-ink bg-paper px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="type-title flex items-center gap-2">
                ContextPass <Mark className="size-[18px]" />
              </p>
              <p className="type-small mt-0.5 text-muted">Checks every request against your rules.</p>
            </div>
            <span className="type-system border border-ink px-2 py-1">Gate</span>
          </div>
          <div className="mt-4 flex h-5 items-center gap-2.5 border-t border-line pt-3" aria-hidden="true">
            <span className="size-1.5 shrink-0 animate-live rounded-full bg-oxide [--live-color:var(--oxide)]" />
            <span key={i} className="type-mono animate-ticker truncate text-ink-2">
              <span className="mr-1.5 inline-block w-3 text-center text-muted">{line.glyph}</span>
              {line.text}
            </span>
          </div>
        </li>

        <Lane up="asks" down="only what you allow" />

        {/* AI apps */}
        <li className="guest-outline px-5 py-5 text-ink-2 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="type-title text-ink">AI apps</p>
              <p className="type-small mt-0.5 text-muted">Ask. Wait. Receive only what you allow.</p>
            </div>
            <span className="type-system border border-dashed border-ink-2 px-2 py-1">Guest</span>
          </div>
          <p className="mt-4 flex items-center gap-1.5" aria-label="For example StudyOS, CodePilot and Margin">
            {GUESTS.map((g) => (
              <span
                key={g}
                aria-hidden="true"
                className="guest-outline grid size-8 place-items-center font-display text-[0.75rem] text-ink"
                style={{ fontWeight: 600 }}
              >
                {g}
              </span>
            ))}
            <span aria-hidden="true" className="type-small ml-1.5 text-muted">
              and any app that connects
            </span>
          </p>
        </li>
      </ol>
    </figure>
  );
}

/** Requests travel up the left lane; decisions come down the right. */
function Lane({ up, down }: { up: string; down: string }) {
  return (
    <li aria-hidden="true" className="grid h-12 grid-cols-[1fr_auto_1fr] items-center">
      <span className="type-small pr-4 text-right text-muted">
        {up} <span className="text-ink-2">↑</span>
      </span>
      <span className="relative flex h-full w-5 justify-between">
        <span className="relative h-full w-px overflow-hidden bg-line">
          <span className="absolute inset-x-0 top-0 h-2.5 bg-ink-2 [animation:lane_2.8s_linear_infinite]" />
        </span>
        <span className="relative h-full w-px overflow-hidden bg-line">
          <span className="absolute inset-x-0 top-0 h-2.5 bg-oxide [animation:lane_2.8s_linear_1.4s_infinite_reverse]" />
        </span>
      </span>
      <span className="type-small pl-4 text-ink-2">
        <span className="text-oxide">↓</span> {down}
      </span>
    </li>
  );
}
