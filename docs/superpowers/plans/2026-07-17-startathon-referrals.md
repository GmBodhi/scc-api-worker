# Startathon Team Referral Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Startathon team a shareable referral code; let another team apply one before paying for 10% off (₹90 instead of ₹100), with the applied code locked in once payment is confirmed.

**Architecture:** Two new nullable columns on `startathon_teams` (`referral_code`, `referred_by`). One new leader-only endpoint (`PUT /team/referral`) to apply/change a code pre-payment. Three existing endpoints (`createTeam`, `getTeam`, `transactionIngest`, `linkPayment` — four files total) get small, additive changes to generate the code, expose it, accept the discounted amount, and enforce amount-matching at payment time.

**Tech Stack:** Cloudflare Workers, Hono + chanfana (OpenAPI), D1 (SQLite), Zod. No test framework exists in this repo (`package.json` has no test runner) — verification is manual, via `wrangler dev` + curl/PowerShell against the local D1 instance, matching how every other Startathon endpoint in this codebase was verified.

## Global Constraints

- Referral fee: referred teams pay **₹90** instead of **₹100**. Both constants must stay in sync between `transactionIngest.ts` (webhook filter) and `linkPayment.ts` (amount match) — spec: `docs/superpowers/specs/2026-07-17-startathon-referrals-design.md`.
- `PUT /team/referral` is leader-only, callable repeatedly while the team is `payment-pending`, and permanently rejected once the team is `confirmed`.
- Self-referral (a team applying its own `referral_code` to itself) must be rejected with 400.
- No new table. Referral counts are computed via `COUNT(*) FROM startathon_teams WHERE referred_by = ? AND status = 'confirmed'` — never stored as a counter column.
- Follow existing file conventions exactly: relative imports `../../../../types` and `../../../../middleware/startathonAuth` from files under `src/endpoints/v3/events/startathon/`, try/catch wrapping every handler body, `console.log`/`console.error` on success/failure matching the style already in `createTeam.ts` and `linkPayment.ts`.

---

## Task 1: Migration — add referral columns

**Files:**
- Create: `migrations/events/0020_add_startathon_referral_columns.sql`

**Interfaces:**
- Produces: `startathon_teams.referral_code TEXT` (unique, backfilled), `startathon_teams.referred_by TEXT` (nullable, FK to `startathon_teams.team_id`).

- [ ] **Step 1: Write the migration file**

```sql
-- Migration number: 0020 	 2026-07-17T00:00:00.000Z
ALTER TABLE startathon_teams ADD COLUMN referral_code TEXT;
ALTER TABLE startathon_teams ADD COLUMN referred_by TEXT REFERENCES startathon_teams(team_id);

UPDATE startathon_teams
SET referral_code = upper(substr(lower(hex(randomblob(8))), 1, 8))
WHERE referral_code IS NULL;

CREATE UNIQUE INDEX idx_startathon_teams_referral_code ON startathon_teams (referral_code);
CREATE INDEX idx_startathon_teams_referred_by ON startathon_teams (referred_by);
```

Check the header format of an existing migration first to match it exactly:

Run: `Get-Content migrations/events/0019_create_startathon_invites_table.sql -TotalCount 3`

Match whatever comment/header convention that file uses (D1 migrations typically start with `-- Migration number: NNNN 	 <timestamp>`).

- [ ] **Step 2: Apply the migration to the local D1 database**

Run: `npm run migrate:events`
Expected: output lists `0020_add_startathon_referral_columns.sql` as applied, no errors.

- [ ] **Step 3: Verify the columns exist**

Run: `npx wrangler d1 execute scc_treasure_hunt_registrations --local --command "PRAGMA table_info(startathon_teams);"`
Expected: output includes rows for `referral_code` and `referred_by`.

- [ ] **Step 4: Commit**

```bash
git add migrations/events/0020_add_startathon_referral_columns.sql
git commit -m "feat(startathon): add referral_code and referred_by columns to teams"
```

---

## Task 2: Types — Zod schemas for the referral endpoint and response fields

