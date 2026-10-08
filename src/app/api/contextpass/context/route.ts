import { getAuthorizedContext } from "@/lib/server/access";
import { requireOwner } from "@/lib/server/auth";
import { body, route } from "@/lib/server/http";

/**
 * THE GATE. An app asks for context: { app, scopes }.
 * Returns only the scopes covered by a permission Monad reports active now;
 * 403 (with a reason) when there is none. See src/lib/server/access.ts.
 */
export const POST = route(async (request: Request) => {
  const owner = await requireOwner(request);
  const input = await body<{ app?: unknown; scopes?: unknown }>(request);
  return Response.json(await getAuthorizedContext(owner, input.app, input.scopes));
});
