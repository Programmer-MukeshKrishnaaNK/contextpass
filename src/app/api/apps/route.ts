import { check, db, toApp, type AppRow } from "@/lib/server/db";
import { route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The public app registry: who may ask, for what, and why. No auth needed. */
export const GET = route(async () => {
  const rows = check(
    await db()
      .from("apps")
      .select("id, slug, name, kind, description, developer, monogram, requested_scopes, default_duration, reason")
      .eq("status", "active")
      .order("name"),
    "list apps",
  ) as AppRow[];
  return Response.json({ apps: rows.map(toApp) });
});