**Files:**
- Modify: `src/types.ts` (near the existing Startathon schemas, ~line 775-829)

**Interfaces:**
- Consumes: none.
- Produces: `StartathonReferralRequest`, `StartathonReferralResponse` (used by Task 5). Extended `StartathonCreateTeamResponse` (used by Task 3). Extended `StartathonTeamResponse` (used by Task 4).

- [ ] **Step 1: Read the current schemas to get exact context for the edit**

Run: `Read src/types.ts` (already read in this session — reuse the known content at lines 736-802, and the `StartathonTeamResponse` definition around line 736).

- [ ] **Step 2: Add `StartathonReferralRequest` and `StartathonReferralResponse`, and extend `StartathonCreateTeamResponse`**

Edit `src/types.ts`, replacing:

```ts
export const StartathonCreateTeamResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      team_id: z.string(),
      team_name: z.string(),
      join_code: z.string(),
      status: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});
```

with:

```ts
export const StartathonCreateTeamResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      team_id: z.string(),
      team_name: z.string(),
      join_code: z.string(),
      referral_code: z.string(),
      status: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonReferralRequest = z.object({
  referral_code: z.string().min(1).max(20),
});

export const StartathonReferralResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      referred_by: z.string(),
      expected_fee: z.number(),
    })
    .optional(),
  error: z.string().optional(),
});
```

- [ ] **Step 3: Extend `StartathonTeamResponse` with referral fields**

Find the current `StartathonTeamResponse` definition (around line 736 — read it first with `Read src/types.ts` offset 730 limit 60 if not already in context) and add these fields inside its `data` object, alongside the existing `team_id`, `team_name`, `join_code`, `status`, `transaction_ref`, `created_at`, `your_role`, `members`:

```ts
      referral_code: z.string(),
      referred_by: z.string().nullable(),
      expected_fee: z.number(),
      referral_count: z.number().nullable().optional(),
```

- [ ] **Step 4: Verify the file still compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors introduced by this change (pre-existing errors, if any, are out of scope — only check that no error references `types.ts` at the lines you touched).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts
git commit -m "feat(startathon): add referral Zod schemas and response fields"
```

---

## Task 3: `POST /team` — generate `referral_code` at team creation

**Files:**
- Modify: `src/endpoints/v3/events/startathon/createTeam.ts`

**Interfaces:**
- Consumes: `StartathonCreateTeamResponse` (Task 2) already includes `referral_code` in its schema.
- Produces: every newly created team has a non-null, unique `referral_code`, returned in the `POST /team` response.

- [ ] **Step 1: Generate the code alongside `join_code` and insert it**

In `src/endpoints/v3/events/startathon/createTeam.ts`, replace:

```ts
      const rand = () =>
        Math.random().toString(36).substring(2, 8).toUpperCase();
      const teamId = `ST_${Date.now()}_${rand()}`;
      const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const now = Math.floor(Date.now() / 1000);

      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_teams (team_id, team_name, leader_id, join_code, status, created_at)
           VALUES (?, ?, ?, ?, 'payment-pending', ?)`,
        ).bind(teamId, team_name, user.user_id, joinCode, now),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = ?, role = 'leader' WHERE user_id = ?",
        ).bind(teamId, user.user_id),
      ]);

      console.log("Startathon team created:", { team_id: teamId, leader: user.user_id });

      return c.json(
        {
          success: true,
          data: {
            team_id: teamId,
            team_name,
            join_code: joinCode,
            status: "payment-pending",
          },
        },
        201,
      );
```

with:

```ts
      const rand = () =>
        Math.random().toString(36).substring(2, 8).toUpperCase();
      const teamId = `ST_${Date.now()}_${rand()}`;
      const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const now = Math.floor(Date.now() / 1000);

      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_teams (team_id, team_name, leader_id, join_code, referral_code, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'payment-pending', ?)`,
        ).bind(teamId, team_name, user.user_id, joinCode, referralCode, now),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = ?, role = 'leader' WHERE user_id = ?",
        ).bind(teamId, user.user_id),
      ]);

      console.log("Startathon team created:", { team_id: teamId, leader: user.user_id });

      return c.json(
        {
          success: true,
          data: {
            team_id: teamId,
            team_name,
            join_code: joinCode,
            referral_code: referralCode,
            status: "payment-pending",
          },
        },
        201,
      );
