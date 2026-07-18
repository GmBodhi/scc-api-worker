import { z } from "zod";
import type { AppContext } from "../types";

/**
 * Shared catch-block handler for endpoint handlers. Request validation
 * (body/query/params) throws a raw z.ZodError from chanfana's
 * getValidatedData() — without this, that error was being swallowed by
 * the generic 500 branch and reported to callers as "Internal server
 * error" instead of a 400 describing which field was wrong.
 */
export function handleEndpointError(
  c: AppContext,
  error: unknown,
  logPrefix: string,
) {
  if (error instanceof z.ZodError) {
    const message = error.errors
      .map((e) => `${e.path.join(".") || "body"}: ${e.message}`)
      .join("; ");
    return c.json({ success: false, error: message }, 400);
  }

  console.error(logPrefix, error);
  return c.json({ success: false, error: "Internal server error" }, 500);
}
