# Startathon: Team Referral Codes — Design

**Date:** 2026-07-17
**Status:** Approved
**Builds on:** `docs/superpowers/specs/2026-07-12-startathon-independent-signup-design.md`

## Overview

Every Startathon team gets a shareable referral code the moment it's created. Any *other* team can apply one team's code to itself before paying, getting 10% off the ₹100 team fee (₹90). The applying team's leader can change the code up until they pay; once payment is confirmed it's locked permanently.

This is purely a discount + attribution mechanism for the current ₹100 team fee. A future feature — tiered discounts on an eventual "individual fee" based on how many teams a team has referred — is explicitly out of scope here; this spec only makes the data (`referred_by`, computable referral counts) available for that later work.

**Accepted risk:** a referral code is usable the instant a team is created, without requiring the referring team to have paid anything themselves. This makes self-serve ghost-account abuse possible (create a throwaway team, use its code elsewhere) at the cost of real money per abused referral (₹90/use). This is a deliberate trade-off in favor of referral virality over fraud-proofing, made explicitly for this iteration.

## Data Model (EVENTS_DB)

```sql
-- Migration: add referral columns to startathon_teams
ALTER TABLE startathon_teams ADD COLUMN referral_code TEXT;
ALTER TABLE startathon_teams ADD COLUMN referred_by TEXT REFERENCES startathon_teams(team_id);

-- Backfill referral_code for any existing rows (8-char, same alphabet as join_code)
UPDATE startathon_teams
SET referral_code = upper(substr(lower(hex(randomblob(8))), 1, 8))
WHERE referral_code IS NULL;

CREATE UNIQUE INDEX idx_startathon_teams_referral_code ON startathon_teams (referral_code);
CREATE INDEX idx_startathon_teams_referred_by ON startathon_teams (referred_by);
```

- `referral_code` — generated at team creation the same way `join_code` is (`Math.random().toString(36)` uppercased), guaranteed unique the same way (retry-free in practice given the ID space; collisions are already not specially handled for `join_code` today).
- `referred_by` — nullable `team_id` of the team whose code this team applied. NULL until `PUT /team/referral` succeeds. Once the team's own `status` becomes `confirmed`, this value is frozen (the endpoint refuses further changes).
- No new table, no counter column. A team's referral count is computed on demand:
  ```sql
  SELECT COUNT(*) FROM startathon_teams WHERE referred_by = ? AND status = 'confirmed'
  ```

## Endpoints

All routes under `/api/v3/events/startathon/`.

### `PUT /team/referral` (new)

Leader-only. Body: `{ referral_code: string }`.

- 401 if unauthenticated.
- 403 if caller isn't the team leader.
- 400 "Team payment is already completed" if caller's team `status !== 'payment-pending'`.
- 400 "Invalid referral code" if no team has that `referral_code`.
- 400 "You can't refer your own team" if the code resolves to the caller's own `team_id`.
- On success: `UPDATE startathon_teams SET referred_by = <referrer_team_id> WHERE team_id = <caller's team_id>`. Overwrites any previously-applied code — callable repeatedly while still `payment-pending`.
- Response: `{ success: true, data: { referred_by: <referrer_team_id>, expected_fee: 90 } }`.

### `POST /team` (modified — createTeam.ts)

Generates `referral_code` alongside `join_code` at insert time. Response gains `referral_code`.

### `GET /team` (modified — getTeam.ts)

Response gains:
- `referral_code` — this team's own shareable code (visible to all members, like `join_code`).
- `referred_by` — the referrer team's `team_id`, or `null`.
- `expected_fee` — `90` if `referred_by` is set, else `100`.
- `referral_count` — leader only; count of other teams that applied this team's code and reached `confirmed`. Omitted (or `null`) for non-leader members.

### `POST /transaction` (modified — transactionIngest.ts)

Webhook amount filter changes from `extracted.amount !== STARTATHON_FEE` (strict ₹100) to accepting either `100` or `90`. Everything else (HDFC parsing, `unused` status, dedup on `ref`) unchanged.

### `POST /payment` (modified — linkPayment.ts)

After loading the team, compute `const expectedAmount = team.referred_by ? 90 : 100`. The transaction lookup becomes:

```sql
SELECT * FROM startathon_transactions WHERE ref = ? AND status = 'unused' AND amount = ?
```

bound to `(transaction_id, expectedAmount)`. A transaction that doesn't match the team's expected amount is treated as "not found" (same 400 as today), whether that's a referred team trying to pay full price or a non-referred team trying to pay the discounted price. The rest of the flow (race-guarded claim, `status = 'confirmed'`, confirmation emails) is unchanged.

## Types (`src/types.ts`)

- `StartathonReferralRequest = z.object({ referral_code: z.string().min(1).max(20) })`
- `StartathonReferralResponse` — `{ success, data: { referred_by, expected_fee } }` / `{ success: false, error }`
- `StartathonCreateTeamResponse` — add `referral_code: z.string()`
- `StartathonTeamResponse` — add `referral_code`, `referred_by: z.string().nullable()`, `expected_fee: z.number()`, `referral_count: z.number().nullable().optional()`

## Route Registration (`src/endpoints/v3/index.ts`)

```ts
openapi.put("/events/startathon/team/referral", StartathonApplyReferral);
```

New file: `src/endpoints/v3/events/startathon/applyReferral.ts`.

## Error Handling Summary (additions to the existing table)

- 400 — invalid/self referral code, referral applied after payment confirmed, transaction amount doesn't match team's expected fee.
- 403 — non-leader calling `PUT /team/referral`.

## Out of Scope

- Tiered discounts on the future individual fee based on `referral_count` (data is available for this; logic is a separate later spec).
- Gating a team's ability to give out its code on that team having paid itself (explicitly accepted risk — see Overview).
- Any admin/reporting view of referral abuse; manual DB inspection is sufficient for an event-scoped tool.
- Rate limiting on `PUT /team/referral` retries.