```

- [ ] **Step 2: Start the local dev server**

Run: `wrangler dev` (background — leave running for the rest of this task's verification)

- [ ] **Step 3: Manually verify via curl (sign up, then create a team)**

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Leader","email":"referral-test-1@example.com","password":"password123","phone":"9999999999","college":"Test College"}'
```

Expected: 201, JSON with `data.access_token`. Save it, then:

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/team \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token from previous response>" \
  -d '{"team_name":"Referral Test Team A"}'
```

Expected: 201, JSON with `data.referral_code` present as an 8-character uppercase alphanumeric string, distinct from `data.join_code`.

- [ ] **Step 4: Commit**

```bash
git add src/endpoints/v3/events/startathon/createTeam.ts
git commit -m "feat(startathon): generate referral_code on team creation"
```

---

## Task 4: `GET /team` — expose referral fields

**Files:**
- Modify: `src/endpoints/v3/events/startathon/getTeam.ts`

**Interfaces:**
- Consumes: `StartathonTeamResponse` (Task 2), team row now has `referral_code`/`referred_by` columns (Task 1).
- Produces: `GET /team` response includes `referral_code`, `referred_by`, `expected_fee`, and (leader only) `referral_count`.

- [ ] **Step 1: Add the referral fields to the handler**

In `src/endpoints/v3/events/startathon/getTeam.ts`, replace:

```ts
      const team = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }

      const members = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, name, email, role FROM startathon_users WHERE team_id = ? ORDER BY CASE role WHEN 'leader' THEN 0 ELSE 1 END, name",
      )
        .bind(user.team_id)
        .all();

      return c.json({
        success: true,
        data: {
          team_id: team.team_id as string,
          team_name: team.team_name as string,
          join_code: team.join_code as string,
          status: team.status as string,
          transaction_ref: (team.transaction_ref as string) || null,
          created_at: team.created_at as number,
          your_role: user.role,
          members: members.results.map((m) => ({
            user_id: m.user_id as string,
            name: m.name as string,
            email: m.email as string,
            role: m.role as string,
          })),
        },
      });
```

with:

```ts
      const team = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }

      const members = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, name, email, role FROM startathon_users WHERE team_id = ? ORDER BY CASE role WHEN 'leader' THEN 0 ELSE 1 END, name",
      )
        .bind(user.team_id)
        .all();

      let referralCount: number | null = null;
      if (user.role === "leader") {
        const countRow = await c.env.EVENTS_DB.prepare(
          "SELECT COUNT(*) as cnt FROM startathon_teams WHERE referred_by = ? AND status = 'confirmed'",
        )
          .bind(user.team_id)
          .first();
        referralCount = (countRow?.cnt as number) ?? 0;
      }

      return c.json({
        success: true,
        data: {
          team_id: team.team_id as string,
          team_name: team.team_name as string,
          join_code: team.join_code as string,
          referral_code: team.referral_code as string,
          referred_by: (team.referred_by as string) || null,
          expected_fee: team.referred_by ? 90 : 100,
          referral_count: referralCount,
          status: team.status as string,
          transaction_ref: (team.transaction_ref as string) || null,
          created_at: team.created_at as number,
          your_role: user.role,
          members: members.results.map((m) => ({
            user_id: m.user_id as string,
            name: m.name as string,
            email: m.email as string,
            role: m.role as string,
          })),
        },
      });
```

- [ ] **Step 2: Manually verify via curl**

With `wrangler dev` still running from Task 3 and the same access token:

```bash
curl -s http://localhost:8787/api/v3/events/startathon/team \
  -H "Authorization: Bearer <access_token>"
