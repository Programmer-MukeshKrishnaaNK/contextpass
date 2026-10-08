import { requireOwner } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { denyRequest } from "@/lib/server/requests";

/** Record a Deny. No transaction: nothing was granted, so nothing goes on-chain. */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/requests/[id]/deny">) => {
  const owner = await requireOwner(request);
  const { id } = await ctx.params;
  return Response.json({ request: await denyRequest(owner, id) });
});
