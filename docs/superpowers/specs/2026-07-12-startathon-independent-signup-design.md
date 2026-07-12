# Startathon: Independent Signup + Team Formation — Design

**Date:** 2026-07-12
**Status:** Approved
**Supersedes:** `docs/superpowers/specs/2026-07-11-startathon-registration-design.md` (the "leader registers whole team at once" model)

## Overview

The original Startathon design had the team leader register the entire team (1 leader + 2-3 members) in a single request, auto-creating accounts for every member. This design replaces that with an independent-signup model: any user can sign up (email/password or Google) with no team at all, then separately create a team, invite others by email, or join a team via a shareable join code. Team membership becomes optional and mutable (join, leave, kick) rather than fixed at registration time.

This is a full redesign of the Startathon module. Since `feature/startathon` was never pushed, merged, or deployed, the implementation plan replaces the old migrations/endpoints cleanly rather than layering changes on top.

The module remains standalone: own tables in `EVENTS_DB`, own JWT (`aud: "startathon"`), sharing only Google OAuth client credentials, `JWT_SECRET`, the Brevo `EmailService`, and the HDFC transaction parser.

## Data Model (EVENTS_DB)

```sql
CREATE TABLE startathon_teams (
  team_id         TEXT PRIMARY KEY,            -- ST_<timestamp>_<rand>
  team_name       TEXT NOT NULL UNIQUE,
  leader_id       TEXT NOT NULL,               -- startathon_users.user_id
  join_code       TEXT NOT NULL UNIQUE,        -- 8-char shareable code
  transaction_ref TEXT,
  status          TEXT NOT NULL DEFAULT 'payment-pending',  -- 'payment-pending' | 'confirmed'
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER
);

CREATE TABLE startathon_users (
  user_id       TEXT PRIMARY KEY,              -- STU_<timestamp>_<rand>
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  college       TEXT,
  password_hash TEXT,                          -- null for Google-only or not-yet-set-up accounts
  google_id     TEXT UNIQUE,
  team_id       TEXT REFERENCES startathon_teams(team_id),  -- NULL until joined
  role          TEXT CHECK (role IN ('leader','member')),   -- NULL until joined
  created_at    INTEGER NOT NULL,
  CHECK ((team_id IS NULL AND role IS NULL) OR (team_id IS NOT NULL AND role IS NOT NULL))
);

CREATE TABLE startathon_invites (
  invite_id     TEXT PRIMARY KEY,              -- INV_<timestamp>_<rand>
  team_id       TEXT NOT NULL REFERENCES startathon_teams(team_id),
  invited_email TEXT NOT NULL,
  invited_by    TEXT NOT NULL,                 -- leader's user_id
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'declined' | 'cancelled'
  created_at    INTEGER NOT NULL,
  responded_at  INTEGER
);

CREATE TABLE startathon_reset_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE startathon_transactions (
  id        TEXT PRIMARY KEY,
  vpa       TEXT NOT NULL,
  amount    REAL NOT NULL,
  date      TEXT NOT NULL,
  ref       TEXT NOT NULL UNIQUE,
  status    TEXT NOT NULL DEFAULT 'unused',    -- 'unused' | 'used'
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

Team size cap (1 leader + up to 3 members = 4 total) is enforced in application code via `COUNT(*) FROM startathon_users WHERE team_id = ?`, not a DB constraint. "One team per user" falls out of `team_id` being a single nullable column per user row — no separate uniqueness mechanism needed.

## Endpoints

All routes under `/api/v3/events/startathon/`.

### Auth & Signup

- **`POST /auth/signup`** — public. `{name, email, password, phone, college}` → creates an account with `team_id`/`role` NULL, returns a JWT immediately (no email verification). 409 if the email is already registered.
- **`POST /auth/login`** — unchanged: email + password → JWT. Works for teamless users too. Same generic "Invalid credentials" for unknown email / no `password_hash` / wrong password.
- **`GET /auth/google`** — unchanged: builds the Google consent URL (using `GOOGLE_REDIRECT_URI_STARTATHON`).
- **`GET /auth/google/callback`** — **changed from the original design**: now creates a new account on first login (matching by `google_id`, then falling back to `email` and linking `google_id` onto that row — including pre-created teamless accounts from invites). Never returns 403 for an unknown email anymore; it signs them up.
- **`POST /auth/password/reset`** / **`POST /auth/password/reset/verify`** — unchanged shape from the original design (15-minute token, single-use, deletes on success). Doubles as the "set your first password" flow for invite-created accounts (7-day token from the invite email).

### Team

- **`POST /team`** — auth required. `{team_name}`. Caller must have no team (409 otherwise). Creates the team, generates a unique `join_code`, makes caller the leader.
- **`GET /team`** — auth required. 404 "You don't have a team yet" if `team_id` is NULL. Otherwise returns team (`team_id`, `team_name`, `status`, `transaction_ref`, `join_code`, `created_at`) + members (leader first, then alphabetical) + caller's role. `join_code` is visible to every member, not just the leader, so anyone on the team can share it.
- **`POST /team/invite`** — auth required, leader only (403 otherwise). `{email, name?}`.
  - Team must have room (< 4 total members), else 400.
  - If no account exists for that email: `name` is required in the request (400 "name required for new invitee" if missing); create the account now (`team_id`/`role` still NULL — not a member yet; `phone`/`college` left blank, settable later at password-setup time is out of scope — same as the original design, these were always optional).
  - If an account exists: `name` is ignored if provided; the account must have no team (409) and no existing pending invite to this team (409).
  - Creates a pending `startathon_invites` row.
  - Sends an email (non-fatal): **"account setup + invite"** template if the account was just created (set-password link, mentions Google sign-in as an alternative, mentions the invite), or **"invite received"** template if the account already existed (log in and check `/invites`).
- **`POST /team/join`** — auth required. `{join_code}`. Caller must have no team (409 otherwise). Code must resolve to a team with room (404 bad code, 400 team full). Joins immediately — no accept step, since entering the code is itself the consent action.
- **`POST /team/leave`** — auth required. Caller must be on a team; team must still be `payment-pending` (409 "Team is confirmed, roster is locked" otherwise).
  - If caller is a **member**: clears their own `team_id`/`role`.
  - If caller is the **leader**: deletes the team entirely — clears `team_id`/`role` for every member on it, and cancels (`status = 'cancelled'`) any pending invites tied to that `team_id`.
- **`POST /team/members/:user_id/kick`** — auth required, leader only (403 otherwise). Team must still be `payment-pending` (409 if confirmed). Target must be a member of the caller's own team (404 otherwise; a leader cannot kick themselves through this endpoint — use `/team/leave`). Clears the target's `team_id`/`role`.

### Invites

- **`GET /invites`** — auth required. Lists the caller's own pending invites (matched by their email): `invite_id`, `team_name`, `invited_by` (name), `created_at`.
- **`POST /invites/:id/accept`** — auth required; invite must be addressed to the caller's email and still `pending`. Caller must have no team (409 guard). Joins the team as a member, marks this invite `accepted`, and auto-cancels the caller's other pending invites (`status = 'cancelled'`) so they don't have dangling invites to teams they're no longer eligible for.
- **`POST /invites/:id/decline`** — auth required, same ownership check. Marks the invite `declined`.

### Payment (unchanged from the original design)

- **`POST /transaction`** — webhook ingest, `Authorization: <TOKEN>` shared-secret guard, accepts only ₹100, stores as `unused`.
- **`POST /payment`** — auth required, leader only (403 otherwise). `{transaction_id}`. Payment allowed at any team size/composition (no "team must be full" gate). Race-guarded: the transaction UPDATE re-asserts `status = 'unused'` in its WHERE clause and checks `meta.changes === 1` before confirming the team, exactly as hardened in the original implementation. On success: transaction → `used`, team → `confirmed`, `transaction_ref` stored, confirmation email to all members.

## Emails (Brevo, via existing `EmailService`)

1. **Account-setup + invite** (new template) — sent when `/team/invite` creates a brand-new account. Set-password link (7-day token) plus a note that Google sign-in with the same email works too, plus the invite context (team name, inviter).
2. **Invite received** (new template) — sent when `/team/invite` targets an existing account. Points them to log in and check `/invites`.
3. **Password reset** (existing template, kept as-is) — forgot-password flow; also reusable if an invitee needs their set-password link resent.
4. **Payment confirmation** (existing template, kept as-is) — sent to all team members on `/payment`.

No emails on signup, join-by-code, leave, or kick — the API response is sufficient.

Dropped from the original design: the old "account setup" template tied to all-at-once registration (replaced by the invite-flavored version above).

## Replacing the Old Branch

`feature/startathon`'s existing work is local-only (never pushed, merged, or deployed), so the implementation plan replaces it cleanly rather than migrating:

- Delete and rewrite migrations 0015–0018 (same numbering, new schema: nullable `team_id`/`role` on users, `join_code` on teams, new `startathon_invites` table).
- Delete `register.ts` (replaced by `signup.ts` + `createTeam.ts`).
- Rewrite `googleCallback.ts` (now creates accounts instead of 403-ing unknown emails).
- Rewrite `getTeam.ts` (handle NULL team gracefully).
- Keep largely as-is: `login.ts`, `passwordResetRequest.ts`, `passwordResetVerify.ts`, `googleInitiate.ts`, `transactionIngest.ts`, `linkPayment.ts` (all already reference the right tables/columns and don't assume a fixed team size).
- Add: `signup.ts`, `createTeam.ts`, `inviteMember.ts`, `joinTeam.ts`, `listInvites.ts`, `acceptInvite.ts`, `declineInvite.ts`, `leaveTeam.ts`, `kickMember.ts`.
- `startathonJwt.ts` / `startathonAuth.ts` (JWT + middleware) are untouched — nullable `team_id` doesn't affect them.
- `EmailService`: drop `sendStartathonAccountSetupEmail` (old registration-flavored version), add `sendStartathonAccountSetupInviteEmail` and `sendStartathonInviteReceivedEmail`.

## Error Handling Summary

- 400 — team full (invite/join), bad join code resolving to a full team, malformed payloads, expired/invalid reset tokens, TOCTOU loss on payment linking.
- 401 — missing/invalid/wrong-audience token.
- 403 — non-leader calling leader-only endpoints (invite, kick, payment); invite/decline/accept not addressed to caller's email.
- 404 — no team yet (`GET /team`), bad join code, kick target not on caller's team.
- 409 — email already registered (signup), team_name taken (create team), caller already on a team (create/join/accept), invitee already on a team or already invited to this team (invite), leave/kick attempted on a confirmed team.
- 500 — unexpected errors, generic message, details logged.

## Out of Scope

- Leadership transfer (a leader can only leave by deleting the team).
- Refunds, team renaming, editing a member's own profile fields post-signup.
- Notification emails for join/leave/kick.
- Email verification at signup.
- Rate limiting on invite/join spam (acceptable risk for an event-scoped tool).
