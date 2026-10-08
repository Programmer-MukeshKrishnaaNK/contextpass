/**
 * The context scopes ContextPass knows. One list, used by the database
 * (public.context_scope), the chain keys, the access gate and the UI.
 */
export const SCOPES = ["about", "study-preferences", "coding-preferences", "projects", "communication-preferences"] as const;

export type ScopeId = (typeof SCOPES)[number];

export interface ScopeInfo {
  id: ScopeId;
  label: string;
  /** What an app would see, in one plain line. */
  description: string;
  /** Prompt for writing an item in this scope. */
  placeholder: { title: string; content: string };
}

export const SCOPE_INFO: Record<ScopeId, ScopeInfo> = {
  about: {
    id: "about",
    label: "About me",
    description: "Who you are, in the few words you choose.",
    placeholder: { title: "How I like to be addressed", content: "Short and direct. First name is fine." },
  },
  "study-preferences": {
    id: "study-preferences",
    label: "Study preferences",
    description: "How you like to learn.",
    placeholder: { title: "Explanations", content: "Examples first, theory second." },
  },
  "coding-preferences": {
    id: "coding-preferences",
    label: "Coding preferences",
    description: "Languages, style and tools.",
    placeholder: { title: "Style", content: "TypeScript, small functions, minimal dependencies." },
  },
  projects: {
    id: "projects",
    label: "Projects",
    description: "What you are working on.",
    placeholder: { title: "ContextPass", content: "A permission layer for AI context." },
  },
  "communication-preferences": {
    id: "communication-preferences",
    label: "Communication preferences",
    description: "Tone, length and the words you avoid.",
    placeholder: { title: "Tone", content: "Plain and warm. No exclamation marks." },
  },
};

export function isScopeId(value: unknown): value is ScopeId {
  return typeof value === "string" && (SCOPES as readonly string[]).includes(value);
}

/**
 * Phase 3 scope ids, kept only so permissions recorded on-chain before the
 * vault existed can still be read back and labelled. Never issued again.
 */
export const LEGACY_SCOPE_ALIASES: Record<string, ScopeId> = {
  "profile.basic": "about",
  "preferences.learning": "study-preferences",
  "preferences.coding": "coding-preferences",
  "preferences.writing": "communication-preferences",
  "projects.active": "projects",
};
