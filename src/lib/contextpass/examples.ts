import { at } from "./clock";
import { SCOPE_INFO, type ScopeId } from "./scopes";
import type { AppRecord, LedgerEvent } from "./types";

/**
 * Illustrations for the public landing and connect pages only.
 * Nothing here is a person's data, a permission, or a transaction — the
 * signed-in app reads all of that from the ContextPass API and Monad.
 */

type ExampleApp = Pick<AppRecord, "slug" | "name" | "kind" | "developer" | "monogram">;

export const EXAMPLE_APPS: ExampleApp[] = [
  { slug: "study-os", name: "StudyOS", kind: "Study assistant", developer: "StudyOS Labs", monogram: "St" },
  { slug: "code-pilot", name: "CodePilot", kind: "Coding assistant", developer: "Pilot Systems", monogram: "Cp" },
  { slug: "margin", name: "Margin", kind: "Writing assistant", developer: "Margin & Co.", monogram: "Mg" },
];

export const exampleApp = (slug: string) => EXAMPLE_APPS.find((a) => a.slug === slug) ?? EXAMPLE_APPS[0];

/** Scopes the landing page's rehearsal pass asks for. */
export const EXAMPLE_REQUEST = { app: "study-os", scopes: [SCOPE_INFO["study-preferences"]] };

const ev = (id: string, t: number, appId: string, action: LedgerEvent["action"], scopes: ScopeId[], note?: string): LedgerEvent => ({
  id,
  at: t,
  appId,
  action,
  scopes,
  source: "example",
  note,
});

/** The landing page's example ledger. Newest first. */
export const EXAMPLE_LEDGER: LedgerEvent[] = [
  ev("ex-6", at(21, 52, 10), "study-os", "accessed", ["study-preferences"]),
  ev("ex-5", at(21, 44, 51), "margin", "revoked", ["communication-preferences"]),
  ev("ex-4", at(21, 42, 18), "code-pilot", "requested", ["projects", "coding-preferences"]),
  ev("ex-3", at(21, 41, 3), "study-os", "granted", ["study-preferences"], "For 1 hour"),
  ev("ex-2", at(21, 40, 48), "study-os", "requested", ["study-preferences"]),
  ev("ex-1", at(9, 13, 58), "code-pilot", "denied", ["about"], "Nothing was shared."),
];
