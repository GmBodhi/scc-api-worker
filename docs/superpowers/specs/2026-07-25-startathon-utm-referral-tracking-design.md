# Startathon: UTM Referral Tracking — Design

**Date:** 2026-07-25
**Status:** Approved

## Overview

First-touch UTM attribution for Startathon signups, so campaigns run by the visibility partner (and any other marketing channel) can be measured end-to-end: visit → signup → team created → team paid. Analytics-only — it has no effect on fees, discounts, or the existing peer-to-peer team `referral_code`/`referred_by` system (`applyReferral.ts`), which is a separate mechanism and untouched by this work.

This is a cross-repo change:
- **Backend** (`scc-api-worker`, this repo): stores the UTM values, propagates them from user → team.
- **Frontend** (`Hacky`, `startathon.sctcoding.club`): captures UTM query params on first visit, persists them, sends them on account creation.

No new endpoint is added for reporting. Attribution data is queried directly from D1 (`wrangler d1 execute`) when needed.

## Attribution Model

- **First-touch only.** The UTM values captured on a visitor's *first* landing (with `utm_*` params present) are the ones that stick — never overwritten by a later visit, a later campaign click, or a login.
- **Captured once, at account creation.** The only write point is when a `startathon_users` row is created (email/password signup, or first-time Google sign-up-or-login). Returning/logging-in users never have their stored UTM values touched.
- **Propagated, not re-captured, at team creation.** When a user creates a team, the backend copies that user's own stored UTM values onto the new `startathon_teams` row. The frontend does not resend UTM data at this step.
- **Payment needs no new tracking.** A team's existing `status` (`payment-pending` → `confirmed`) combined with the team's UTM columns already answers "how many partner-X teams paid." `linkPayment.ts` is untouched.

## Frontend (`Hacky`)

Not implemented in this repo, but the contract this backend relies on:

