export interface ApplicationWindowBlock {
  status: 403 | 500;
  error: string;
}

/**
 * Gates writes to the Startathon application on the submission deadline.
 * Returns null while the window is open, or the error response to send.
 *
 * The deadline lives in wrangler.jsonc vars rather than in source so it
 * can move without a code deploy, and so both the application endpoint
 * and the member endpoint read one value instead of two hand-synced
 * copies.
 *
 * A missing or unparseable value fails closed with a 500 rather than a
 * 403: an unset deadline is a deploy mistake, and reporting it as
 * "applications are closed" would send teams chasing a deadline that was
 * never actually configured.
 *
 * Returns null-or-block rather than a discriminated union because this
 * project builds with strictNullChecks off, under which TypeScript can't
 * narrow a union on a boolean discriminant.
 */
export function applicationWindowBlock(
  closesAt: string | undefined,
  now: number = Date.now(),
): ApplicationWindowBlock | null {
  if (!closesAt) {
    return { status: 500, error: "Application deadline is not configured" };
  }

  const deadline = new Date(closesAt).getTime();
  if (Number.isNaN(deadline)) {
    return { status: 500, error: "Application deadline is not configured" };
  }

  if (now > deadline) {
    return { status: 403, error: "Applications are closed" };
  }

  return null;
}
