import { ANNOUNCEMENTS, type Announcement } from "../announcements";
import { claimEmailBudget, releaseEmailBudget } from "./emailBudget";
import { EmailService } from "./emailService";

/**
 * Most recipients this job will attempt in one cron tick.
 *
 * This is a smoothing limit, not the safety limit -- the day's real ceiling is
 * enforced by the shared budget in emailBudget.ts, which this job never
 * exceeds. Note what that means: raising this number does not make a blast
 * finish sooner, because the budget binds long before the ticks run out (at
 * 48 ticks a day, even 10 per tick can offer 480 against an allowance of 275).
 * All it changes is how much of the day the sends are spread over -- 30 spends
 * the allowance in roughly four hours, 10 spreads it across twelve. Lower is
 * gentler on the sender reputation that transactional mail depends on; the
 * only lever that actually shortens a blast is the daily budget itself, which
 * is pinned to what the provider allows.
 */
const BATCH_SIZE = 30;

/**
 * Sends after which a recipient is abandoned.
 *
 * Failures are retried because the common cause is the daily quota running out,
 * which fixes itself at midnight. This ceiling is what stops a permanently dead
 * address from claiming budget every tick forever.
 */
const MAX_ATTEMPTS = 3;

/**
 * Which list a recipient came from. It decides both the ledger the send is
 * written to and the copy the template renders, so it travels with the row
 * rather than being re-derived at the write.
 */
type Audience = "account" | "waitlist";

const LEDGER: Record<Audience, { table: string; idColumn: string }> = {
  account: {
    table: "startathon_announcement_deliveries",
    idColumn: "user_id",
  },
  waitlist: {
    table: "startathon_announcement_wl_deliveries",
    idColumn: "waitlist_id",
  },
};

interface RecipientRow {
  recipient_id: string;
  name: string | null;
  email: string;
}

/**
 * Sends Startathon announcements, one announcement and one small batch per cron
 * tick. Account holders always receive them; the waitlist receives the ones
 * flagged `includeWaitlist`.
 *
 * Send state lives entirely in the two delivery ledgers: a recipient is pending
 * for an announcement when no row pairs the two, or when the row records a
 * failure that has not yet used up its attempts. Once every active announcement
 * has drained, this job costs one query per tick and is safe to leave wired in
 * permanently.
 *
 * Nobody is mailed twice for the same announcement, including anyone who is on
 * both lists. That is enforced in the two fetch queries rather than here: the
 * waitlist query drops addresses that have an account, and the account query
 * drops addresses already mailed as a waitlister. The second half matters
 * because a waitlister can sign up *between* the two halves of a blast, which
 * would otherwise make them newly pending on the account side.
 */
export async function notifyStartathonAnnouncements(env: Env): Promise<void> {
  for (const announcement of ANNOUNCEMENTS) {
    if (!announcement.active) {
      continue;
    }

    // Accounts drain first, then the waitlist. Order is arbitrary but must be
    // fixed: the cross-list exclusions are evaluated at fetch time, so a stable
    // order keeps which side wins a shared address predictable.
    const accounts = await fetchPendingAccounts(env, announcement.id);

    if (accounts.length > 0) {
      await sendBatch(env, announcement, "account", accounts);
      return;
    }

    if (announcement.includeWaitlist) {
      const waitlisters = await fetchPendingWaitlisters(env, announcement.id);

      if (waitlisters.length > 0) {
        await sendBatch(env, announcement, "waitlist", waitlisters);
        // One announcement per tick. Draining several within a single tick would
        // spend the whole day's budget in one burst, defeating the smoothing that
        // BATCH_SIZE exists to provide.
        return;
      }
    }
  }
}

async function fetchPendingAccounts(
  env: Env,
  announcementId: string,
): Promise<RecipientRow[]> {
  // Oldest accounts first, so send order is stable across ticks and a partially
  // drained blast resumes where it stopped. Retries sort in alongside first
  // attempts rather than ahead of them, so a few bad addresses cannot stall the
  // rest of the list.
  //
  // The NOT EXISTS is the second half of the cross-list dedupe: it excludes
  // anyone who already received this announcement as a waitlister and has since
  // created an account. startathon_users.email is always stored lowercased
  // (signup, login, invite and Google all normalize) whereas startathon_wl.email
  // is raw input, so only the waitlist side is lowered here.
  const batch = await env.EVENTS_DB.prepare(
    `SELECT u.user_id AS recipient_id, u.name, u.email
     FROM startathon_users u
     LEFT JOIN startathon_announcement_deliveries d
       ON d.announcement_id = ?1 AND d.user_id = u.user_id
     WHERE (d.user_id IS NULL
            OR (d.status = 'failed' AND d.attempts < ?2))
       AND NOT EXISTS (
         SELECT 1
         FROM startathon_announcement_wl_deliveries wd
         JOIN startathon_wl w ON w.waitlist_id = wd.waitlist_id
         WHERE wd.announcement_id = ?1
           AND wd.status = 'sent'
           AND LOWER(w.email) = u.email
       )
     ORDER BY u.created_at ASC
     LIMIT ?3`,
  )
    .bind(announcementId, MAX_ATTEMPTS, BATCH_SIZE)
    .all<RecipientRow>();

  return batch.results ?? [];
}