```

Expected: 200, JSON `data.referral_code` matches the code from Task 3's create response, `data.referred_by` is `null`, `data.expected_fee` is `100`, `data.referral_count` is `0` (caller is the leader).

- [ ] **Step 3: Commit**

```bash
git add src/endpoints/v3/events/startathon/getTeam.ts
git commit -m "feat(startathon): expose referral fields on GET /team"
```

---

## Task 5: `PUT /team/referral` — new endpoint to apply/change a referral code

**Files:**
- Create: `src/endpoints/v3/events/startathon/applyReferral.ts`
- Modify: `src/endpoints/v3/index.ts`

**Interfaces:**
- Consumes: `requireStartathonAuth` (`src/middleware/startathonAuth.ts`, returns `StartathonAuthResult` with `.user.team_id`, `.user.role`), `StartathonReferralRequest` / `StartathonReferralResponse` (Task 2).
- Produces: `PUT /events/startathon/team/referral` route, sets `startathon_teams.referred_by`.

- [ ] **Step 1: Write the endpoint**

Create `src/endpoints/v3/events/startathon/applyReferral.ts`:

```ts
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonReferralRequest,
  StartathonReferralResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * PUT /api/v3/events/startathon/team/referral
 * Leader applies (or changes) another team's referral code before
 * paying. Locked once the team's payment is confirmed.
 */
