"use client";

import { useEffect, useRef } from "react";
import { PermissionRequest, type Progress, type Resolution } from "@/components/ui/PermissionRequest";
import { CloseGlyph } from "@/components/ui/marks";
import { chainConfigured } from "@/lib/chain/config";
import { SCOPE_INFO } from "@/lib/contextpass/scopes";
import { useContextPass, useNow } from "@/lib/contextpass/store";

/**
 * A request pass wired to the store. It stays mounted after the decision so
 * the stamp can land — and a grant is only stamped once Monad confirms it.
 */
export function BoundRequest({
  permissionId: requestId,
  onDecided,
  onDone,
  headingLevel,
}: {
  permissionId: string;
  onDecided?: (id: string) => void;
  onDone?: () => void;
  headingLevel?: "h2" | "h3";
}) {
  const { requestById, appById, grant, deny, progress, chainStatus } = useContextPass();
  const now = useNow();
  const found = requestById(requestId);
  if (!found) return null;
  const { request, recorded } = found;

  let resolution: Resolution | undefined;
  if (request.status === "denied") resolution = { kind: "denied", at: request.decisionAt ?? request.requestedAt };
  else if (recorded?.grantedAt && recorded.expiresAt)
    resolution = {
      kind: "granted",
      scopes: recorded.scopes,
      duration: request.duration,
      at: recorded.grantedAt,
      expiresAt: recorded.expiresAt,
      onChain: true,
      tx: recorded.grantTx,
    };

  // Live progress wins; otherwise a persisted failure keeps the retry state across refreshes.
  const step = progress[requestId];
  const shown: Progress | undefined =
    step?.phase === "failed"
      ? { phase: "failed", detail: step.failure.detail }
      : step ?? (request.status === "failed" ? { phase: "failed", detail: request.failureReason ?? "The last attempt wasn’t recorded." } : undefined);

  const blocked = !chainConfigured
    ? "Permissions can’t be recorded yet: the permission contract isn’t configured."
    : chainStatus === "loading" || chainStatus === "waiting"
      ? "Reading your permissions from Monad…"
      : undefined;

  return (
    <PermissionRequest
      app={appById(request.appSlug)}
      requestId={request.id}
      requestedAt={request.requestedAt}
      scopes={request.requestedScopes.map((s) => SCOPE_INFO[s])}
      defaultDuration={request.duration}
      reason={request.reason}
      now={now}
      resolution={resolution}
      progress={shown}
      blocked={blocked}
      onAllow={(s, d) => {
        onDecided?.(request.id);
        void grant(request.id, s, d);
      }}
      onDeny={() => {
        onDecided?.(request.id);
        void deny(request.id);
      }}
      onDone={onDone}
      headingLevel={headingLevel}
    />
  );
}

/**
 * Native <dialog>: focus trapping, Escape and inertness come from the platform.
 *
 * While the owner is approving in Privy's signing step, the dialog drops out
 * of the top layer (modal → non-modal). A modal dialog makes everything
 * outside it inert and sits above it, which would block that approval.
 */
export function RequestDialog({ permissionId, onClose }: { permissionId: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const switching = useRef(false);
  const { progress } = useContextPass();
  const signing = permissionId ? progress[permissionId]?.phase === "signing" : false;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!permissionId) {
      if (d.open) d.close();
      return;
    }
    const wantModal = !signing;
    if (d.open && d.matches(":modal") === wantModal) return;
    if (d.open) {
      // The close event fires asynchronously; the handler clears this flag.
      switching.current = true;
      d.close();
    }
    if (wantModal) d.showModal();
    else d.show();
  }, [permissionId, signing]);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (switching.current) {
          switching.current = false;
          return;
        }
        onClose();
      }}
      onClick={(e) => !signing && e.target === ref.current && onClose()}
      aria-label="Review access request"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-visible bg-transparent p-0 backdrop:bg-ink/55 open:animate-rise [&:not(:modal)]:fixed [&:not(:modal)]:inset-0 [&:not(:modal)]:z-30"
    >
      {permissionId && (
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute -top-11 right-0 grid size-9 place-items-center bg-paper text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            <CloseGlyph />
          </button>
          <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto">
            <BoundRequest permissionId={permissionId} onDone={onClose} headingLevel="h2" />
          </div>
        </div>
      )}
    </dialog>
  );
}
