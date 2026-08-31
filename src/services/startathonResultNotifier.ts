import { getStartathonApplicationAcceptedEmail } from "../templates/startathon-application-accepted";
import { getStartathonApplicationRejectedEmail } from "../templates/startathon-application-rejected";
import { getStartathonApplicationWaitlistedEmail } from "../templates/startathon-application-waitlisted";
import { claimEmailBudget, releaseEmailBudget } from "./emailBudget";
import { EmailService } from "./emailService";

/**
 * Slug written into startathon_announcement_deliveries.announcement_id.
 *
 * The results blast reuses the announcement ledger rather than owning a table:
 * it needs exactly what that table provides (one row per user per blast, a
 * composite primary key that makes a second send impossible, and a retry
 * counter), and a distinct id keeps it from colliding with anything in
 * src/announcements/. Never rename it after the first send -- the ledger is
 * keyed on it, so a changed id makes every past recipient look unsent.
 */
const RESULT_BLAST_ID = "2026-08-17-shortlisting-result";

/**
 * The send trigger. Deploying with this true is what starts the blast, exactly
 * as `active` does for an announcement.
 *
 * Left false on purpose: this is the one blast that cannot be taken back, it
 * tells roughly a hundred people they did not make a shortlist, and both lists
 * it depends on are hand-entered ids in wrangler.jsonc. Flip it only once those
 * have been eyeballed against the real decision.
 */
const RESULTS_ACTIVE = true;

/**
 * Most recipients attempted per cron tick. Same smoothing rationale as the
 * announcement notifier: the day's real ceiling is the shared email budget,
 * and this only decides how much of the day the sends spread over.
 */
const BATCH_SIZE = 30;

/** Sends after which a recipient is abandoned. */
const MAX_ATTEMPTS = 3;

/**
 * Which of the three result emails a team gets. Computed in SQL from the two id
 * lists so that it can also drive the send order, and carried on the row rather
 * than re-derived per recipient.
 */
type Outcome = "accepted" | "waitlisted" | "rejected";

const COPY: Record<
  Outcome,
  {
    subject: string;
    render: (data: { name: string; teamName: string }) => string;
  }
> = {
  accepted: {
    subject: "Startathon 2026: your team is shortlisted",
    render: getStartathonApplicationAcceptedEmail,
  },
  waitlisted: {
    subject: "Startathon 2026: your team is on the waitlist",
    render: getStartathonApplicationWaitlistedEmail,
  },
  rejected: {
    subject: "Startathon 2026: shortlisting result",
    render: getStartathonApplicationRejectedEmail,
  },
};

interface RecipientRow {
  recipient_id: string;
  name: string | null;
  email: string;
  team_id: string;
  team_name: string;
  outcome: Outcome;
}

/**
 * Mails every member of every team that submitted an application, with the copy
 * their team's outcome calls for: shortlisted, waitlisted or neither.
 *
 * "Rejected" means submitted and on neither list. Teams with no application row
 * never entered and are not in the pool at all, so nobody is told they lost
 * something they never applied for.
 *
 * Send order is by tier, not by signup date:
 *
 *   1. leaders of shortlisted teams
 *   2. leaders of waitlisted teams
 *   3. leaders of rejected teams
 *   4. everyone else on a rejected team
 *   5. everyone else on a waitlisted team
 *   6. everyone else on a shortlisted team
 *
 * Leaders first because they are the ones their team will ask, and because the
 * day's budget can run out mid-blast -- if it does, it should run out having
 * reached one person on every team rather than every person on some teams.
 * Members follow in the reverse order: a shortlisted or waitlisted member is
 * least at risk of hearing nothing, because their leader already knows and is
 * the one who has to act on it.
 */
export async function notifyStartathonResults(env: Env): Promise<void> {
  if (!RESULTS_ACTIVE) {
    return;
  }

  const shortlist = parseTeamIds(env.STARTATHON_SHORTLISTED_TEAM_IDS);
  const waitlist = parseTeamIds(env.STARTATHON_WAITLISTED_TEAM_IDS);

  // Fail closed. An unset, empty or unparseable list would otherwise make every
  // team on it look rejected, and there is no unsending that. The waitlist is
  // held to the same rule rather than treated as optional: an empty one is
  // indistinguishable from a var that failed to parse.
  if (shortlist.length === 0 || waitlist.length === 0) {
    console.error(
      "Startathon results: shortlist or waitlist is empty or unset, refusing to send.",
    );
    return;
  }

  if (!(await listsAreValid(env, shortlist, waitlist))) {
    return;
  }

  const recipients = await fetchPending(env, shortlist, waitlist);

  if (recipients.length === 0) {
    return;
  }

  await sendBatch(env, recipients);
}

/**
 * Accepts either a JSON array of ids (the wrangler.jsonc shape) or a single
 * string of ids separated by commas or whitespace, because a var edited by hand
 * in the Cloudflare dashboard arrives as the latter.
 */
function parseTeamIds(raw: unknown): string[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\s,]+/)
      : [];

  return values
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
}

/**
 * Refuses to send unless both lists are internally sane: every id is a real
 * team that actually submitted an application, and no team appears on both.
 *
 * A typo is otherwise invisible and asymmetric -- the mistyped team silently
 * receives the rejection and nothing about the run looks wrong. A team on both
 * lists is worse: which email it gets would depend on evaluation order, so it
 * is treated as a list that has not been finalised rather than resolved by
 * precedence.
 */
