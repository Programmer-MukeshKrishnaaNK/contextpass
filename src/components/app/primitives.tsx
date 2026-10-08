"use client";

import type { ReactNode } from "react";

/** Consistent page opener for every app screen. */
export function PageHeader({
  index,
  label,
  title,
  lede,
  aside,
}: {
  index: string;
  label: string;
  title: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="pt-8 sm:pt-12 lg:pt-14">
      <div className="flex items-baseline justify-between gap-4">
        <p className="flex items-baseline gap-3">
          <span className="type-mono text-muted">{index}</span>
          <span className="type-label text-ink">{label}</span>
        </p>
        {aside}
      </div>
      <h1 className="type-display mt-6">{title}</h1>
      {lede && <p className="type-lede mt-4 max-w-[36rem] text-ink-2">{lede}</p>}
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[76rem] px-[var(--gutter)] pb-24">{children}</div>;
}

/** A labelled band inside a page. */
export function Band({
  id,
  title,
  meta,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={`mt-16 sm:mt-20 ${className}`}>
      <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-3">
        <h2 id={headingId} className="type-subtitle">
          {title}
        </h2>
        {meta && <div className="type-small text-muted">{meta}</div>}
      </div>
      {children}
    </section>
  );
}

/** Segmented filter built on real radio inputs. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)] sm:mx-0 sm:px-0">
      <div className="inline-flex border border-ink">
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={`relative flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap px-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-4 has-[:focus-visible]:outline-oxide ${
                i > 0 ? "border-l border-ink" : ""
              } ${on ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
            >
              <input type="radio" className="sr-only" name={label} checked={on} onChange={() => onChange(o.value)} />
              <span className="font-display text-[0.9375rem]" style={{ fontWeight: 540 }}>
                {o.label}
              </span>
              {o.count !== undefined && <span className={`type-mono ${on ? "text-paper/70" : "text-muted"}`}>{o.count}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Quiet empty state: a sentence, not an illustration. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-b border-line py-12">
      <p className="type-title text-ink-2">{title}</p>
      {children && <div className="type-small mt-2 text-muted">{children}</div>}
    </div>
  );
}
