# Startathon Registration Module — Design

**Date:** 2026-07-11
**Status:** Approved

## Overview

A self-contained registration, auth, and payment module for the Startathon event, served by this worker under `/api/v3/events/startathon/*` and consumed by a new client at `startathon.sctcoding.club`. The module is **independent of existing logic**: it has its own user records, auth flow, password reset, and transactions table. The only shared pieces are infrastructure: the Google OAuth client credentials, `JWT_SECRET`, the Brevo `EmailService`, the HDFC transaction parser, the webhook `TOKEN`, and the `EVENTS_DB` D1 binding.

## Data Model (EVENTS_DB)

Teams have exactly one leader and 2–3 members (3–4 people total). Every startathon user row belongs to a team (`team_id NOT NULL`) — there is no such thing as a startathon account without a team. One team per email.

```sql
-- migration: create_startathon_teams_table
CREATE TABLE startathon_teams (
  team_id         TEXT PRIMARY KEY,            -- ST_<timestamp>_<rand>
  team_name       TEXT NOT NULL UNIQUE,
  leader_id       TEXT NOT NULL,               -- startathon_users.user_id
  transaction_ref TEXT,                        -- UPI ref once paid
  status          TEXT NOT NULL DEFAULT 'payment-pending',  -- 'payment-pending' | 'confirmed'
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER
);

-- migration: create_startathon_users_table
CREATE TABLE startathon_users (
  user_id       TEXT PRIMARY KEY,              -- STU_<timestamp>_<rand>
  team_id       TEXT NOT NULL REFERENCES startathon_teams(team_id),
  role          TEXT NOT NULL CHECK (role IN ('leader','member')),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  college       TEXT,
  password_hash TEXT,                          -- null until user sets a password
  google_id     TEXT UNIQUE,                   -- linked on first Google login (email match)
  created_at    INTEGER NOT NULL
);

-- migration: create_startathon_reset_tokens_table
CREATE TABLE startathon_reset_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- migration: create_startathon_transactions_table
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

## Endpoints

All routes live in `src/endpoints/v3/events/startathon/` and are registered in `src/endpoints/v3/index.ts` under `/api/v3/events/startathon/...`.

### 1. `POST /register` — public, no auth

Body: `team_name`, `leader: {name, email, phone, college}`, `members: [{name, email, phone?, college?}]` (exactly 2–3 members).

Flow:
1. Validate member count (2–3) and that all emails in the payload are distinct.
2. Reject (409) if `team_name` is taken or any email already exists in `startathon_users`.
3. Insert team (status `payment-pending`) + leader row + member rows in one `D1 batch()` so failure cannot leave a partial team.
4. Send every user (leader + members) a "team registered — set your password" email with a set-password link to `startathon.sctcoding.club` (non-fatal).
5. Return `team_id`, `team_name`, participants, and status.

### 2. `POST /auth/login`

Email + password against `startathon_users.password_hash`. Returns a single startathon JWT (signed with `JWT_SECRET`, `aud: "startathon"`, 7-day expiry — no refresh tokens, since the existing `refresh_tokens` table is GENERAL_DB logic this module stays independent of). Tokens without `aud: "startathon"` are rejected by the startathon auth middleware, and startathon tokens are useless on main-site endpoints.

### 3. `GET /auth/google` and `GET /auth/google/callback`

Same Google client (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`), new env var `GOOGLE_REDIRECT_URI_STARTATHON = https://startathon.sctcoding.club/auth/google/callback` (URI must also be added in Google Cloud Console).

Callback: exchange code → fetch Google profile → match `startathon_users` by `google_id`, then by `email` (linking `google_id` on first login). **No account creation** — unknown emails get 403 "not registered for Startathon". On success, issue startathon JWT as in login.

### 4. `POST /auth/password/reset` and `POST /auth/password/verify`

Mirrors the existing reset pair but against `startathon_users` / `startathon_reset_tokens`. Request always returns success (no email enumeration); token valid 15 minutes; verify sets `password_hash`. Doubles as the first-time password setup for accounts created at registration.

### 5. `GET /team` — startathon auth required

Returns the caller's team: `team_id`, `team_name`, status, `transaction_ref`, all members (name, email, role), and the caller's role. Drives the subdomain dashboard for both leaders and members.

### 6. `POST /transaction` — webhook ingest

Guarded by `Authorization == env.TOKEN` (same header as existing ingest). Parses raw bank SMS with `parseTransactionHDFC`, accepts only `amount === 100` (flat fee per team), inserts into `startathon_transactions` as `unused`.

### 7. `POST /payment` — startathon auth, leader only

Body: `transaction_id` (UPI ref). Flow: caller must be their team's leader → team must be `payment-pending` → ref must exist in `startathon_transactions` with status `unused` → mark transaction `used`, set team `transaction_ref` + status `confirmed`, send payment-confirmation email to all members (non-fatal).

## Auth Middleware

New `requireStartathonAuth(c)` in `src/middleware/` (or alongside the module): verifies JWT signature, checks `aud === "startathon"`, loads the user from `startathon_users`. Existing `requireAuth` is untouched.

## Emails

Three new templates in `src/templates/`, sent through the existing Brevo `EmailService` (new methods on the service). All sends are non-fatal — failures are logged, never fail the request.

1. **Team registered / set your password** — to all participants; includes team name, team ID, role, and a set-password link (`https://startathon.sctcoding.club/reset-password?token=...`).
2. **Password reset** — startathon-branded reset email, link to the subdomain.
3. **Payment confirmed** — to all participants; includes team ID and UPI ref.

## Error Handling

- 400 — bad member count, duplicate emails within payload, validation failures, invalid/used transaction ref.
- 401 — missing/invalid startathon token.
- 403 — Google login by a non-participant; payment attempted by a non-leader.
- 409 — team name taken; email already registered on another team.
- 500 — unexpected errors; details logged, generic message returned.
- Team + users inserted atomically via `D1 batch()`.

## Configuration

- New secret: `GOOGLE_REDIRECT_URI_STARTATHON`.
- Google Cloud Console: add `https://startathon.sctcoding.club/auth/google/callback` as an authorized redirect URI on the existing client.
- Reused: `JWT_SECRET`, `BREVO_API_KEY`, `TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EVENTS_DB`.

## Out of Scope

- Google Sheets sync (not requested for this event).
- Refunds, team editing/deletion, member replacement.
- Follow-up reminder cron for unpaid teams (can be added later following the existing followup pattern).
