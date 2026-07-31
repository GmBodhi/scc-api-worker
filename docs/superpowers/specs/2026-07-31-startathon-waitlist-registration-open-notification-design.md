# Startathon: Waitlist "Registrations Are Open" Notification — Design

**Date:** 2026-07-31
**Status:** Draft — awaiting review
**Builds on:** `docs/superpowers/specs/2026-07-11-startathon-registration-design.md`

## Overview

Registrations for Startathon 2026 are already open. Everyone sitting in `startathon_wl` was promised exactly one email when that happened ("We'll email you the moment registrations open. No spam. Just one email when we're ready."). This feature delivers on that promise.

The existing 30-minute cron drains the waitlist in batches of 10, sending a lime-on-black "registrations are open" email to each person who is still waiting. Anyone who already created a Startathon account is silently skipped — they've self-served, and re-marketing to them is noise.

**No new tables and no migrations.** Send state rides on the existing `startathon_wl.status` column; open/click analytics ride on the existing `email_events` table and its two tracking endpoints.

## Data Model (EVENTS_DB)

No schema changes. Two existing tables carry the feature.

### `startathon_wl.status` — the send-state machine

The column already exists with default `'waitlisted'`. It gains three new values, all terminal:

| Status | Meaning |
| --- | --- |
| `waitlisted` | Not yet notified. The existing default and the only non-terminal state; nothing to backfill. |
| `registered` | Skipped — this person already has a `startathon_users` account. Never emailed. |
| `notified` | Blast email sent successfully. |
| `notify_failed` | Brevo rejected the send twice in one tick. Terminal; no automatic retry. |

`registered` doubles as a free waitlist→signup conversion count.

### `email_events` — unchanged

Opens and clicks continue to flow through the existing `GET /events/email/open?id=` and `GET /events/email/click?id=&url=` endpoints, keyed on `waitlist_id`. No `campaign` column is added. The two Startathon emails that write to this table are separable after the fact:

- **Opens** — split by time. Confirmation opens cluster right after each person's own `registered_at`; every blast open necessarily occurs after this feature is deployed, which is after the last waitlister signed up.
- **Clicks** — split by `url`. The blast is the only Startathon email that links to the signup URL; the confirmation email only ever linked Instagram and LinkedIn.

**Accepted limitation:** this attribution is inferential, not recorded. If a third campaign ever writes to `email_events` for the same `waitlist_id`, the time-split for opens stops being reliable and a `campaign` column becomes necessary. That is out of scope here.

## The email-case trap

`startathon_users.email` is **always** stored lowercased — `signup.ts:78`, `login.ts:68`, `passwordResetRequest.ts:50`, `inviteMember.ts:114`, and `startathonGoogleUser.ts:26` all normalize before touching the table.

`startathon_wl.email` is **not** normalized. `startathonWaitlist.ts:86` binds the raw user input straight into the insert.

Therefore every cross-table comparison in this feature must be `LOWER(wl.email)`, never `wl.email`. A naive equality join would fail to match exactly the people who typed a capital letter into the waitlist form — and the failure mode is the bad one: they already have an account and would get the email anyway.

The waitlist table is deliberately **not** backfilled to lowercase. `startathon_wl.email` carries a `UNIQUE` constraint, and lowercasing in bulk could collide two existing rows and abort the migration. `LOWER()` at query time is sufficient and carries no such risk.

## Notifier

New module: `src/services/startathonWaitlistNotifier.ts`, exporting a single `notifyStartathonWaitlist(env: Env): Promise<void>`. Called from `handleScheduled` in `src/scheduledWorker.ts`, after the existing follow-up email job, wrapped so a throw cannot take down the follow-up job (and vice versa).

There is no date gate. Registrations are already open, so the job starts draining on the first cron tick after deploy.

### Pass 1 — mark conversions

One statement per tick:

```sql
UPDATE startathon_wl
SET status = 'registered'
WHERE status = 'waitlisted'
  AND LOWER(email) IN (SELECT email FROM startathon_users)
```

Running the exclusion as an `UPDATE` rather than folding it into the send query's `WHERE` clause is deliberate:

- the table actually drains, so converts stop being re-evaluated every 30 minutes forever
- the conversion count is persisted rather than recomputed
- anyone who signs up *between* ticks is excluded before the next batch goes out

### Pass 2 — drain a batch of 10

```sql
SELECT waitlist_id, name, email FROM startathon_wl
WHERE status = 'waitlisted'
ORDER BY registered_at ASC
LIMIT 10
```

Sends are sequential — Brevo takes one recipient per call, so each send is one subrequest. Oldest waitlisters go first.

**Throughput: 10 per tick × 48 ticks/day = 480 emails/day.** The waitlist is roughly 100 people, so the blast completes in about 10 ticks — around 5 hours — and the tail waits well under a day.

The batch size is deliberately small relative to what the runtime could handle. Trickling ~10 messages per half hour from `hello@sctcoding.club` keeps the send rate far below anything that reads as a bulk blast to receiving mail providers, which protects the domain's sending reputation — the same domain carries transactional password-reset and payment-confirmation mail, so a spam-folder reputation hit would have consequences well beyond this campaign.

If the list is ever materially larger than ~100, raise `BATCH_SIZE` rather than the cron frequency: the cron also drives the unrelated follow-up email job, and making it fire more often changes that job's behavior too.

### Per-recipient outcome

`EmailService.sendStartathonRegistrationOpenEmail()` returns a boolean; it does not throw on a Brevo error.

