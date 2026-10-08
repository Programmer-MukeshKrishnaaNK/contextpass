import { requireOwner } from "@/lib/server/auth";
import { deleteContext, updateContext } from "@/lib/server/context";
import { body, route } from "@/lib/server/http";

export const PATCH = route(async (request: Request, ctx: RouteContext<"/api/context/[id]">) => {
  const owner = await requireOwner(request);
  const { id } = await ctx.params;
  return Response.json({ item: await updateContext(owner, id, await body(request)) });
});

export const DELETE = route(async (request: Request, ctx: RouteContext<"/api/context/[id]">) => {
  const owner = await requireOwner(request);
  const { id } = await ctx.params;
  await deleteContext(owner, id);
  return new Response(null, { status: 204 });
});
