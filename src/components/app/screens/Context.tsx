"use client";

import { useId, useState } from "react";
import { Page, PageHeader } from "@/components/app/primitives";
import { AppMonogram } from "@/components/ui/marks";
import { relative } from "@/lib/contextpass/clock";
import { SCOPE_INFO, SCOPES, type ScopeId } from "@/lib/contextpass/scopes";
import { isPermissionActive, useContextPass, useNow } from "@/lib/contextpass/store";
import type { ContextItem } from "@/lib/contextpass/types";

export function Context() {
  const { context, permissions, appById, dataStatus, addSampleContext } = useContextPass();
  const now = useNow();
  const [open, setOpen] = useState<Set<ScopeId>>(() => new Set(["projects"]));
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState<string>();

  const toggle = (id: ScopeId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const active = permissions.filter((p) => p.source === "chain" && isPermissionActive(p, now));
  const readers = (scope: ScopeId) => [...new Set(active.filter((p) => p.scopes.includes(scope)).map((p) => p.appId))].map(appById);
  const hasSample = context.some((c) => c.isSample);

  const addSample = async () => {
    setSampleBusy(true);
    setSampleError(undefined);
    const res = await addSampleContext();
    if (!res.ok) setSampleError(res.message);
    else setOpen(new Set(SCOPES));
    setSampleBusy(false);
  };

  return (
    <Page>
      <PageHeader
        index="02"
        label="Context"
        title="What you keep here is yours."
        lede="You decide what AI can know about you. Apps read a category only while you allow it, and ContextPass checks Monad on every read."
        aside={<p className="type-small hidden text-muted sm:block">Stored off-chain. Only you can see it.</p>}
      />

      {dataStatus === "ready" && context.length === 0 && (
        <section aria-label="Get started" className="mt-10 border border-ink px-5 py-6 sm:px-7">
          <p className="type-title">Nothing is stored yet.</p>
          <p className="type-body mt-2 max-w-[34rem] text-ink-2">
            Add a few lines about how you work. Or start from sample context — it’s labelled as a sample, and you can
            edit or delete it.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addSample}
              disabled={sampleBusy}
              className="type-action h-11 bg-ink px-5 text-paper transition-colors hover:bg-ink-2 disabled:opacity-50"
            >
              {sampleBusy ? "Adding…" : "Add sample context"}
            </button>
            <span className="type-small text-muted">or open a category below and add your own.</span>
          </div>
          {sampleError && <p className="type-small mt-3 text-ink" role="alert">{sampleError}</p>}
        </section>
      )}

      {dataStatus === "error" && context.length === 0 && (
        <p role="alert" className="type-small mt-10 border-l-2 border-ink pl-3 text-ink">
          Your context couldn’t be loaded just now. Refresh to try again.
        </p>
      )}

      <ol className="mt-12 border-t border-ink">
        {SCOPES.map((scope, i) => {
          const info = SCOPE_INFO[scope];
          const items = context.filter((c) => c.scope === scope);
          const apps = readers(scope);
          const isOpen = open.has(scope);
          const panelId = `scope-${scope}`;
          return (
            <li key={scope} className="border-b border-line">
              <h2>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(scope)}
                  className="group grid w-full grid-cols-[2rem_1fr_auto] items-center gap-x-3 py-6 text-left sm:grid-cols-[3rem_1fr_auto_auto] sm:gap-x-6 sm:py-8"
                >
                  <span className="type-mono col-start-1 row-start-1 text-muted">0{i + 1}</span>
                  <span className="col-start-2 row-start-1">
                    <span className="type-headline block">{info.label}</span>
                    <span className="type-small mt-1 block text-muted">
                      {info.description} · {items.length} item{items.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="col-start-2 row-start-2 mt-3 flex items-center gap-2 sm:col-start-3 sm:row-start-1 sm:mt-0">
                    {apps.length > 0 ? (
                      <>
                        <span className="type-small text-ink-2">Readable by</span>
                        {apps.map((a) => (
                          <AppMonogram key={a.slug} app={a} size="sm" />
                        ))}
                      </>
                    ) : (
                      <span className="type-small text-muted">No app can read this</span>
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className="relative col-start-3 row-start-1 size-9 border border-ink transition-colors group-hover:bg-ink group-hover:text-paper sm:col-start-4"
                  >
                    <span className="absolute left-1/2 top-1/2 h-[1.5px] w-3.5 -translate-x-1/2 -translate-y-1/2 bg-current" />
                    <span
                      className={`absolute left-1/2 top-1/2 h-3.5 w-[1.5px] -translate-x-1/2 -translate-y-1/2 bg-current transition-transform duration-300 ${isOpen ? "scale-y-0" : "scale-y-100"}`}
                    />
                  </span>
                </button>
              </h2>

              <div id={panelId} className={`grid transition-[grid-template-rows] duration-500 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden" inert={!isOpen}>
                  <div className="pb-8 sm:ml-[4.5rem]">
                    {items.length > 0 && (
                      <ul className="border-t border-line-soft">
                        {items.map((item) => (
                          <ContextRow key={item.id} item={item} now={now} />
                        ))}
                      </ul>
                    )}
                    <AddItem scope={scope} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="type-small mt-8 max-w-[40rem] text-muted">
        Context lives off-chain, under your identity. Only the permission to read it is recorded on Monad — never the
        content.{hasSample ? " Items marked Sample were added from sample context; edit them to make them yours." : ""}
      </p>
    </Page>
  );
}

/* ── One item: read, edit, delete ───────────────────────────── */

function ContextRow({ item, now }: { item: ContextItem; now: number }) {
  const { updateContext, deleteContext } = useContextPass();
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const save = async (title: string, content: string) => {
    setBusy(true);
    setError(undefined);
    const res = await updateContext(item.id, { title, content });
    setBusy(false);
    if (res.ok) setMode("view");
    else setError(res.message);
  };

  const remove = async () => {
    setBusy(true);
    setError(undefined);
    const res = await deleteContext(item.id);
    setBusy(false);
    if (!res.ok) setError(res.message);
  };

  if (mode === "edit") {
    return (
      <li className="border-b border-line-soft py-5">
        <ItemForm
          scope={item.scope}
          initial={item}
          busy={busy}
          error={error}
          submitLabel="Save"
          onSubmit={save}
          onCancel={() => {
            setMode("view");
            setError(undefined);
          }}
        />
      </li>
    );
  }

  return (
    <li className="grid gap-3 border-b border-line-soft py-5 sm:grid-cols-[1fr_auto] sm:gap-8">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="type-subtitle">{item.title}</span>
          {item.isSample && <span className="type-system border border-dashed border-ink-2 px-1.5 py-0.5 text-ink-2">Sample</span>}
        </p>
        <p className="type-body mt-1 whitespace-pre-line break-words text-ink-2">{item.content}</p>
        <p className="type-small mt-2 text-muted">Updated {relative(item.updatedAt, now).toLowerCase()}</p>
      </div>
      {mode === "confirm-delete" ? (
        <div role="group" aria-label={`Delete ${item.title}?`} className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          <span className="type-small text-ink">Delete this?</span>
          <div className="flex gap-2">
            <button type="button" autoFocus onClick={() => setMode("view")} className="type-action h-9 border border-ink px-3 text-[0.75rem] hover:bg-paper-2">
              Keep
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="type-action h-9 bg-ink px-3 text-[0.75rem] text-paper hover:bg-ink-2 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 sm:flex-col sm:items-end">
          <button type="button" onClick={() => setMode("edit")} className="type-small text-ink-2 underline decoration-line underline-offset-4 hover:text-ink">
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-delete")}
            className="type-small text-ink-2 underline decoration-line underline-offset-4 hover:text-ink"
          >
            Delete
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="type-small text-ink sm:col-span-2">
          {error}
        </p>
      )}
    </li>
  );
}

/* ── Add ────────────────────────────────────────────────────── */

function AddItem({ scope }: { scope: ScopeId }) {
  const { addContext } = useContextPass();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="type-action mt-5 inline-flex h-10 items-center gap-2 border border-ink px-4 text-[0.75rem] transition-colors hover:bg-ink hover:text-paper"
      >
        Add to {SCOPE_INFO[scope].label}
      </button>
    );
  }

  return (
    <div className="mt-5">
      <ItemForm
        scope={scope}
        busy={busy}
        error={error}
        submitLabel="Add"
        onSubmit={async (title, content) => {
          setBusy(true);
          setError(undefined);
          const res = await addContext({ scope, title, content });
          setBusy(false);
          if (res.ok) setOpen(false);
          else setError(res.message);
        }}
        onCancel={() => {
          setOpen(false);
          setError(undefined);
        }}
      />
    </div>
  );
}

function ItemForm({
  scope,
  initial,
  busy,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  scope: ScopeId;
  initial?: { title: string; content: string };
  busy: boolean;
  error?: string;
  submitLabel: string;
  onSubmit: (title: string, content: string) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const ph = SCOPE_INFO[scope].placeholder;
  const valid = title.trim().length > 0 && content.trim().length > 0;

  return (
    <form
      className="grid max-w-[40rem] gap-4 border border-ink bg-stock px-4 py-4 sm:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onSubmit(title.trim(), content.trim());
      }}
    >
      <label className="grid gap-1.5" htmlFor={`${uid}-title`}>
        <span className="type-label text-ink-2">Title</span>
        <input
          id={`${uid}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={ph.title}
          autoFocus
          className="type-body h-11 border border-line bg-paper px-3 text-ink placeholder:text-muted focus:border-ink focus:outline-none"
        />
      </label>
      <label className="grid gap-1.5" htmlFor={`${uid}-content`}>
        <span className="type-label text-ink-2">What an app may read</span>
        <textarea
          id={`${uid}-content`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={4000}
          rows={3}
          placeholder={ph.content}
          className="type-body resize-y border border-line bg-paper px-3 py-2 text-ink placeholder:text-muted focus:border-ink focus:outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="type-small text-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!valid || busy}
          className="type-action h-10 bg-ink px-4 text-[0.75rem] text-paper transition-colors hover:bg-ink-2 disabled:opacity-40"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="type-action h-10 border border-ink px-4 text-[0.75rem] hover:bg-paper-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
