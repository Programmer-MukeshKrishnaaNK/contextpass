/**
 * ContextPass consumer SDK.
 *
 * How an AI app integrates with ContextPass. Apps never touch the database:
 * they ask for access, and later ask for context. ContextPass decides — with
 * the person's on-chain permission as the authority.
 *
 *   const cp = createContextPassClient({ getAccessToken });
 *   await cp.requestAccess({ app: "code-pilot", scopes: ["projects", "coding-preferences"], duration: "1d" });
 *   const ctx = await cp.getAuthorizedContext({ app: "code-pilot", scopes: ["projects", "coding-preferences"] });
 *   if (!ctx.ok && ctx.reason === "revoked") showBlocked();
 *
 * In this phase the SDK lives in the repo and is used by the demo apps;
 * it is the boundary a published package would expose.
 */
import type { ScopeId } from "@/lib/contextpass/scopes";
import type { AppRecord, DurationId, Hex, PermissionRequest } from "@/lib/contextpass/types";

export type BlockReason = "no-permission" | "revoked" | "expired";

export interface AuthorizedContext {
  app: { slug: string; name: string };
  /** Scopes ContextPass verified on Monad and returned. */
  granted: ScopeId[];
  /** Asked for but not authorized — never returned. */
  withheld: ScopeId[];
  context: { scope: ScopeId; label: string; items: { title: string; content: string; isSample: boolean }[] }[];
  receipt: {
    verifiedAt: number;
    chainId: number;
    contract: string;
    permissions: { id: Hex; scopes: ScopeId[]; expiresAt: number; transactionHash?: Hex }[];
  };
}

export interface AppAnswer {
  text: string;
  provider: "claude" | "demo";
  model?: string;
  note?: string;
}

export type Failure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  /** Present on 403s from the access gate. */
  reason?: BlockReason;
};

export type Result<T> = ({ ok: true } & T) | Failure;

export interface ContextPassClientOptions {
  /** Returns the person's ContextPass (Privy) access token. */
  getAccessToken: () => Promise<string | null>;
  baseUrl?: string;
}

export async function callContextPass<T>(
  opts: ContextPassClientOptions,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<Result<T>> {
  let token: string | null = null;
  try {
    token = await opts.getAccessToken();
  } catch {
    /* no session: the server decides (public routes answer, private ones 401) */
  }

  let res: Response;
  try {
    res = await fetch(`${opts.baseUrl ?? ""}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, code: "network", message: "ContextPass couldn’t be reached. Check your connection and try again." };
  }

  if (res.status === 204) return { ok: true } as Result<T>;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      code: typeof data.error === "string" ? data.error : "error",
      message: typeof data.message === "string" ? data.message : "Something went wrong. Try again.",
      reason: data.reason as BlockReason | undefined,
    };
  }
  return { ok: true, ...(data as T) };
}

export function createContextPassClient(opts: ContextPassClientOptions) {
  return {
    /** The apps registered with ContextPass. */
    apps: () => callContextPass<{ apps: AppRecord[] }>(opts, "GET", "/api/apps"),

    /** Ask the person for access. Creates (or returns the open) request for them to review. */
    requestAccess: (input: { app: string; scopes: ScopeId[]; duration?: DurationId }) =>
      callContextPass<{ request: PermissionRequest }>(opts, "POST", "/api/requests", input),

    /** Read context. Returns only what an active on-chain permission covers; 403 with a reason otherwise. */
    getAuthorizedContext: (input: { app: string; scopes: ScopeId[] }) =>
      callContextPass<AuthorizedContext>(opts, "POST", "/api/contextpass/context", input),

    /** Demo apps' backends: read context through the gate, then answer with it. */
    respond: (input: { app: string; scopes: ScopeId[]; task: string }) =>
      callContextPass<{ answer: AppAnswer; authorized: AuthorizedContext }>(opts, "POST", `/api/apps/${encodeURIComponent(input.app)}/respond`, {
        scopes: input.scopes,
        task: input.task,
      }),
  };
}

export type ContextPassClient = ReturnType<typeof createContextPassClient>;
