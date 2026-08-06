/**
 * Hard ceiling on the sending account: 300 messages per day across every kind
 * of mail this Worker sends.
 */
const PROVIDER_DAILY_CAP = 300;

/**
 * Held back from bulk jobs for transactional mail -- password resets, payment
 * confirmations, invites -- which a user is actively waiting on and which must
 * never queue behind a marketing blast.
 *
 * This is a reservation, not an enforced quota: transactional sends do not
 * claim budget (blocking a password reset to protect a blast would be
 * backwards). It works by keeping the number bulk jobs may consume below the
 * provider cap, leaving the difference free.
 */
const TRANSACTIONAL_RESERVE = 50;

/** What all bulk jobs together may send in a UTC day. */
export const BLAST_DAILY_BUDGET = PROVIDER_DAILY_CAP - TRANSACTIONAL_RESERVE;

/**
 * The budget day key.
 *
 * UTC, because Workers run in UTC and the alternative -- guessing which
 * timezone the provider resets its own counter in -- is worse. A boundary that
 * drifts from the provider's costs at most one tick's worth of headroom, which
 * the transactional reserve already absorbs.
 */
function budgetDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reserves up to `requested` sends against today's bulk budget and returns how
 * many were actually granted -- 0 when the day is spent.
 *
 * Callers MUST send no more than the returned count. Budget is claimed up
 * front rather than counted after the fact so that a crash mid-batch can only
 * over-reserve (costing unused quota that resets at midnight) and never
 * over-send (which would get the sending account rate-limited).
 */
export async function claimEmailBudget(
  env: Env,
  requested: number,
): Promise<number> {
  if (requested <= 0) {
    return 0;
  }

  const day = budgetDay();

  // Read and increment run as one D1 batch, which executes as a single
  // transaction. The cron is effectively single-threaded -- a tick sends a
  // handful of emails and finishes in seconds, nowhere near the 30-minute
  // interval -- but making the claim atomic means an overlap could only ever
  // under-grant rather than hand the same quota to two jobs.
  const [before, after] = await env.EVENTS_DB.batch<{ sent: number }>([
    env.EVENTS_DB.prepare(
      "SELECT sent FROM email_send_budget WHERE day = ?",
    ).bind(day),
    env.EVENTS_DB.prepare(
      `INSERT INTO email_send_budget (day, sent)
       VALUES (?1, MIN(?2, ?3))
       ON CONFLICT(day) DO UPDATE SET sent = MIN(?3, sent + ?2)
       RETURNING sent`,
    ).bind(day, requested, BLAST_DAILY_BUDGET),
  ]);

  const previouslySent = before.results?.[0]?.sent ?? 0;
  const nowSent = after.results?.[0]?.sent ?? previouslySent;
  const granted = Math.max(0, nowSent - previouslySent);

  if (granted < requested) {
    console.log(
      `Email budget: granted ${granted}/${requested} (${nowSent}/${BLAST_DAILY_BUDGET} used on ${day}).`,
    );
  }

  return granted;
}

/**
 * Hands back quota claimed but not spent, so an early return in a caller does
 * not burn the day's allowance. Safe to skip on the crash path -- unreturned
 * budget simply expires at the UTC boundary.
 */
export async function releaseEmailBudget(
  env: Env,
  count: number,
): Promise<void> {
  if (count <= 0) {
    return;
  }

  await env.EVENTS_DB.prepare(
    "UPDATE email_send_budget SET sent = MAX(0, sent - ?) WHERE day = ?",
  )
    .bind(count, budgetDay())
    .run();
}
