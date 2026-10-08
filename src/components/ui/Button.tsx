import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "solid" | "outline" | "quiet" | "solid-night" | "outline-night";
type Size = "sm" | "md" | "lg";

const base =
  "type-action relative inline-flex select-none items-center justify-center gap-2.5 whitespace-nowrap transition-[background-color,color,border-color,transform] duration-200 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  solid: "bg-ink text-paper hover:bg-ink-2",
  outline: "border border-ink text-ink hover:bg-ink hover:text-paper",
  quiet: "text-ink underline decoration-line decoration-1 underline-offset-[6px] hover:decoration-ink",
  "solid-night": "bg-night-text text-night hover:bg-paper",
  "outline-night": "border border-night-muted text-night-text hover:border-night-text hover:bg-night-text hover:text-night",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.6875rem]",
  md: "h-11 px-5",
  lg: "h-14 px-7 text-[0.875rem]",
};

export function buttonClass(variant: Variant = "solid", size: Size = "md", extra = "") {
  const sizing = variant === "quiet" ? "h-auto px-0" : sizes[size];
  return `${base} ${variants[variant]} ${sizing} ${extra}`;
}

type Common = { variant?: Variant; size?: Size; className?: string; children: ReactNode };

export function Button({
  variant = "solid",
  size = "md",
  className = "",
  children,
  ...rest
}: Common & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "solid",
  size = "md",
  className = "",
  children,
  ...rest
}: Common & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/** A typographic arrow that nudges on hover of its parent `.group`. */
export function Arrow({ dir = "right" }: { dir?: "right" | "down" | "up-right" }) {
  const rot = dir === "down" ? "rotate-90" : dir === "up-right" ? "-rotate-45" : "";
  const move =
    dir === "down" ? "group-hover:translate-y-0.5" : dir === "up-right" ? "group-hover:-translate-y-0.5 group-hover:translate-x-0.5" : "group-hover:translate-x-1";
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`size-[0.95em] shrink-0 transition-transform duration-200 ${rot} ${move}`}
      fill="none"
    >
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}
