import { requireOwner } from "@/lib/server/auth";
import { ACTIVITY_COLUMNS, check, db, toActivity, type ActivityRow } from "@/lib/server/db";
import { route } from "@/lib/server/http";
import { reconcile } from "@/lib/server/requests";

export const dynamic = "force-dynamic";

/** The owner's ledger, newest first, brought in line with Monad first. */
export const GET = route(async (request: Request) => {
  const owner = await requireOwner(request);
  await reconcile(owner);
  const rows = check(
    await db().from("activity_events").select(ACTIVITY_COLUMNS).eq("owner_id", owner.id).order("occurred_at", { ascending: false }).limit(300),
    "list activity",
  ) as unknown as ActivityRow[];
  return Response.json({ events: rows.map(toActivity) });
});
