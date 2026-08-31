import { getStartathonSelectionFeeEmail } from "../templates/startathon-selection-fee";
import { claimEmailBudget, releaseEmailBudget } from "./emailBudget";
import { EmailService } from "./emailService";

/**
 * Slug written into startathon_announcement_deliveries.announcement_id.
 *
 * Reuses the announcement ledger for the same reason the results blast does:
 * one row per user per blast, a composite primary key that makes a second send
 * impossible, and an attempt counter. Never rename it after the first send —
 * the ledger is keyed on it, so a changed id makes every past recipient look
 * unsent and mails them again.
 */
const FEE_BLAST_ID = "2026-08-23-selection-fee";

/**
 * The send trigger. Deploying with this true is what starts the blast.
 *
 * Left false: the fee mail points people at a dashboard page that has to be
 * able to take the payment, and mailing ~70 people ahead of that page shipping
 * buys nothing but support load. Flip it once startathon.sctcoding.club shows
 * the selection-fee flow, and deploy.
 */
const FEE_ACTIVE = true;

/** Most recipients attempted per cron tick. Same smoothing as the other blasts. */
const BATCH_SIZE = 30;

/** Sends after which a recipient is abandoned. */
const MAX_ATTEMPTS = 3;

const SUBJECT = "Startathon 2026: your participation fee, due Aug 27";

interface RecipientRow {
  recipient_id: string;
  name: string | null;
  email: string;
  team_name: string;
  team_size: number;
  is_leader: number;
}

/**
 * Mails every member of every shortlisted team what the selection fee is, when
 * it is due, and where to pay it.
 *
 * The pool is startathon_teams.shortlist_status = 'shortlisted' — the column,
 * not the wrangler.jsonc list the results blast reads. The two agree today
 * (migration 0033 backfilled one from the other), but the column is what the
 * payment endpoint gates on, so billing and mailing stay driven by the same
 * fact. A team promoted off the waitlist is one UPDATE away from being mailed.
 *
 * Anyone whose ₹250 is already confirmed is excluded, so a member who pays
 * between two ticks is never asked for money they have handed over. That
 * matters more than it looks: leaders commonly pay for the whole team, which
 * confirms three or four people at once, and none of them should then receive
 * a bill.
 *
 * Leaders are mailed before members. The day's budget can run out mid-blast,
 * and if it does it should run out having reached one person on every team —
 * the person most likely to pay for the rest — rather than every person on
 * some teams.
 */
export async function notifyStartathonSelectionFee(env: Env): Promise<void> {
  if (!FEE_ACTIVE) {
    return;
  }

  const recipients = await fetchPending(env);

  if (recipients.length === 0) {
    return;
  }

  await sendBatch(env, recipients);
}

async function fetchPending(env: Env): Promise<RecipientRow[]> {
  // Retries sort in alongside first attempts rather than ahead of them, so a
  // few dead addresses cannot stall the rest of the list. Within a tier the
  // order is oldest team first, so a partially drained blast resumes where it
  // stopped.
  //
  // The NOT EXISTS is the do-not-bill-the-paid rule: a confirmed cover row
  // means this person's seat is settled, whether they paid it themselves or a
  // teammate did. A merely 'submitted' payment is not enough — the reference
  // is unverified, and if it never matches they still owe the money.
  const batch = await env.EVENTS_DB.prepare(
    `SELECT u.user_id AS recipient_id,
            u.name,
            u.email,
            t.team_name,
            (SELECT COUNT(*) FROM startathon_users m WHERE m.team_id = t.team_id) AS team_size,
            CASE WHEN u.user_id = t.leader_id THEN 1 ELSE 0 END AS is_leader
     FROM startathon_users u
     JOIN startathon_teams t ON t.team_id = u.team_id
     LEFT JOIN startathon_announcement_deliveries d
       ON d.announcement_id = ?1 AND d.user_id = u.user_id
     WHERE t.shortlist_status = 'shortlisted'
       AND (d.user_id IS NULL OR (d.status = 'failed' AND d.attempts < ?2))
       AND NOT EXISTS (
         SELECT 1
         FROM startathon_selection_payment_covers cv
         JOIN startathon_selection_payments p ON p.payment_id = cv.payment_id
         WHERE cv.user_id = u.user_id AND p.status = 'confirmed'
       )
     ORDER BY is_leader DESC, t.created_at ASC, u.created_at ASC
     LIMIT ?3`,
  )
    .bind(FEE_BLAST_ID, MAX_ATTEMPTS, BATCH_SIZE)
    .all<RecipientRow>();

  return batch.results ?? [];
}

async function sendBatch(env: Env, recipients: RecipientRow[]): Promise<void> {
  // Claim before sending and send only what was granted. On a spent day this
  // returns 0 and the batch is left untouched for tomorrow — no ledger rows are
  // written, so nobody is marked as attempted for mail that never left.
  const granted = await claimEmailBudget(env, recipients.length);

  if (granted === 0) {
    console.log(
      `Startathon selection fee: daily email budget spent, deferring ${recipients.length} recipient(s).`,
    );
    return;
  }

  const batch = recipients.slice(0, granted);

  console.log(
    `Startathon selection fee: notifying ${batch.length} recipient(s).`,
  );

  const emailService = new EmailService(env.BREVO_API_KEY);
  let spent = 0;

  for (const recipient of batch) {
    // Invite-created accounts start with a null name (migration 0021), and the
    // template splits on the first word of whatever it gets.
    const name = recipient.name ?? "";

    const html = getStartathonSelectionFeeEmail({
      name,
      teamName: recipient.team_name,
      teamSize: recipient.team_size,
      isLeader: recipient.is_leader === 1,
    });

    // One attempt per tick: an immediate retry against a provider that just
    // refused spends a second message from the same capped quota to hit the
    // same wall. The next tick retries, and MAX_ATTEMPTS bounds how long that
    // continues.
    const sent = await emailService.sendStartathonAnnouncementEmail(
      name,
      recipient.email,
      SUBJECT,
      html,
    );

    spent += 1;

    // Written per recipient, so a mid-batch crash loses at most the in-flight
    // send; recipients never reached simply have no row and are picked up on
    // the next tick.
    await env.EVENTS_DB.prepare(
      `INSERT INTO startathon_announcement_deliveries
         (announcement_id, user_id, status, attempts, updated_at)
       VALUES (?1, ?2, ?3, 1, ?4)
       ON CONFLICT(announcement_id, user_id) DO UPDATE SET
         status = excluded.status,
         attempts = attempts + 1,
         updated_at = excluded.updated_at`,
    )
      .bind(
        FEE_BLAST_ID,
        recipient.recipient_id,
        sent ? "sent" : "failed",
        Date.now(),
      )
      .run();

    if (!sent) {
      console.error(
        `Startathon selection fee: send failed for ${recipient.recipient_id} (${recipient.email}), will retry up to ${MAX_ATTEMPTS} attempts.`,
      );
    }

    // Same rate-limit courtesy the other blast jobs use.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Only reachable if the loop exits early in future edits; harmless today.
  await releaseEmailBudget(env, granted - spent);
}
