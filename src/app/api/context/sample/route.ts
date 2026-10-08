import { requireOwner } from "@/lib/server/auth";
import { addSampleContext } from "@/lib/server/context";
import { route } from "@/lib/server/http";

/** Adds clearly-labelled sample context, once. */
export const POST = route(async (request: Request) => {
  const owner = await requireOwner(request);
  return Response.json({ items: await addSampleContext(owner) });
});
