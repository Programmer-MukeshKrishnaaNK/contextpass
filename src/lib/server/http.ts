import "server-only";

/**
 * API errors with honest status codes and safe messages.
 *
 *   401 not authenticated   403 not authorized   404 not found
 *   409 conflict / stale     422 invalid request   500 unexpected
 *
 * Messages are written for the person using ContextPass. Internals are
 * logged in development only, never returned.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404 | 409 | 422 | 500 | 503,
    public readonly code: string,
    message: string,
    /** Extra, non-sensitive fields for the client (e.g. a block reason). */
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const unauthenticated = () => new ApiError(401, "unauthenticated", "Sign in to ContextPass to continue.");
export const forbidden = (message: string, extra?: Record<string, unknown>) => new ApiError(403, "forbidden", message, extra);
export const notFound = (what: string) => new ApiError(404, "not_found", `${what} wasn’t found.`);
export const conflict = (message: string) => new ApiError(409, "conflict", message);
export const invalid = (message: string) => new ApiError(422, "invalid_request", message);
export const unavailable = (message: string) => new ApiError(503, "unavailable", message);

const dev = process.env.NODE_ENV !== "production";

/** Development-only structured log. Never pass tokens, keys or raw context here. */
export function devLog(event: string, fields: Record<string, unknown> = {}) {
  if (dev) console.info(`[contextpass] ${event}`, fields);
}

/** Wraps a route handler: maps ApiError to JSON, everything else to a safe 500. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return Response.json({ error: error.code, message: error.message, ...error.extra }, { status: error.status });
      }
      if (dev) console.error("[contextpass] unexpected", error);
      return Response.json({ error: "server_error", message: "Something went wrong on our side. Try again." }, { status: 500 });
    }
  };
}

/** Parses a JSON body or fails with 422. */
export async function body<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as T;
  } catch {
    throw invalid("The request body must be a JSON object.");
  }
}