- **Success** → `UPDATE startathon_wl SET status = 'notified' WHERE waitlist_id = ?`
- **Failure** → retry once inline, immediately, within the same tick. This absorbs a transient Brevo blip without any persisted retry state.
- **Failure twice** → `UPDATE startathon_wl SET status = 'notify_failed' WHERE waitlist_id = ?`, and log the `waitlist_id` and email.

`notify_failed` is terminal. Nothing re-queues it automatically, which is what removes the need for an attempts counter, a time bound, or any new column. Failed rows are visible in the DB and a single `UPDATE ... SET status='waitlisted' WHERE status='notify_failed'` re-queues them by hand if desired.

A row is written per recipient before moving to the next, so a mid-batch crash or CPU-limit kill loses at most the in-flight send. Rows never reached simply stay `waitlisted` and are picked up on the next tick.

### Steady state

Once every row is `notified`, `registered`, or `notify_failed`, the job costs two cheap queries per tick: an `UPDATE` matching nothing and a `SELECT` returning nothing. It is safe to leave wired in permanently.

## Email Template

New file: `src/templates/startathon-registration-open.ts`, exporting `getStartathonRegistrationOpenEmail({ name, waitlistId })`.

Reuses the design system established by `src/templates/startathon-waitlist-confirmation.ts` — that file is the fully-developed reference; the other Startathon templates are stripped-down variants of it.

**Design tokens (matched exactly):**

- Page `#000000`; card `#0a0a0a`, `max-width:580px`, `border-radius:14px`, `border:1px solid rgba(255,255,255,0.08)`
- Lime `#C8FF00` as the sole accent; lime gradient hairline across the card top
- Eyebrows: `font-size:9px; letter-spacing:0.24em; text-transform:uppercase`
- Headline: `38px / 900 / line-height:0.92 / letter-spacing:-0.03em`, white
- Body copy: `13px`, `rgba(255,255,255,0.42)`, `line-height:1.8`
- Dividers: `1px` at `rgba(255,255,255,0.07)`
- System font stack, table-based layout, inline styles only

**Structure:**

1. Preheader — hidden, one line
2. Header row — `Startathon.` wordmark + lime `◆ Kerala 2026` pill
3. Hero — eyebrow `REGISTRATIONS ARE OPEN`, headline `Go build.`, one-line body
4. **Solid lime CTA button** — `#C8FF00` background, black text. This is the one element the confirmation email deliberately lacked, and it is the point of this email. Points at the signup URL with UTM params, wrapped in `trackLink()`.
5. Stat pill row — `30 HRS` / `20 TEAMS` / `₹2L+`, reusing the existing chip component
6. `HOW TO ENTER` — three lime-check steps: create your account → form your team → pay ₹100 and lock the slot
7. Scarcity line — 20 teams, decided on payment
8. Repeat CTA
9. Tracked Instagram / LinkedIn buttons, footer, reworded unsubscribe line
10. 1×1 tracking pixel

**Copy constraint:** the template asserts only facts already present in the codebase — 30 hours, 20 teams, ₹2L+ prize pool (all from `startathon-waitlist-confirmation.ts`), and the ₹100 fee (`STARTATHON_TEAM_FEE`, `src/types.ts:692`). Event dates, team size limits, and the registration deadline are not recorded anywhere in the repo and are therefore **omitted rather than invented**. The email works without them.

**Tracking:** identical mechanism to the confirmation email — `trackLink(waitlistId, destination)` wrapping every outbound link, and a pixel at `${BASE_URL}/events/email/open?id=${waitlistId}`.

## Email Service

New method on `EmailService` (`src/services/emailService.ts`), following the existing Startathon methods:

```ts
async sendStartathonRegistrationOpenEmail(
  name: string,
  email: string,
  waitlistId: string,
): Promise<boolean>
```

Subject: `Registrations are open. — Startathon 2026`

Matches the voice of the existing `You're on the list. — Startathon 2026`. Sender is unchanged (`SCT Coding Club <hello@sctcoding.club>`).

## Error Handling

- The notifier never throws out of `handleScheduled`. It is wrapped so a failure cannot prevent the pre-existing follow-up email job from running.
- Brevo failures are per-recipient and non-fatal; they mark one row `notify_failed` and the batch continues.
- A D1 failure on pass 1 aborts the tick and is logged. The next tick retries from scratch; both passes are idempotent.
- `sendEmail` already swallows and logs Brevo errors and returns `false`, so no new error plumbing is required.

## Testing

- **Template render** — call `getStartathonRegistrationOpenEmail()` with fixture data; assert the output contains the tracking pixel URL, the signup CTA with UTM params, and the escaped recipient name; assert every `href` is wrapped in `trackLink`.
- **Conversion pass** — seed a `startathon_wl` row whose email differs only in case from a `startathon_users` row; assert it becomes `registered`. This is the regression test for the `LOWER()` trap.
- **Batch limit** — seed 25 waitlisted rows; assert one tick sends exactly 10 and the remaining 15 stay `waitlisted`.
- **Idempotency** — run three ticks over a 25-row fixture; assert every row is emailed exactly once and the third tick sends nothing.
- **Failure path** — stub the send to return `false` twice; assert the row lands on `notify_failed` and the rest of the batch still sends.
- **Steady state** — run a tick with nothing waitlisted; assert zero sends and no error.

## Out of Scope

- A `campaign` column on `email_events` (attribution stays inferential, per above)
- An admin-triggered or preview endpoint — the cron is the only trigger
- Backfilling `startathon_wl.email` to lowercase
- Any change to the existing waitlist signup, confirmation email, or tracking endpoints
- Unsubscribe handling beyond the existing footer text
