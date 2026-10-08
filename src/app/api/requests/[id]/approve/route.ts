import { requireOwner } from "@/lib/server/auth";
import { body, route } from "@/lib/server/http";
import { approveRequest } from "@/lib/server/requests";

/** Record an Allow — only after the server verifies it on Monad: { transactionHash, scopes }. */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/requests/[id]/approve">) => {
  const owner = await requireOwner(request);
  const { id } = await ctx.params;
  return Response.json({ request: await approveRequest(owner, id, await body(request)) });
});