async function listsAreValid(
  env: Env,
  shortlist: string[],
  waitlist: string[],
): Promise<boolean> {
  const overlap = shortlist.filter((teamId) => waitlist.includes(teamId));

  if (overlap.length > 0) {
    console.error(
      `Startathon results: ${overlap.length} team(s) on both the shortlist and the waitlist, refusing to send: ${overlap.join(", ")}`,
    );
    return false;
  }

  const all = [...shortlist, ...waitlist];
  const placeholders = all.map(() => "?").join(",");

  const found = await env.EVENTS_DB.prepare(
    `SELECT a.team_id
     FROM startathon_applications a
     WHERE a.team_id IN (${placeholders})`,
  )
    .bind(...all)
    .all<{ team_id: string }>();

  const known = new Set((found.results ?? []).map((row) => row.team_id));
  const missing = all.filter((teamId) => !known.has(teamId));

  if (missing.length > 0) {
    console.error(
      `Startathon results: ${missing.length} listed id(s) have no application row, refusing to send: ${missing.join(", ")}`,
    );
    return false;
  }

  return true;
}

async function fetchPending(
  env: Env,
  shortlist: string[],
  waitlist: string[],
): Promise<RecipientRow[]> {
  // Numbered placeholders from ?4 on, so each list can be referenced several
  // times in the statement while being bound once. Mixing numbered and
  // anonymous parameters in one statement is exactly the kind of thing that
  // works until it doesn't, so every parameter here is numbered.
  const shortPlaceholders = shortlist
    .map((_, index) => `?${index + 4}`)
    .join(",");
  const waitPlaceholders = waitlist
    .map((_, index) => `?${index + 4 + shortlist.length}`)
    .join(",");

  // Ordered by tier, then oldest team first inside a tier, so a partially
  // drained blast resumes where it stopped and the order stays stable across
  // ticks. Retries sort in alongside first attempts rather than ahead of them,
  // so a few dead addresses cannot stall the rest of the list.
  //
  // The join to startathon_applications is what defines the pool: a team that
  // never submitted has no row and therefore no members here.
  const batch = await env.EVENTS_DB.prepare(
    `SELECT u.user_id AS recipient_id,
            u.name,
            u.email,
            t.team_id,
            t.team_name,
            CASE
              WHEN t.team_id IN (${shortPlaceholders}) THEN 'accepted'
              WHEN t.team_id IN (${waitPlaceholders}) THEN 'waitlisted'
              ELSE 'rejected'
            END AS outcome
     FROM startathon_users u
     JOIN startathon_teams t ON t.team_id = u.team_id
     JOIN startathon_applications a ON a.team_id = t.team_id
     LEFT JOIN startathon_announcement_deliveries d
       ON d.announcement_id = ?1 AND d.user_id = u.user_id
     WHERE (d.user_id IS NULL
            OR (d.status = 'failed' AND d.attempts < ?2))
     ORDER BY CASE
                WHEN u.user_id = t.leader_id
                     AND t.team_id IN (${shortPlaceholders}) THEN 1
                WHEN u.user_id = t.leader_id
                     AND t.team_id IN (${waitPlaceholders}) THEN 2
                WHEN u.user_id = t.leader_id THEN 3
                WHEN t.team_id IN (${shortPlaceholders}) THEN 6
                WHEN t.team_id IN (${waitPlaceholders}) THEN 5
                ELSE 4
              END ASC,
              t.created_at ASC,
              u.created_at ASC
     LIMIT ?3`,
  )
    .bind(
      RESULT_BLAST_ID,
      MAX_ATTEMPTS,
      BATCH_SIZE,
      ...shortlist,
      ...waitlist,
    )
    .all<RecipientRow>();

  return batch.results ?? [];
}

async function sendBatch(env: Env, recipients: RecipientRow[]): Promise<void> {
  // Claim before sending, and send only what was granted. On a spent day this
  // returns 0 and the batch is left entirely untouched for tomorrow -- no rows
  // are written, so nobody is marked as attempted for mail that never left.
  const granted = await claimEmailBudget(env, recipients.length);

  if (granted === 0) {
    console.log(
      `Startathon results: daily email budget spent, deferring ${recipients.length} recipient(s).`,
    );
    return;
  }

  const batch = recipients.slice(0, granted);

  console.log(`Startathon results: notifying ${batch.length} recipient(s).`);

  const emailService = new EmailService(env.BREVO_API_KEY);
  let spent = 0;

  for (const recipient of batch) {
    // Accounts created by an invite start with a null name (migration 0021),
    // and the templates split on the first word of whatever they get.
    const name = recipient.name ?? "";

    // Falls back to the rejected copy only if the CASE above ever produced
    // something unexpected, which it cannot today -- the three branches are
    // exhaustive. It is here so an unrecognised value can never mean "no
    // subject and no body".
    const copy = COPY[recipient.outcome] ?? COPY.rejected;
    const html = copy.render({ name, teamName: recipient.team_name });

    // Deliberately a single attempt per tick: an immediate retry against a
    // provider that just refused would spend a second message from the same
    // capped quota to hit the same wall. The next tick retries instead, and
    // MAX_ATTEMPTS bounds how long that continues.
    const sent = await emailService.sendStartathonAnnouncementEmail(
      name,
      recipient.email,
      copy.subject,
      html,
    );

    spent += 1;

    // Written per recipient, so a mid-batch crash loses at most the in-flight
    // send; recipients never reached simply have no row and are picked up next
    // tick.
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
        RESULT_BLAST_ID,
        recipient.recipient_id,
        sent ? "sent" : "failed",
        Date.now(),
      )
      .run();

    if (!sent) {
      console.error(
        `Startathon results: send failed for ${recipient.recipient_id} (${recipient.email}), will retry up to ${MAX_ATTEMPTS} attempts.`,
      );
    }

    // Same rate-limit courtesy the other blast jobs use.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Only reachable if the loop exits early in future edits; harmless today.
  await releaseEmailBudget(env, granted - spent);
}
