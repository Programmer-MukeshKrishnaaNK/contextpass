import { requireOwner } from "@/lib/server/auth";
import { createContext, listContext } from "@/lib/server/context";
import { body, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The signed-in owner's context. Never another person's. */
export const GET = route(async (request: Request) => {
  const owner = await requireOwner(request);
  return Response.json({ items: await listContext(owner) });
});

export const POST = route(async (request: Request) => {
  const owner = await requireOwner(request);
  return Response.json({ item: await createContext(owner, await body(request)) }, { status: 201 });
});