- **Storage: `localStorage`**, not a real cookie — survives navigation (including the Google OAuth redirect round-trip) exactly like a cookie would, but matches the existing pattern (`src/lib/auth.js`'s `st_access_token` etc.) instead of introducing a new persistence mechanism.
- **Capture:** on app load, read `utm_source`/`utm_medium`/`utm_campaign`/`utm_term`/`utm_content` from the URL. Write to `localStorage` under one key (e.g. `st_utm`) **only if that key isn't already set** — first visit wins.
- **Send on account creation only:** `src/lib/startathon.js`'s three account-creation calls (`api.signup`, `api.googleCredential`, `api.googleCallback`) merge the stored `st_utm` object into their request — body fields for the first two (POST), query params for `googleCallback` (GET). `login` and other calls are untouched.

## Backend Data Model (EVENTS_DB)

```sql
-- Migration 0024: add UTM attribution columns
ALTER TABLE startathon_users ADD COLUMN utm_source TEXT;
ALTER TABLE startathon_users ADD COLUMN utm_medium TEXT;
ALTER TABLE startathon_users ADD COLUMN utm_campaign TEXT;
ALTER TABLE startathon_users ADD COLUMN utm_term TEXT;
ALTER TABLE startathon_users ADD COLUMN utm_content TEXT;

ALTER TABLE startathon_teams ADD COLUMN utm_source TEXT;
ALTER TABLE startathon_teams ADD COLUMN utm_medium TEXT;
ALTER TABLE startathon_teams ADD COLUMN utm_campaign TEXT;
ALTER TABLE startathon_teams ADD COLUMN utm_term TEXT;
ALTER TABLE startathon_teams ADD COLUMN utm_content TEXT;
```

All ten columns are nullable `TEXT`. Existing rows get `NULL` — no backfill.

## Types (`src/types.ts`)

A shared fragment, spread into the two request schemas that accept UTM data directly from the client:

```ts
const startathonUtmFields = {
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  utm_term: z.string().max(100).optional(),
  utm_content: z.string().max(100).optional(),
};

export const StartathonSignupRequest = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  phone: z.string().min(10).max(15),
  college: z.string().min(1).max(150),
  gender: z.enum(["male", "female", "other"]),
  ...startathonUtmFields,
});

export const StartathonGoogleCredentialRequest = z.object({
  credential: z.string().min(1, "Google credential is required"),
  ...startathonUtmFields,
});
```

`googleCallback.ts` is not schema-validated today (it reads `c.req.query()` directly, no `chanfana` request schema). It reads the same 5 keys off the query string manually and caps each at 100 chars before use — no Zod schema needed there, consistent with how it already handles `code`/`state`.

## Endpoint Changes

### `signup.ts`

Destructure `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` from `data.body` alongside the existing fields, and include them in the `INSERT INTO startathon_users` (all nullable — `undefined` fields bind as `null`).

### `src/utils/startathonGoogleUser.ts` (`findOrCreateStartathonGoogleUser`)

Shared by both `googleCallback.ts` and `googleCredential.ts`. Signature grows an optional 4th param:

```ts
export interface StartathonUtmData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export async function findOrCreateStartathonGoogleUser(
  db: D1Database,
  profile: StartathonGoogleProfile,
  utm?: StartathonUtmData,
)
```

The UTM columns are included **only in the first-time-user `INSERT` branch** (the block that currently builds `userId`/`now` and inserts a brand-new row). The two existing-user branches (matched by `google_id`, or linked by `email` on first Google login for an email/password account) never write to the UTM columns — a returning user's original first-touch attribution (or lack thereof, if they originally signed up before this feature existed) is never overwritten.

### `googleCallback.ts` / `googleCredential.ts`

Each extracts its 5 UTM values (from query string / validated body respectively) and passes them as the new `utm` argument to `findOrCreateStartathonGoogleUser`.

### `createTeam.ts`

`requireStartathonAuth`'s middleware does an explicit column-list `SELECT` (not `SELECT *`), so the leader's `utm_*` values aren't present on `authResult.user` — no code change to the middleware itself (it stays scoped to auth-relevant fields). Instead, the team `INSERT` becomes an `INSERT ... SELECT` that pulls the 5 UTM columns straight from the user row in the same statement, so the copy happens server-side with no extra round-trip and stays inside the existing `c.env.EVENTS_DB.batch([...])`:

```sql
INSERT INTO startathon_teams
  (team_id, team_name, leader_id, join_code, referral_code, status,
   utm_source, utm_medium, utm_campaign, utm_term, utm_content, created_at)
SELECT ?, ?, ?, ?, ?, 'payment-pending',
       utm_source, utm_medium, utm_campaign, utm_term, utm_content, ?
FROM startathon_users WHERE user_id = ?
```

### `linkPayment.ts`

No changes. Team `status` + the team's now-populated `utm_*` columns is sufficient to report paid-team attribution.

## Validation & Edge Cases

- All 5 fields are optional everywhere — most traffic has no UTM params (organic/direct/QR-code-with-no-params), and those rows simply get `NULL`.
- Values are stored as freeform text, not checked against an allow-list of known partners/campaigns — an allow-list would need maintenance every time a new partner or campaign launches, and this is analytics-only so bad/garbage values just show up as a low-volume "campaign" in the data, not a functional bug.
- Max length 100 chars per field — generous for any real UTM value, cheap guard against abuse.
- A user who signs up without UTM params and later creates a team: all 10 columns stay `NULL` throughout. No special-casing needed.

## Route Registration

No new routes. This only changes the request/response shape and D1 writes of existing endpoints:
- `POST /api/v3/events/startathon/auth/signup`
- `POST /api/v3/events/startathon/auth/google/credential`
- `GET /api/v3/events/startathon/auth/google/callback`
- `POST /api/v3/events/startathon/team`

## Out of Scope

- Any reporting/analytics endpoint — direct D1 queries are sufficient for now (per explicit decision; can be added later if needed).
- An allow-list or validation of partner/campaign names.
- Retroactively backfilling UTM data for existing users/teams.
- The frontend implementation itself (lives in the `Hacky` repo, not this one) — this spec documents the contract this backend relies on, but the actual `localStorage` capture/propagation code is out of scope for this repo's implementation plan.
