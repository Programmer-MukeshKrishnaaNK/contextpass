import "server-only";
import { isScopeId, type ScopeId } from "@/lib/contextpass/scopes";
import type { Owner } from "./auth";
import { check, db, toContextItem, type ContextRow } from "./db";
import { invalid, notFound } from "./http";

/** The owner's own vault. Every query is scoped to the verified owner. */

const COLUMNS = "id, scope, title, content, is_sample, created_at, updated_at";

function fields(input: Record<string, unknown>, partial: boolean) {
  const out: { scope?: ScopeId; title?: string; content?: string } = {};
  if (input.scope !== undefined || !partial) {
    if (!isScopeId(input.scope)) throw invalid("Choose one of the context categories.");
    out.scope = input.scope;
  }
  if (input.title !== undefined || !partial) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title || title.length > 120) throw invalid("A title is required (up to 120 characters).");
    out.title = title;
  }
  if (input.content !== undefined || !partial) {
    const content = typeof input.content === "string" ? input.content.trim() : "";
    if (!content || content.length > 4000) throw invalid("Content is required (up to 4,000 characters).");
    out.content = content;
  }
  return out;
}

export async function listContext(owner: Owner) {
  const rows = check(
    await db().from("context_items").select(COLUMNS).eq("owner_id", owner.id).order("created_at", { ascending: true }),
    "list context",
  ) as ContextRow[];
  return rows.map(toContextItem);
}

export async function createContext(owner: Owner, input: Record<string, unknown>) {
  const row = check(
    await db()
      .from("context_items")
      .insert({ owner_id: owner.id, ...fields(input, false) })
      .select(COLUMNS)
      .single(),
    "create context",
  ) as ContextRow;
  return toContextItem(row);
}

function validId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("That context item");
}

export async function updateContext(owner: Owner, id: string, input: Record<string, unknown>) {
  validId(id);
  const patch = fields(input, true);
  if (Object.keys(patch).length === 0) throw invalid("Nothing to change.");
  const row = check(
    await db().from("context_items").update({ ...patch, is_sample: false }).eq("id", id).eq("owner_id", owner.id).select(COLUMNS).maybeSingle(),
    "update context",
  ) as ContextRow | null;
  if (!row) throw notFound("That context item");
  return toContextItem(row);
}

export async function deleteContext(owner: Owner, id: string) {
  validId(id);
  const rows = check(
    await db().from("context_items").delete().eq("id", id).eq("owner_id", owner.id).select("id"),
    "delete context",
  ) as { id: string }[];
  if (rows.length === 0) throw notFound("That context item");
}

/** Clearly-marked sample context. Added only on request, never silently. */
const SAMPLE: { scope: ScopeId; title: string; content: string }[] = [
  { scope: "about", title: "How I like answers", content: "I prefer concise explanations." },
  { scope: "study-preferences", title: "Explanations", content: "Examples first, theory second." },
  { scope: "coding-preferences", title: "Stack and style", content: "TypeScript, clean functions, minimal dependencies." },
  { scope: "projects", title: "ContextPass", content: "ContextPass — permission layer for AI context." },
  { scope: "communication-preferences", title: "Tone", content: "Plain and direct. No hype." },
];

export async function addSampleContext(owner: Owner) {
  const existing = check(
    await db().from("context_items").select("id").eq("owner_id", owner.id).eq("is_sample", true).limit(1),
    "check sample context",
  ) as { id: string }[];
  if (existing.length === 0) {
    check(
      await db().from("context_items").insert(SAMPLE.map((s) => ({ ...s, owner_id: owner.id, is_sample: true }))),
      "add sample context",
    );
  }
  return listContext(owner);
}
