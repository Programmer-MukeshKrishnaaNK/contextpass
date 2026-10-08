"use client";

import { useState } from "react";
import { explorerTx } from "@/lib/chain/config";
import { Short } from "./marks";

/** A Monad transaction: short, mono, copyable. Never the main element on screen. */
export function TxHash({ hash, className = "", night = false }: { hash: string; className?: string; night?: boolean }) {
  const [copied, setCopied] = useState(false);
  const href = explorerTx(hash);
  const quiet = night ? "text-night-muted hover:text-night-text" : "text-muted hover:text-ink";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the hash stays visible */
    }
  };

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className="type-mono" title={hash}>
        <Short hash={hash} />
      </span>
      <button type="button" onClick={copy} className={`type-small underline decoration-line underline-offset-4 ${quiet}`}>
        {copied ? "Copied" : "Copy"}
        <span className="sr-only"> transaction hash</span>
      </button>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className={`type-small underline decoration-line underline-offset-4 ${quiet}`}>
          Explorer
          <span className="sr-only"> (opens Monad testnet explorer)</span>
        </a>
      )}
    </span>
  );
}