export class StartathonApplyReferral extends OpenAPIRoute {
  schema = {
    summary: "Apply a referral code to my team",
    description:
      "Leader submits another team's referral_code for 10% off the team fee (₹90 instead of ₹100). Callable repeatedly while payment-pending; locked once confirmed.",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonReferralRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Referral applied",
        content: {
          "application/json": {
            schema: StartathonReferralResponse,
          },
        },
      },
      "400": {
        description: "Invalid/self referral code, or team already paid",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "403": {
        description: "Only the team leader can apply a referral code",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    try {
      const authResult = await requireStartathonAuth(c);
      if (!authResult.success || !authResult.user) {
        return c.json(
          { success: false, error: authResult.error || "Unauthorized" },
          401,
        );
      }
      const user = authResult.user;

      if (user.role !== "leader") {
        return c.json(
          { success: false, error: "Only the team leader can apply a referral code" },
          403,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { referral_code } = data.body;

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }

      if (team.status !== "payment-pending") {
        return c.json(
          { success: false, error: "Team payment is already completed" },
          400,
        );
      }

      const referrer = await c.env.EVENTS_DB.prepare(
        "SELECT team_id FROM startathon_teams WHERE referral_code = ?",
      )
        .bind(referral_code)
        .first();

      if (!referrer) {
        return c.json({ success: false, error: "Invalid referral code" }, 400);
      }

      if (referrer.team_id === user.team_id) {
        return c.json(
          { success: false, error: "You can't refer your own team" },
          400,
        );
      }

      await c.env.EVENTS_DB.prepare(
        "UPDATE startathon_teams SET referred_by = ? WHERE team_id = ?",
      )
        .bind(referrer.team_id as string, user.team_id)
        .run();

      console.log("Startathon referral applied:", {
        team_id: user.team_id,
        referred_by: referrer.team_id,
      });

      return c.json({
        success: true,
        data: {
          referred_by: referrer.team_id as string,
          expected_fee: 90,
        },
      });
    } catch (error) {
      console.error("Startathon apply referral error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 2: Register the route**

In `src/endpoints/v3/index.ts`, add the import near the other Startathon imports (after line 31, `import { StartathonCreateTeam } ...`):

```ts
import { StartathonApplyReferral } from "./events/startathon/applyReferral";
```

Add the route registration right after `openapi.get("/events/startathon/team", StartathonGetTeam);` (currently line 139):

```ts
openapi.put("/events/startathon/team/referral", StartathonApplyReferral);
```

- [ ] **Step 3: Manually verify via curl — full flow**

With `wrangler dev` running, sign up a second user and create a second team ("Referral Test Team B") the same way as Task 3 Step 3, to get a second `access_token` and a `team_id` distinct from Team A's.

Self-referral rejection (using Team A's own leader token and Team A's own referral_code from Task 3):

```bash
curl -s -X PUT http://localhost:8787/api/v3/events/startathon/team/referral \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <Team A leader token>" \
  -d '{"referral_code":"<Team A referral_code>"}'
```

Expected: 400, `{"success":false,"error":"You can't refer your own team"}`.

Invalid code:

```bash
curl -s -X PUT http://localhost:8787/api/v3/events/startathon/team/referral \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <Team B leader token>" \
  -d '{"referral_code":"NOTAREALCODE"}'
```

Expected: 400, `{"success":false,"error":"Invalid referral code"}`.

Successful apply (Team B applies Team A's code):

```bash
curl -s -X PUT http://localhost:8787/api/v3/events/startathon/team/referral \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <Team B leader token>" \
  -d '{"referral_code":"<Team A referral_code>"}'
```

Expected: 200, `data.referred_by` equals Team A's `team_id`, `data.expected_fee` is `90`.

Verify via `GET /team` with Team B's token that `referred_by` and `expected_fee: 90` now show up (reuse Task 4 Step 2's curl with Team B's token).

- [ ] **Step 4: Commit**

```bash
git add src/endpoints/v3/events/startathon/applyReferral.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): add PUT /team/referral endpoint"
```

---

## Task 6: `POST /transaction` — accept ₹90 alongside ₹100

**Files:**
- Modify: `src/endpoints/v3/events/startathon/transactionIngest.ts`

**Interfaces:**
- Consumes: none new.
- Produces: webhook now stores `unused` transactions of amount `90` as well as `100`.

- [ ] **Step 1: Widen the amount filter**

In `src/endpoints/v3/events/startathon/transactionIngest.ts`, replace:

```ts
const STARTATHON_FEE = 100;
```

with:

```ts
const STARTATHON_FEE = 100;
const STARTATHON_REFERRAL_FEE = 90;
```

Replace:

```ts
    if (!extracted || extracted.amount !== STARTATHON_FEE) {
      c.status(400);
      return c.json({ error: "Invalid transaction data" });
    }
```

with:

```ts
    if (
      !extracted ||
      (extracted.amount !== STARTATHON_FEE &&
        extracted.amount !== STARTATHON_REFERRAL_FEE)
    ) {
      c.status(400);
      return c.json({ error: "Invalid transaction data" });
    }
```

- [ ] **Step 2: Manually verify via curl**

Check `c.env.TOKEN`'s local value first:

Run: `Get-Content .dev.vars 2>$null` or `Get-Content .dev.vars.example 2>$null` — find the `TOKEN` value used for local dev (if `.dev.vars` doesn't exist locally, check `wrangler.jsonc` / ask before proceeding, since this webhook is guarded by a shared secret).

With `wrangler dev` running and a valid raw HDFC SMS payload shaped like existing test data (check `src/services/transaction.ts` or existing `RawTransaction` schema in `src/types.ts` for the exact body shape expected by `parseTransactionHDFC`), send a ₹90 transaction:

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/transaction \
  -H "Content-Type: application/json" \
  -H "Authorization: <TOKEN from .dev.vars>" \
  -d '{"data": "<raw HDFC SMS text with amount 90 and a fresh unique UPI ref>"}'
```

Expected: 201, `{"success":true,"ref":"<upi ref>"}`.

Confirm it's stored:

Run: `npx wrangler d1 execute scc_treasure_hunt_registrations --local --command "SELECT ref, amount, status FROM startathon_transactions ORDER BY createdAt DESC LIMIT 1;"`
Expected: the new row shows `amount = 90`, `status = 'unused'`.

- [ ] **Step 3: Commit**

```bash
git add src/endpoints/v3/events/startathon/transactionIngest.ts
git commit -m "feat(startathon): accept discounted 90 rupee referral transactions"
```

---

## Task 7: `POST /payment` — match transaction amount to the team's expected fee

**Files:**
- Modify: `src/endpoints/v3/events/startathon/linkPayment.ts`

**Interfaces:**
- Consumes: `startathon_teams.referred_by` (Task 1), transactions stored by Task 6.
- Produces: `POST /payment` only accepts a transaction whose `amount` matches the paying team's `referred_by`-derived expected fee (90 or 100).

- [ ] **Step 1: Compute the expected amount and filter the transaction lookup by it**

In `src/endpoints/v3/events/startathon/linkPayment.ts`, replace:

```ts
      if (team.status !== "payment-pending") {
        return c.json(
          { success: false, error: "Team payment is already completed" },
          400,
        );
      }

      const transaction = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_transactions WHERE ref = ? AND status = 'unused'",
      )
        .bind(transaction_id)
        .first();

      if (!transaction) {
        return c.json(
          { success: false, error: "Transaction not found or already used" },
          400,
        );
      }
```

with:

```ts
      if (team.status !== "payment-pending") {
        return c.json(
          { success: false, error: "Team payment is already completed" },
          400,
        );
      }

      const expectedAmount = team.referred_by ? 90 : 100;

      const transaction = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_transactions WHERE ref = ? AND status = 'unused' AND amount = ?",
      )
        .bind(transaction_id, expectedAmount)
        .first();

      if (!transaction) {
        return c.json(
          { success: false, error: "Transaction not found or already used" },
          400,
        );
      }
```

- [ ] **Step 2: Manually verify via curl — mismatched amount is rejected**

With `wrangler dev` running, using Team B (which applied Team A's referral code in Task 5, so `expected_fee = 90`) and the ₹100 transaction ref stored earlier for a different test if one exists, or ingest a fresh ₹100 transaction via Task 6's curl pattern (amount 100 this time) to get an unused ₹100 ref:

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <Team B leader token>" \
  -d '{"transaction_id":"<the 100-rupee ref>"}'
```

Expected: 400, `{"success":false,"error":"Transaction not found or already used"}` (amount mismatch — Team B needs a 90-rupee transaction).

- [ ] **Step 3: Manually verify via curl — matching discounted amount succeeds**

Ingest a ₹90 transaction (Task 6's curl pattern) to get a fresh unused ₹90 ref, then:

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <Team B leader token>" \
  -d '{"transaction_id":"<the 90-rupee ref>"}'
```

Expected: 200, `{"success":true,"message":"Payment linked. Team confirmed — see you at Startathon!"}`.

- [ ] **Step 4: Verify the referral count updates on the referrer's team**

```bash
curl -s http://localhost:8787/api/v3/events/startathon/team \
  -H "Authorization: Bearer <Team A leader token>"
```

Expected: 200, `data.referral_count` is now `1`.

- [ ] **Step 5: Verify a non-referred team still requires the full ₹100**

Using a fresh third team (no referral applied) and a ₹90 unused transaction ref, confirm `POST /payment` returns 400 (amount mismatch), then confirm it succeeds with a ₹100 ref.

- [ ] **Step 6: Commit**

```bash
git add src/endpoints/v3/events/startathon/linkPayment.ts
git commit -m "feat(startathon): match payment amount to team's referral-adjusted fee"
```

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 1), `PUT /team/referral` with all its error cases (Task 5), `POST /team` generating the code (Task 3), `GET /team` exposing fields including leader-only `referral_count` (Task 4), webhook accepting both amounts (Task 6), payment amount-matching both directions (Task 7), types (Task 2) — all spec sections have a task.
- **Self-referral / one-shot vs. changeable / lock-on-confirm:** handled in Task 5 (self-check + `payment-pending` gate is the change lock — once `confirmed`, the `team.status !== "payment-pending"` check blocks further calls, satisfying "frozen once confirmed" from the spec without needing separate logic).
- **No new table**, `referral_count` computed via `COUNT`/`referred_by`/`status='confirmed'` query — matches spec exactly (Task 4 Step 1).
- Out-of-scope items (individual-fee tiers, admin reporting, rate limiting) are not tasked — correctly excluded per spec.
