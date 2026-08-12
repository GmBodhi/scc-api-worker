# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Worker project that provides an OpenAPI 3.1 compliant REST API for the SCC Treasure Hunt event management system. The API handles student registrations, UPI transaction processing, payment verification, and automated follow-up emails. Built using Hono framework with chanfana for automatic OpenAPI schema generation.

## Architecture

- **Framework**: Hono web framework with chanfana for OpenAPI integration
- **Runtime**: Cloudflare Workers with scheduled events (cron triggers every 30 minutes)
- **Database**: D1 database binding (`db`) connected to `scc_treasure_hunt_registrations`
- **Email Service**: Brevo (formerly Sendinblue) API integration for transactional emails
- **Language**: TypeScript with ES2022 target
- **Validation**: Zod schemas for request/response validation

### Key Components

- `src/index.ts` - Main application entry point with HTTP routes and scheduled event handler
- `src/endpoints/` - OpenAPI route handlers for all API endpoints
- `src/services/` - Business logic including transaction parsing and email service
- `src/templates/` - Email HTML templates (payment confirmation, follow-up reminders)
- `src/scheduledWorker.ts` - Cron job handler for automated follow-up emails
- `src/types.ts` - Shared TypeScript types and Zod schemas
- `wrangler.jsonc` - Cloudflare Workers configuration with D1 database, cron triggers, and custom domain

### API Endpoints

- `POST /api/student` - Create new student registration (also updates Google Sheets)
- `POST /api/transaction` - Process UPI transaction data
- `POST /api/link` - Link transaction to student registration (also updates Google Sheets)
- `GET /api/ticket/:id` - Verify student ticket/registration
- `POST /api/verify-student` - Verify student by email/phone
- `POST /api/email-test` - Test email functionality
- `POST /api/initialize-sheets` - Initialize Google Sheets with headers

### Startathon Module (standalone — client: startathon.sctcoding.club)

Self-contained account/team/payment system. Own tables (`startathon_teams`, `startathon_users`, `startathon_invites`, `startathon_reset_tokens`, `startathon_transactions`); shares only Google client credentials, `JWT_SECRET`, Brevo, and the HDFC parser. JWTs carry `aud: "startathon"`. Accounts are independent of teams — users sign up first (email/password or Google, both create-or-login), then create or join a team separately.

- `POST /api/v3/events/startathon/auth/signup` - Create account (public, no team assigned)
- `POST /api/v3/events/startathon/auth/login` - Email/password login
- `GET /api/v3/events/startathon/auth/google` + `/callback` - Google sign-up-or-login
- `POST /api/v3/events/startathon/auth/password/reset` + `/verify` - Password set/reset
- `POST /api/v3/events/startathon/team` - Create a team (caller becomes leader)
- `GET /api/v3/events/startathon/team` - My team + payment status (404 if none)
- `GET /api/v3/events/startathon/me` - My account info (user_id, team_id, role, name, email, phone, college)
- `PATCH /api/v3/events/startathon/me` - Update my name/phone/college (email not editable)
- `POST /api/v3/events/startathon/team/invite` - Leader invites by email (creates account if needed)
- `POST /api/v3/events/startathon/team/invite/:id/cancel` - Leader cancels a pending invite
- `POST /api/v3/events/startathon/team/join` - Join a team by `join_code`
- `POST /api/v3/events/startathon/team/leave` - Leave (member) or delete the team (leader)
- `POST /api/v3/events/startathon/team/leader` - Leader hands the role to a teammate
- `POST /api/v3/events/startathon/team/members/:user_id/kick` - Leader removes a member
- `GET /api/v3/events/startathon/invites` - My pending invites
- `POST /api/v3/events/startathon/invites/:id/accept` + `/decline` - Respond to an invite
- `POST /api/v3/events/startathon/transaction` - Webhook ingest (₹100 fee, TOKEN-guarded)
- `POST /api/v3/events/startathon/payment` - Leader links UPI ref, team → confirmed
- `PUT /api/v3/events/startathon/team/application` - Leader submits/edits the shortlisting application (full replace)
- `GET /api/v3/events/startathon/team/application` - Application plus the full member roster
- `PUT /api/v3/events/startathon/team/application/members/:user_id` - A member's own details; leader may write any member
- `POST /api/v3/events/startathon/links/verify/drive` - Is a Drive link readable by an outsider?
- `POST /api/v3/events/startathon/links/verify/youtube` - Is a YouTube link playable?

#### Student-relations calling (staff routes)

