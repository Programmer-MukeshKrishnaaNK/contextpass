import { getAuthorizedContext } from "@/lib/server/access";
import { generateResponse } from "@/lib/server/ai";
import { requireOwner } from "@/lib/server/auth";
import { body, invalid, route } from "@/lib/server/http";

/**
 * A demo app's backend. It gets context the only way any app can — through
 * the ContextPass gate — then answers with it. No gate, no context, no answer.
 */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/apps/[slug]/respond">) => {
  const owner = await requireOwner(request);
  const { slug } = await ctx.params;
  const input = await body<{ scopes?: unknown; task?: unknown }>(request);
  const task = typeof input.task === "string" ? input.task.trim().slice(0, 500) : "";
  if (!task) throw invalid("Say what you’d like help with.");

  const authorized = await getAuthorizedContext(owner, slug, input.scopes);
  const answer = await generateResponse({ appSlug: authorized.app.slug, appName: authorized.app.name, task, context: authorized.context });
  return Response.json({ answer, authorized });
});
