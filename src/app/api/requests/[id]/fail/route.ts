import { requireOwner } from "@/lib/server/auth";
import { body, route } from "@/lib/server/http";
import { failRequest } from "@/lib/server/requests";

/** Record a failed Allow attempt. The request stays retryable: { reason }. */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/requests/[id]/fail">) => {
  const owner = await requireOwner(request);
  const { id } = await ctx.params;
  return Response.json({ request: await failRequest(owner, id, await body(request)) });
});
