import { requireOwner } from "@/lib/server/auth";
import { check, db, REQUEST_COLUMNS, toRequest, type RequestRow } from "@/lib/server/db";
import { body, route } from "@/lib/server/http";
import { createRequest, reconcile } from "@/lib/server/requests";

export const dynamic = "force-dynamic";

/** The owner's requests, brought in line with Monad first. */
export const GET = route(async (request: Request) => {
  const owner = await requireOwner(request);
  await reconcile(owner);
  const rows = check(
    await db().from("permission_requests").select(REQUEST_COLUMNS).eq("owner_id", owner.id).order("requested_at", { ascending: false }),
    "list requests",
  ) as unknown as RequestRow[];
  return Response.json({ requests: rows.map(toRequest) });
});

/** An app asks for access: { app, scopes, duration? }. */
export const POST = route(async (request: Request) => {
  const owner = await requireOwner(request);
  const { request: created, created: isNew } = await createRequest(owner, await body(request));
  return Response.json({ request: created }, { status: isNew ? 201 : 200 });
});
