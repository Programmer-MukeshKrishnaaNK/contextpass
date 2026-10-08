import Link from "next/link";

/**
 * The mark: a dot held inside brackets. Your context, inside your bounds.
 * Brackets are ink; the dot is the oxide seal — the user's word.
 */
export function Mark({ className = "", night = false }: { className?: string; night?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path
        d="M8 3.5H4.5v17H8M16 3.5h3.5v17H16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
      />
      <circle cx="12" cy="12" r="3.1" fill={night ? "var(--oxide-night)" : "var(--oxide)"} />
    </svg>
  );
}

export function Wordmark({
  href = "/",
  night = false,
  className = "",
}: {
  href?: string;
  night?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="ContextPass home"
      className={`group inline-flex items-center gap-2 ${night ? "text-night-text" : "text-ink"} ${className}`}
    >
      <Mark night={night} className="size-[22px] shrink-0 transition-transform duration-300 ease-out group-hover:scale-[1.06]" />
      <span
        className="font-display text-[1.2rem] leading-none tracking-[-0.035em]"
        style={{ fontWeight: 640, fontVariationSettings: '"wdth" 90' }}
      >
        ContextPass
      </span>
    </Link>
  );
}
