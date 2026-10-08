import { requireOwner } from "@/lib/server/auth";
import { body, route } from "@/lib/server/http";
import { confirmRevocation } from "@/lib/server/requests";

/** Record a revocation — only after the server verifies it on Monad: { transactionHash }. */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/permissions/[id]/revoked">) => {
  const owner = await requireOwner(request);
  const { id } = await ctx.params;
  return Response.json(await confirmRevocation(owner, id, await body(request)));
});
