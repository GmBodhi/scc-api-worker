import { claimEmailBudget } from "./emailBudget";
import { EmailService } from "./emailService";

/**
 * Number of waitlisters emailed per cron tick. Deliberately small: this is a
 * marketing blast going out from hello@sctcoding.club, which also carries
 * transactional password-reset and payment-confirmation mail. Trickling the
 * send keeps the rate below anything receiving providers read as a bulk blast,
 * so a reputation hit here can't spill onto transactional delivery.
 *
 * This is the per-tick smoothing limit only. The day's hard ceiling is the
 * shared budget in emailBudget.ts, which this job draws from alongside the
 * announcement notifier -- the two together can never exceed it.
 */
const BATCH_SIZE = 10;

interface WaitlistRecipient {
  waitlist_id: string;
  name: string;
  email: string;
}

/**
 * Announces to the Startathon waitlist that registrations are open.
 *
 * Send state lives entirely on startathon_wl.status, which moves
 * 'waitlisted' -> 'registered' | 'notified' | 'notify_failed'. All three are
 * terminal, so once the list is drained this job costs two no-op queries per
 * tick and is safe to leave wired in permanently.
 */
export async function notifyStartathonWaitlist(env: Env): Promise<void> {
  // Pass 1: anyone who already self-served into a Startathon account is
  // excluded from the blast. Doing this as an UPDATE rather than folding it
  // into the send query means the table actually drains, converts stop being
  // re-evaluated every tick, and the count is persisted.
  //
  // startathon_users.email is always stored lowercased (signup, login, invite
  // and Google all normalize). startathon_wl.email is NOT — startathonWaitlist
  // binds raw user input. The LOWER() is what stops someone who typed a
  // capital letter on the waitlist form from being emailed despite having an
  // account, so it must not be dropped.
  const converted = await env.EVENTS_DB.prepare(
    `UPDATE startathon_wl
     SET status = 'registered'
     WHERE status = 'waitlisted'
       AND LOWER(email) IN (SELECT email FROM startathon_users)`,
  ).run();

  if (converted.meta.changes > 0) {
    console.log(
      `Startathon waitlist: ${converted.meta.changes} already registered, skipping.`,
    );
  }

  // Pass 2: drain a batch, oldest signups first.
  const batch = await env.EVENTS_DB.prepare(
    `SELECT waitlist_id, name, email FROM startathon_wl
     WHERE status = 'waitlisted'
     ORDER BY registered_at ASC
     LIMIT ?`,
  )
    .bind(BATCH_SIZE)
    .all<WaitlistRecipient>();

  if (!batch.results || batch.results.length === 0) {
    return;
  }

  // Claim before sending, and send only what the shared daily budget grants. On
  // a spent day this returns 0 and the batch is left untouched for tomorrow --
  // no status is written, so nobody is marked notified for mail that never
  // left. The inline retry below can spend one message beyond the claim for a
  // failing recipient; that overshoot is absorbed by the transactional reserve
  // the budget holds back.
  const granted = await claimEmailBudget(env, batch.results.length);

  if (granted === 0) {
    console.log(
      `Startathon waitlist: daily email budget spent, deferring ${batch.results.length} recipient(s).`,
    );
    return;
  }

  const recipients = batch.results.slice(0, granted);

  console.log(
    `Startathon waitlist: notifying ${recipients.length} recipient(s).`,
  );

  const emailService = new EmailService(env.BREVO_API_KEY);

  for (const recipient of recipients) {
    // One inline retry absorbs a transient Brevo blip without needing any
    // persisted attempt counter. sendEmail returns false rather than throwing.
    let sent = await emailService.sendStartathonRegistrationOpenEmail(
      recipient.name,
      recipient.email,
      recipient.waitlist_id,
    );

    if (!sent) {
      sent = await emailService.sendStartathonRegistrationOpenEmail(
        recipient.name,
        recipient.email,
        recipient.waitlist_id,
      );
    }

    // Written per recipient, so a mid-batch crash loses at most the in-flight
    // send; rows never reached simply stay 'waitlisted' for the next tick.
    await env.EVENTS_DB.prepare(
      "UPDATE startathon_wl SET status = ? WHERE waitlist_id = ?",
    )
      .bind(sent ? "notified" : "notify_failed", recipient.waitlist_id)
      .run();

    if (!sent) {
      console.error(
        `Startathon waitlist: send failed twice for ${recipient.waitlist_id} (${recipient.email}), marked notify_failed.`,
      );
    }

    // Same rate-limit courtesy the follow-up job uses.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
