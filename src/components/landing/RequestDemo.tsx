"use client";

import { useEffect, useState } from "react";
import { DURATIONS } from "@/lib/contextpass/clock";
import { EXAMPLE_REQUEST, exampleApp } from "@/lib/contextpass/examples";
import { PermissionRequest, type Resolution } from "@/components/ui/PermissionRequest";

const studyos = exampleApp(EXAMPLE_REQUEST.app);
const REQUESTED = EXAMPLE_REQUEST.scopes;

/**
 * A local rehearsal of the request on the landing page. Nothing here is
 * recorded — the stamp says so. In the app, Allow is recorded on Monad.
 * Rendered after mount so times are always the viewer's local time.
 */
export function RequestDemo() {
  const [now, setNow] = useState<number>();
  const [askedAt, setAskedAt] = useState<number>();
  const [resolution, setResolution] = useState<Resolution>();
  const [round, setRound] = useState(0);

  useEffect(() => {
    const start = Date.now();
    // Client-only clock: the server never renders a time it can't know.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(start);
    setAskedAt(start - 4000);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now === undefined || askedAt === undefined) {
    return <div aria-hidden="true" className="h-[40rem] bg-stock/10" />;
  }

  return (
    <PermissionRequest
      key={round}
      app={studyos}
      requestId={`REQ-${String(430 + round).padStart(4, "0")}`}
      requestedAt={askedAt}
      scopes={REQUESTED}
      defaultDuration="1h"
      reason="To plan your study sessions around how you like to learn."
      now={now}
      resolution={resolution}
      onAllow={(s, d) =>
        setResolution({ kind: "granted", scopes: s, duration: d, at: now, expiresAt: now + DURATIONS[d].ms, onChain: false })
      }
      onDeny={() => setResolution({ kind: "denied", at: now })}
      onDone={() => {
        setResolution(undefined);
        setAskedAt(Date.now());
        setRound((r) => r + 1);
      }}
      doneLabel="Ask again"
    />
  );
}