async function fetchPendingWaitlisters(
  env: Env,
  announcementId: string,
): Promise<RecipientRow[]> {
  // startathon_wl.status is deliberately not filtered on. It tracks the
  // registration-open blast only, and 'registered' is a snapshot taken when
  // that job last ran -- the live test for "this person has an account" is the
  // email match below, which is also what keeps someone who converted after
  // that snapshot from being mailed twice.
  //
  // The correlated subquery picks one canonical row per address. startathon_wl
  // enforces UNIQUE on email, but SQLite's uniqueness is case-sensitive, so two
  // rows differing only in case can both exist and would otherwise both be
  // mailed.
  const batch = await env.EVENTS_DB.prepare(
    `SELECT w.waitlist_id AS recipient_id, w.name, w.email
     FROM startathon_wl w
     LEFT JOIN startathon_announcement_wl_deliveries d
       ON d.announcement_id = ?1 AND d.waitlist_id = w.waitlist_id
     WHERE (d.waitlist_id IS NULL
            OR (d.status = 'failed' AND d.attempts < ?2))
       AND LOWER(w.email) NOT IN (SELECT email FROM startathon_users)
       AND w.waitlist_id = (
         SELECT w2.waitlist_id
         FROM startathon_wl w2
         WHERE LOWER(w2.email) = LOWER(w.email)
         ORDER BY w2.registered_at ASC, w2.waitlist_id ASC
         LIMIT 1
       )
     ORDER BY w.registered_at ASC
     LIMIT ?3`,
  )
    .bind(announcementId, MAX_ATTEMPTS, BATCH_SIZE)
    .all<RecipientRow>();

  return batch.results ?? [];
}

async function sendBatch(
  env: Env,
  announcement: Announcement,
  audience: Audience,
  recipients: RecipientRow[],
): Promise<void> {
  // Claim before sending, and send only what was granted. On a spent day this
  // returns 0 and the batch is left entirely untouched for tomorrow -- no rows
  // are written, so nobody is marked as attempted for mail that never left.
  const granted = await claimEmailBudget(env, recipients.length);

  if (granted === 0) {
    console.log(
      `Startathon announcement ${announcement.id}: daily email budget spent, deferring ${recipients.length} ${audience} recipient(s).`,
    );
    return;
  }

  const batch = recipients.slice(0, granted);

  console.log(
    `Startathon announcement ${announcement.id}: notifying ${batch.length} ${audience} recipient(s).`,
  );

  const emailService = new EmailService(env.BREVO_API_KEY);
  const hasAccount = audience === "account";
  const { table, idColumn } = LEDGER[audience];
  let spent = 0;

  for (const recipient of batch) {
    // Accounts created by an invite start with a null name (migration 0021),
    // and the templates split on the first word of whatever they get.
    const name = recipient.name ?? "";

    // Deliberately a single attempt per tick: an immediate retry against a
    // provider that just refused would spend a second message from the same
    // capped quota to hit the same wall. The next tick retries instead, and
    // MAX_ATTEMPTS bounds how long that continues.
    const sent = await emailService.sendStartathonAnnouncementEmail(
      name,
      recipient.email,
      announcement.subject,
      announcement.render({ name, hasAccount }),
    );

    spent += 1;

    // Written per recipient, so a mid-batch crash loses at most the in-flight
    // send; recipients never reached simply have no row and are picked up next
    // tick. The table and key column are chosen from the LEDGER map above, not
    // from caller input, so the interpolation cannot carry anything but one of
    // two literals.
    await env.EVENTS_DB.prepare(
      `INSERT INTO ${table}
         (announcement_id, ${idColumn}, status, attempts, updated_at)
       VALUES (?1, ?2, ?3, 1, ?4)
       ON CONFLICT(announcement_id, ${idColumn}) DO UPDATE SET
         status = excluded.status,
         attempts = attempts + 1,
         updated_at = excluded.updated_at`,
    )
      .bind(
        announcement.id,
        recipient.recipient_id,
        sent ? "sent" : "failed",
        Date.now(),
      )
      .run();

    if (!sent) {
      console.error(
        `Startathon announcement ${announcement.id}: send failed for ${audience} ${recipient.recipient_id} (${recipient.email}), will retry up to ${MAX_ATTEMPTS} attempts.`,
      );
    }

    // Same rate-limit courtesy the follow-up and waitlist jobs use.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Only reachable if the loop exits early in future edits; harmless today.
  await releaseEmailBudget(env, granted - spent);
}
