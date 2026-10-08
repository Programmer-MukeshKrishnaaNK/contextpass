"use client";

import { useState } from "react";
import { TxHash } from "@/components/ui/TxHash";
import { useContextPass } from "@/lib/contextpass/store";

/**
 * Revoke, as a real decision: confirm here, approve in the signing step,
 * then wait for Monad. The row only shows Revoked once the chain says so.
 */
export function RevokeControl({ ids, appName, compact = false }: { ids: string[]; appName: string; compact?: boolean }) {
  const { revoke, progress, clearProgress } = useContextPass();
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  const steps = ids.map((id) => progress[id]).filter(Boolean);
  const live = steps.find((s) => s?.phase === "signing" || s?.phase === "confirming");
  const failed = steps.find((s) => s?.phase === "failed");
  const size = compact ? "h-10 text-[0.75rem]" : "h-11";

  const run = async () => {
    setConfirming(false);
    setRunning(true);
    ids.forEach(clearProgress);
    for (const id of ids) {
      await revoke(id);
    }
    setRunning(false);
  };

  if (live || running) {
    return (
      <div role="status" className="border border-ink px-3 py-3">
        <p className="type-label text-oxide">Revoking access</p>
        <p className="mt-1.5 flex items-center gap-2">
          <span aria-hidden="true" className="size-1.5 animate-live rounded-full bg-oxide [--live-color:var(--oxide)]" />
          <span className="type-small text-ink">
            {live?.phase === "confirming" ? "Confirming on Monad…" : "Waiting for your approval…"}
          </span>
        </p>
        {live?.phase === "confirming" && <TxHash hash={live.hash} className="mt-1.5" />}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="animate-ticker" role="group" aria-label={`Confirm revoking ${appName}`}>
        <p className="type-small mb-2 text-ink">
          End {appName}’s access now? You’ll approve it, then it’s recorded on Monad.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => setConfirming(false)}
            className={`type-action border border-ink transition-colors hover:bg-paper-2 ${size}`}
          >
            Keep
          </button>
          <button
            type="button"
            onClick={run}
            className={`type-action bg-oxide text-paper transition-colors hover:bg-ink ${size}`}
          >
            Revoke
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {failed?.phase === "failed" && (
        <div role="alert" className="border-l-2 border-ink pl-3">
          <p className="type-small text-ink">Access wasn’t revoked.</p>
          <p className="type-small text-muted">{failed.failure.detail}</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`type-action border border-oxide px-4 text-oxide transition-colors hover:bg-oxide hover:text-paper ${size}`}
      >
        {failed ? "Try again" : "Revoke access"}
      </button>
    </div>
  );
}
