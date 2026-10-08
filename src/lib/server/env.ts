import "server-only";
import { unavailable } from "./http";

/**
 * Server-only configuration. None of these are NEXT_PUBLIC_: they never
 * reach the browser bundle. Missing values fail closed with a 503.
 */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw unavailable("ContextPass isn’t fully configured on this server yet.");
  return value;
}

export const serverEnv = {
  privyAppId: () => required("NEXT_PUBLIC_PRIVY_APP_ID"),
  privyAppSecret: () => required("PRIVY_APP_SECRET"),
  /** Project origin. Accepts the REST URL Supabase also shows (…/rest/v1/); the client adds that path itself. */
  supabaseUrl: () => {
    const value = required("SUPABASE_URL");
    try {
      return new URL(value).origin;
    } catch {
      throw unavailable("ContextPass isn’t fully configured on this server yet.");
    }
  },
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  /** Optional: without it, apps use the built-in demo writer. */
  anthropicApiKey: () => process.env.ANTHROPIC_API_KEY?.trim() || undefined,
  aiModel: () => process.env.CONTEXTPASS_AI_MODEL?.trim() || "claude-opus-5-5",
};