The SR team phones the leaders of confirmed teams and files what came
back. Two kinds of credential, both in the `Authorization` header, both
answering **404** when wrong (matching `transactionIngest` — staff routes
don't confirm their own existence):

- **`SR_TOKEN`** — the organiser/admin key. Registers callers, rotates or
  deactivates them, reads the whole campaign. Deliberately *cannot* claim
  teams or file calls (403): a call attributed to "the admin token" would
  be a hole in the accountability the per-caller tokens exist to provide.
  A separate secret from `TOKEN` so it's rotatable without breaking the
  bank-SMS webhook. Fails closed if unset rather than falling back to
  `TOKEN`. Set with `wrangler secret put SR_TOKEN`.
- **Per-caller tokens** (`startathon_sr_callers.token`, `sr_…`) — one per
  volunteer. **The token IS the identity**: the worker resolves it to a
  caller and `caller_id` is never accepted from the client, so nobody can
  file a call under a colleague's name, and `GET /calls?caller_id=` is
  honoured for the admin key alone. Returned once at creation or
  rotation and never readable again — if lost, rotate.

A lost phone is fixed by rotating that one caller, not the whole team's
credential. `PATCH /callers/:id` handles both `{rotate:true}` and
`{active:false}`; deactivating stops the token immediately but leaves
their filed calls and stats intact, and their open claims simply expire
back to the pool.

- `POST /api/v3/events/startathon/sr/callers` - Register a caller, mint their token (admin)
- `PATCH /api/v3/events/startathon/sr/callers/:caller_id` - `{active?, rotate?}` (admin)
- `GET /api/v3/events/startathon/sr/callers` - Roster + per-caller progress + pool totals
- `GET /api/v3/events/startathon/sr/me` - Who this caller token belongs to
- `POST /api/v3/events/startathon/sr/calls/claim` - `{count?}` pulls the next batch
- `GET /api/v3/events/startathon/sr/calls` - `?state=open|done|all` (own list; admin may pass `caller_id`)
- `PUT /api/v3/events/startathon/sr/calls/:team_id/feedback` - File the after-call result
- `POST /api/v3/events/startathon/sr/calls/:team_id/release` - Drop an uncalled claim

Work is divided by **pulling, not assigning**: there is no allocation
step, so the split self-balances against each caller's actual pace.
`startathon_sr_calls` has one row per team that is simultaneously the
claim lock and the feedback record — the row existing means claimed,
`outcome IS NULL` means claimed-but-not-yet-called.

**Stale claims need no cron.** A claim older than `SR_CLAIM_TTL_MS` (24h)
that still has no outcome is overwritten by the next caller who pulls, so
an abandoned list returns to circulation on its own. Race safety comes
from the conflict branch re-checking eligibility, so two simultaneous
claims can't land the same team on two lists.

**A `no-answer` goes back in the pool; a `reached` never does.** Nobody
picked up, so the team still needs calling — but it rests for
`SR_NO_ANSWER_RETRY_MS` (4h) first, and the claim query orders by
`COALESCE(called_at, 0)` so untried teams always come first. Without
that, a released team is instantly re-eligible and, dealing oldest-first,
lands straight back on the caller who just rang it. `attempts` survives
re-claiming, so "we've rung them 3 times" is visible on the card.

The pool is `status = 'confirmed'` teams only. Each contact carries the
leader **and the whole roster** (a caller whose leader doesn't answer needs
a fallback number without another request) plus `has_application`, since
"have you submitted yet?" gets asked on every call.

`feedback` is a JSON array of `{question, answer}`, validated for
structure only — the SR script changes week to week and shouldn't need a
migration to do it. Nothing inside is SQL-queryable, which is why
`outcome` (`reached` / `no-answer` / `wrong-number` / `call-back-later`)
stays a real column: progress tracking never depends on parsing JSON.
Feedback is a **full replace**, and the endpoint upserts rather than
demanding a prior claim so an off-queue call can still be filed — the one
thing it refuses is overwriting another caller's *open* claim (409).

**The roster stays editable at every team status.** Invite, join, accept,
kick, and a member leaving all work whether the team is `payment-pending` or
`confirmed` — the ₹100 is a per-team fee, not per-head, so who is on the team
is independent of the payment. The only thing team status gates is a *leader*
calling `/team/leave`, because for a leader that call deletes the whole team;
once paid, that would throw away a real `transaction_ref` and the application.
A confirmed team's leader exits by `POST /team/leader` (hand over) and then
leaving as an ordinary member. Kicking or leaving also deletes that person's
`startathon_application_members` row, so no entry outlives its membership.
A member who joins after the application was submitted simply has no row yet
— the roster query renders that as nulls with `updated_at: null`, which is a
valid state, not an error.

Both link checks are **advisory** — auth-guarded, nothing stored, no other
endpoint consults them, and `PUT /team/application` does not call them. They
answer 200 whenever the check itself ran; `data.ok` carries the verdict and
`data.reason` the cause. Drive works by asking the service account (an
unrelated identity, so a stand-in for a judge) to read the file — a 404 back
from Google means not shared. Requires the **Drive API to be enabled** on the
Cloud project, in addition to Sheets. YouTube uses oEmbed, needs no API key,
and cannot distinguish public from unlisted — both are playable, both pass.

The application is the pre-event shortlisting submission (20 teams advance).
The 5-slide deck and 60s video are the real pitch and are held as URLs, so
the row stores only what must be queryable plus `problem_evidence`, the
`domains` the solution falls under, and the `prior_work` declaration.
Architecture and tech stack are deliberately not collected at this stage.
`domains` is free text (max 5, JSON array) rather than an enum — the domain
list shifts between editions, and an ill-fitting enum pushes teams into
"other", which tells the shortlisting panel nothing. Like `prior_work`, NULL
means never answered and `[]` means explicitly none. Writes to both endpoints close at
`STARTATHON_APPLICATION_CLOSES_AT` (a `wrangler.jsonc` var, so the date moves
without a code deploy); an unset or unparseable value fails closed with a 500.

### Scheduled Jobs

- **Cron Schedule**: Every 30 minutes (`*/30 * * * *`)
- **Purpose**: Send follow-up payment reminders to students with pending status after 20 minutes
- **Database Tracking**: Prevents duplicate emails via `followup_emails` table

### Database Schema

Key tables include:
- `students` - Student registrations with status tracking
- `followup_emails` - Email delivery tracking to prevent duplicates

## Development Commands

```bash
# Start local development server with hot reload
wrangler dev

# Deploy to Cloudflare Workers  
wrangler deploy

# Generate TypeScript types from Wrangler configuration
wrangler types
```

## Environment Variables

The application requires these secrets (managed via `wrangler secret put`):
- `BREVO_API_KEY` - API key for email service integration
- `GOOGLE_SHEETS_ID` - The Google Sheets spreadsheet ID (from the URL)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email for Google Sheets API
- `GOOGLE_PRIVATE_KEY` - Private key for Google service account (in PEM format)

## Google Sheets Integration

The application automatically syncs student registration data to a Google Sheets spreadsheet. This provides a real-time dashboard for monitoring registrations and payment status.

### Setup Instructions

1. **Create Google Service Account**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Google Sheets API
   - Go to "Credentials" → "Create Credentials" → "Service Account"
   - Download the JSON key file

2. **Create Google Sheets**:
   - Create a new Google Sheets document
   - Share it with your service account email (with Editor permissions)
   - Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

3. **Set Environment Variables**:
   ```bash
   # Set the spreadsheet ID
   wrangler secret put GOOGLE_SHEETS_ID
   
   # Set the service account email (from JSON key file)
   wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
   
   # Set the private key (from JSON key file, keep the \n characters)
   wrangler secret put GOOGLE_PRIVATE_KEY
   ```

4. **Initialize the Sheet**:
   - Deploy the worker: `wrangler deploy`
   - Call the initialization endpoint: `POST /api/initialize-sheets`
   - This will set up column headers in your spreadsheet

### Data Flow

- **Student Registration** (`POST /api/student`): Adds a new row to the spreadsheet
- **Payment Linking** (`POST /api/link`): Updates the student's status to "paid" and adds UPI reference
- **Sheet Structure**:
  - Column A: Student ID
  - Column B: Name  
  - Column C: Batch
  - Column D: Email
  - Column E: Phone Number
  - Column F: Status (pending/paid)
  - Column G: UPI Reference
  - Column H: Created At
  - Column I: Updated At

### Error Handling

Google Sheets integration failures do not affect the main API functionality. If Sheets updates fail:
- The registration/payment linking will still succeed in the database
- Error details are logged for debugging
- Users receive normal success responses

## Local Development

- Run `wrangler dev` to start local server on `http://localhost:8787/`
- Swagger UI available at root URL for interactive API testing
- Hot reload enabled for `src/` changes
- Custom domain: `api.sctcoding.club` (production)