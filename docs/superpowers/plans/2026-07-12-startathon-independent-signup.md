# Startathon Independent Signup + Team Formation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Startathon module's all-at-once team registration with independent signup (email/password or Google) followed by separate team create/invite/join/leave/kick flows, per `docs/superpowers/specs/2026-07-12-startathon-independent-signup-design.md`.

**Architecture:** `startathon_users.team_id`/`role` become nullable — accounts exist independently of teams. A new `startathon_invites` table tracks pending invites (create-if-missing accounts + invite, or invite an existing teamless account). Teams gain a `join_code` for self-service joining. This replaces `feature/startathon`'s existing migrations 0015–0018 and several endpoint files cleanly (never deployed, so no data migration needed).

**Tech Stack:** Cloudflare Workers, Hono + chanfana, Zod, D1 (EVENTS_DB), Brevo via existing `EmailService`.

## Global Constraints

- `startathon_users.team_id` and `role` are nullable; CHECK constraint: `(team_id IS NULL AND role IS NULL) OR (team_id IS NOT NULL AND role IS NOT NULL)`.
- Team cap: 4 people total (1 leader + up to 3 members), enforced in application code via `COUNT(*) FROM startathon_users WHERE team_id = ?`, not a DB constraint.
- ID formats: team `ST_<Date.now()>_<6-char-rand>`, user `STU_<Date.now()>_<6-char-rand>`, invite `INV_<Date.now()>_<6-char-rand>` (rand = `Math.random().toString(36).substring(2, 8).toUpperCase()`). `join_code`: `Math.random().toString(36).substring(2, 10).toUpperCase()` (8 chars).
- Emails stored/compared lowercased.
- Password hashing: SHA-256 hex via `hashPassword` from `src/utils/startathonJwt.ts` (existing, unchanged).
- Startathon JWTs: `generateStartathonJWT(userId, email, name, secret)` from `src/utils/startathonJwt.ts` — **unchanged, do not modify**. The JWT payload never carried `team_id`; team state is always looked up fresh from `startathon_users` by `requireStartathonAuth`, so nullable team fields require zero JWT changes.
- Auth via `requireStartathonAuth(c)` from `src/middleware/startathonAuth.ts`, returning `{success, user?: StartathonAuthUser, error?}`.
- Emails are always non-fatal: wrap in try/catch, `console.error` on failure, never fail the request.
- Response error shape: `{ success: false, error: "..." }` (matches every existing startathon endpoint).
- Do NOT touch: `src/utils/startathonJwt.ts`, `src/endpoints/v3/events/startathon/transactionIngest.ts`, `src/endpoints/v3/events/startathon/googleInitiate.ts`, GENERAL_DB, main-site auth.
- No test framework exists in this repo. Verify with `npx tsc --noEmit` (bar: zero new errors in touched files — repo has ~48 pre-existing errors elsewhere) and curl against `npx wrangler dev` with local D1.
- Local dev: `.dev.vars` already has `JWT_SECRET`, `TOKEN`, `BREVO_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI_STARTATHON` from prior work — reuse, don't recreate. Never commit `.dev.vars`.
- Commit after every task with the message given in the task.
- After any `wrangler dev` verification, fully stop the process and confirm port 8787 is free before finishing (recurring issue in this codebase's history — be thorough).

---

### Task 1: Replace migrations (nullable team fields + invites table)

**Files:**
- Modify (overwrite content): `migrations/events/0015_create_startathon_teams_table.sql`
- Modify (overwrite content): `migrations/events/0016_create_startathon_users_table.sql`
- Create: `migrations/events/0019_create_startathon_invites_table.sql`
- Leave unchanged: `migrations/events/0017_create_startathon_reset_tokens_table.sql`, `migrations/events/0018_create_startathon_transactions_table.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: the schema every later task depends on.

- [ ] **Step 1: Overwrite `migrations/events/0015_create_startathon_teams_table.sql`**

```sql
CREATE TABLE startathon_teams (
  team_id         TEXT PRIMARY KEY,
  team_name       TEXT NOT NULL UNIQUE,
  leader_id       TEXT NOT NULL,
  join_code       TEXT NOT NULL UNIQUE,
  transaction_ref TEXT,
  status          TEXT NOT NULL DEFAULT 'payment-pending',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER
);
```

- [ ] **Step 2: Overwrite `migrations/events/0016_create_startathon_users_table.sql`**

```sql
CREATE TABLE startathon_users (
  user_id       TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  college       TEXT,
  password_hash TEXT,
  google_id     TEXT UNIQUE,
  team_id       TEXT REFERENCES startathon_teams(team_id),
  role          TEXT CHECK (role IN ('leader','member')),
  created_at    INTEGER NOT NULL,
  CHECK ((team_id IS NULL AND role IS NULL) OR (team_id IS NOT NULL AND role IS NOT NULL))
);

CREATE INDEX idx_startathon_users_team_id ON startathon_users (team_id);
```

- [ ] **Step 3: Create `migrations/events/0019_create_startathon_invites_table.sql`**

```sql
CREATE TABLE startathon_invites (
  invite_id     TEXT PRIMARY KEY,
  team_id       TEXT NOT NULL REFERENCES startathon_teams(team_id),
  invited_email TEXT NOT NULL,
  invited_by    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    INTEGER NOT NULL,
  responded_at  INTEGER
);

CREATE INDEX idx_startathon_invites_email_status ON startathon_invites (invited_email, status);
CREATE INDEX idx_startathon_invites_team_id ON startathon_invites (team_id);
```

- [ ] **Step 4: Reset local D1 and reapply all migrations from scratch**

The old `0015`/`0016` shape (non-nullable `team_id`) is already applied to local D1 from prior work. Since migration files are being overwritten in place (same filenames), `wrangler d1 migrations apply` won't re-run them — the local DB must be wiped.

Run: `rm -rf .wrangler/state/v3/d1`
Run: `npx wrangler d1 migrations apply scc_treasure_hunt_registrations --local`
Expected: all migrations from `0001` through `0019` apply cleanly, ending with `startathon_invites`.

Run: `npx wrangler d1 execute scc_treasure_hunt_registrations --local --command "SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('startathon_teams','startathon_users','startathon_invites')"`
Expected: three rows showing the new nullable `team_id`/`role` columns, the `join_code` column, and the `startathon_invites` table.

- [ ] **Step 5: Commit**

```bash
git add migrations/events/0015_create_startathon_teams_table.sql migrations/events/0016_create_startathon_users_table.sql migrations/events/0019_create_startathon_invites_table.sql
git commit -m "feat(startathon): nullable team fields, join_code, invites table"
```

---

### Task 2: Update Zod schemas in types.ts

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Consumes: existing `z` import.
- Produces (exact names later tasks import from `../../../../types`): `StartathonSignupRequest`, `StartathonCreateTeamRequest`, `StartathonCreateTeamResponse`, `StartathonInviteRequest`, `StartathonJoinTeamRequest`, `StartathonInviteListItem`, `StartathonInvitesResponse`. Modifies `StartathonAuthResponse` and `StartathonTeamResponse` in place.

- [ ] **Step 1: Remove the register-specific schemas**

In `src/types.ts`, delete these three (now unused — `register.ts` is deleted in Task 5):

```typescript
export const StartathonMemberInput = z.object({ ... });
export const StartathonRegisterRequest = z.object({ ... });
export const StartathonRegisterResponse = z.object({ ... });
```

- [ ] **Step 2: Make `StartathonAuthResponse.user` fields nullable**

Find:
```typescript
export const StartathonAuthResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      access_token: z.string(),
      expires_in: z.number(),
      user: z.object({
        user_id: z.string(),
        team_id: z.string(),
        role: z.enum(["leader", "member"]),
        name: z.string(),
        email: z.string(),
      }),
    })
    .optional(),
  error: z.string().optional(),
});
```

Replace the `user` object's `team_id`/`role` lines with:
```typescript
        team_id: z.string().nullable(),
        role: z.enum(["leader", "member"]).nullable(),
```

- [ ] **Step 3: Add `join_code` to `StartathonTeamResponse`**

Find:
```typescript
export const StartathonTeamResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      team_id: z.string(),
      team_name: z.string(),
      status: z.string(),
      transaction_ref: z.string().nullable(),
      created_at: z.number(),
      your_role: z.enum(["leader", "member"]),
      members: z.array(StartathonParticipant),
    })
    .optional(),
  error: z.string().optional(),
});
```

Add a `join_code: z.string(),` line right after `team_name: z.string(),`.

- [ ] **Step 4: Append new schemas** (after `StartathonPaymentRequest` at the end of the Startathon block)

```typescript
export const StartathonSignupRequest = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  phone: z.string().min(10).max(15),
  college: z.string().min(1).max(150),
});

export const StartathonCreateTeamRequest = z.object({
  team_name: z.string().min(2).max(60),
});

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

export const StartathonInviteRequest = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
});

export const StartathonJoinTeamRequest = z.object({
  join_code: z.string().min(1).max(20),
});

export const StartathonInviteListItem = z.object({
  invite_id: z.string(),
  team_name: z.string(),
  invited_by: z.string(),
  created_at: z.number(),
});

export const StartathonInvitesResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      invites: z.array(StartathonInviteListItem),
    })
    .optional(),
  error: z.string().optional(),
});
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i "types.ts"`
Expected: no output (this step alone won't be clean until Task 5/9 remove/update the files that reference the deleted schemas — if `register.ts` still exists at this point, you WILL see errors there; that's expected and resolved by Task 5. Confirm no *new* error mentions `types.ts` itself.)

- [ ] **Step 6: Commit**

```bash
git add src/types.ts
git commit -m "feat(startathon): schemas for independent signup, teams, invites"
```

---

### Task 3: Nullable team fields in the auth middleware

**Files:**
- Modify: `src/middleware/startathonAuth.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `StartathonAuthUser` with `team_id: string | null` and `role: "leader" | "member" | null` — every later endpoint task relies on this exact shape.

- [ ] **Step 1: Update the interface and casts**

In `src/middleware/startathonAuth.ts`, change:

```typescript
export interface StartathonAuthUser {
  user_id: string;
  team_id: string;
  role: "leader" | "member";
  name: string;
  email: string;
  phone: string | null;
  college: string | null;
}
```

to:

```typescript
export interface StartathonAuthUser {
  user_id: string;
  team_id: string | null;
  role: "leader" | "member" | null;
  name: string;
  email: string;
  phone: string | null;
  college: string | null;
}
```

And change the return-object construction from:

```typescript
    user: {
      user_id: user.user_id as string,
      team_id: user.team_id as string,
      role: user.role as "leader" | "member",
      name: user.name as string,
      email: user.email as string,
      phone: (user.phone as string) || null,
      college: (user.college as string) || null,
    },
```

to:

```typescript
    user: {
      user_id: user.user_id as string,
      team_id: (user.team_id as string) || null,
      role: (user.role as "leader" | "member") || null,
      name: user.name as string,
      email: user.email as string,
      phone: (user.phone as string) || null,
      college: (user.college as string) || null,
    },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep startathonAuth`
Expected: no output (zero errors in this file). Errors from OTHER startathon files that haven't been updated yet for the nullable type are expected at this point and resolved by later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/middleware/startathonAuth.ts
git commit -m "feat(startathon): nullable team_id/role in auth middleware"
```

---

### Task 4: Invite email templates + EmailService methods

**Files:**
- Modify: `src/templates/startathon-account-setup.ts` (repurpose copy for the invite framing)
- Create: `src/templates/startathon-invite-received.ts`
- Modify: `src/services/emailService.ts`

**Interfaces:**
- Consumes: existing `EmailService.sendEmail` private method.
- Produces:
  - `getStartathonAccountSetupInviteEmail(data: {name, teamName, invitedByName, resetToken}): string`
  - `getStartathonInviteReceivedEmail(data: {name, teamName, invitedByName}): string`
  - `EmailService.sendStartathonAccountSetupInviteEmail(name: string, email: string, teamName: string, invitedByName: string, resetToken: string): Promise<boolean>`
  - `EmailService.sendStartathonInviteReceivedEmail(name: string, email: string, teamName: string, invitedByName: string): Promise<boolean>`

- [ ] **Step 1: Rewrite `src/templates/startathon-account-setup.ts`**

Replace the entire file content:

```typescript
const CLIENT_URL = "https://startathon.sctcoding.club";

interface StartathonAccountSetupInviteData {
  name: string;
  teamName: string;
  invitedByName: string;
  resetToken: string;
}

export function getStartathonAccountSetupInviteEmail(
  data: StartathonAccountSetupInviteData,
): string {
  const { name, teamName, invitedByName, resetToken } = data;
  const setupUrl = `${CLIENT_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to a Startathon team</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#ffffff;">Startathon<span style="color:#888888;">.</span></p>
              <h1 style="margin:20px 0 12px;font-size:22px;color:#ffffff;">You're invited, ${name}!</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#bbbbbb;">
                <strong style="color:#ffffff;">${invitedByName}</strong> invited you to join team
                <strong style="color:#ffffff;">${teamName}</strong> for Startathon.
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#bbbbbb;">
                Set a password to activate your account, or simply continue with Google using this
                email address — either way, once you're signed in, accept the invite from your
                dashboard.
              </p>
              <a href="${setupUrl}" style="display:inline-block;background:rgba(200,255,0,0.9);color:#000000;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">Set your password</a>
              <p style="margin:24px 0 0;font-size:12px;color:#666666;">This link is valid for 7 days. If you weren't expecting this email, you can ignore it.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 2: Create `src/templates/startathon-invite-received.ts`**

```typescript
const CLIENT_URL = "https://startathon.sctcoding.club";

interface StartathonInviteReceivedData {
  name: string;
  teamName: string;
  invitedByName: string;
}

export function getStartathonInviteReceivedEmail(
  data: StartathonInviteReceivedData,
): string {
  const { name, teamName, invitedByName } = data;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to a Startathon team</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#ffffff;">Startathon<span style="color:#888888;">.</span></p>
              <h1 style="margin:20px 0 12px;font-size:22px;color:#ffffff;">You're invited, ${name}!</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#bbbbbb;">
                <strong style="color:#ffffff;">${invitedByName}</strong> invited you to join team
                <strong style="color:#ffffff;">${teamName}</strong> for Startathon.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#bbbbbb;">
                Log in to <a href="${CLIENT_URL}" style="color:rgba(200,255,0,0.9);">startathon.sctcoding.club</a>
                and check your invites to accept or decline.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 3: Update `src/services/emailService.ts`**

Change the import line:
```typescript
import { getStartathonAccountSetupEmail } from "../templates/startathon-account-setup";
```
to:
```typescript
import { getStartathonAccountSetupInviteEmail } from "../templates/startathon-account-setup";
import { getStartathonInviteReceivedEmail } from "../templates/startathon-invite-received";
```

Replace the entire `sendStartathonAccountSetupEmail` method:
```typescript
  async sendStartathonAccountSetupEmail(
    name: string,
    email: string,
    teamName: string,
    teamId: string,
    role: string,
    resetToken: string,
  ): Promise<boolean> {
    const html = getStartathonAccountSetupEmail({
      name,
      teamName,
      teamId,
      role,
      resetToken,
    });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: `🚀 Team "${teamName}" is registered for Startathon — set your password`,
      html,
    });
  }
```
with:
```typescript
  async sendStartathonAccountSetupInviteEmail(
    name: string,
    email: string,
    teamName: string,
    invitedByName: string,
    resetToken: string,
  ): Promise<boolean> {
    const html = getStartathonAccountSetupInviteEmail({
      name,
      teamName,
      invitedByName,
      resetToken,
    });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: `🚀 You're invited to join "${teamName}" on Startathon`,
      html,
    });
  }

  async sendStartathonInviteReceivedEmail(
    name: string,
    email: string,
    teamName: string,
    invitedByName: string,
  ): Promise<boolean> {
    const html = getStartathonInviteReceivedEmail({
      name,
      teamName,
      invitedByName,
    });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: `🚀 You're invited to join "${teamName}" on Startathon`,
      html,
    });
  }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "emailService|startathon-account-setup|startathon-invite-received"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/templates/startathon-account-setup.ts src/templates/startathon-invite-received.ts src/services/emailService.ts
git commit -m "feat(startathon): invite-flavored account-setup and invite-received emails"
```

---

### Task 5: Delete register.ts, add signup.ts

**Files:**
- Delete: `src/endpoints/v3/events/startathon/register.ts`
- Create: `src/endpoints/v3/events/startathon/signup.ts`
- Modify: `src/endpoints/v3/index.ts`

**Interfaces:**
- Consumes: `StartathonSignupRequest`, `StartathonAuthResponse`, `ErrorResponse` (Task 2); `generateStartathonJWT`, `hashPassword` from `src/utils/startathonJwt.ts` (unchanged).
- Produces: `StartathonSignup` route class at `POST /api/v3/events/startathon/auth/signup`.

- [ ] **Step 1: Delete the old register endpoint**

Run: `rm src/endpoints/v3/events/startathon/register.ts`

- [ ] **Step 2: Create `src/endpoints/v3/events/startathon/signup.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonSignupRequest,
  StartathonAuthResponse,
  ErrorResponse,
} from "../../../../types";
import {
  generateStartathonJWT,
  hashPassword,
} from "../../../../utils/startathonJwt";

/**
 * POST /api/v3/events/startathon/auth/signup
 * Create a Startathon account (public, no auth). No team yet — the
 * account is created teamless; the user creates or joins a team
 * afterward. No email verification.
 */
export class StartathonSignup extends OpenAPIRoute {
  schema = {
    summary: "Sign up for Startathon",
    description:
      "Create an account with email + password. Returns a 7-day JWT immediately. No team is assigned — create or join one afterward.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonSignupRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Account created",
        content: {
          "application/json": {
            schema: StartathonAuthResponse,
          },
        },
      },
      "409": {
        description: "Email already registered",
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
      const data = await this.getValidatedData<typeof this.schema>();
      const { name, email, password, phone, college } = data.body;
      const normalizedEmail = email.toLowerCase();

      const existing = await c.env.EVENTS_DB.prepare(
        "SELECT user_id FROM startathon_users WHERE email = ?",
      )
        .bind(normalizedEmail)
        .first();

      if (existing) {
        return c.json(
          { success: false, error: "This email is already registered" },
          409,
        );
      }

      const userId = `STU_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;
      const passwordHash = await hashPassword(password);
      const now = Math.floor(Date.now() / 1000);

      await c.env.EVENTS_DB.prepare(
        `INSERT INTO startathon_users (user_id, name, email, phone, college, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(userId, name, normalizedEmail, phone, college, passwordHash, now)
        .run();

      const accessToken = await generateStartathonJWT(
        userId,
        normalizedEmail,
        name,
        c.env.JWT_SECRET,
      );

      console.log("Startathon signup:", { user_id: userId, email: normalizedEmail });

      return c.json(
        {
          success: true,
          data: {
            access_token: accessToken,
            expires_in: 7 * 24 * 60 * 60,
            user: {
              user_id: userId,
              team_id: null,
              role: null,
              name,
              email: normalizedEmail,
            },
          },
        },
        201,
      );
    } catch (error) {
      console.error("Startathon signup error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 3: Update `src/endpoints/v3/index.ts`**

Remove the import:
```typescript
import { StartathonRegister } from "./events/startathon/register";
```

Remove the route:
```typescript
openapi.post("/events/startathon/register", StartathonRegister);
```

Add the import (alongside the other startathon imports):
```typescript
import { StartathonSignup } from "./events/startathon/signup";
```

Add the route in its place:
```typescript
openapi.post("/events/startathon/auth/signup", StartathonSignup);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "signup.ts|index.ts"`
Expected: no output.

- [ ] **Step 5: Verify with wrangler dev + curl**

Start `npx wrangler dev` in the background, wait for "Ready on".

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"secret123","phone":"9999999991","college":"SCT"}'
```
Expected: `201`, `success: true`, `access_token` present, `user.team_id: null`, `user.role: null`.

Repeat the same request → expected `409` "This email is already registered".

Stop the wrangler dev process; confirm port 8787 is free.

- [ ] **Step 6: Commit**

```bash
git add src/endpoints/v3/events/startathon/signup.ts src/endpoints/v3/index.ts
git rm src/endpoints/v3/events/startathon/register.ts
git commit -m "feat(startathon): replace all-at-once register with independent signup"
```

---

### Task 6: Update login + Google callback for nullable team state and Google signup

**Files:**
- Modify: `src/endpoints/v3/events/startathon/login.ts`
- Modify: `src/endpoints/v3/events/startathon/googleCallback.ts`

**Interfaces:**
- Consumes: `generateStartathonJWT` (unchanged), `hashPassword` (unchanged), `EmailService` — not used by either file.
- Produces: same two route classes, updated behavior.

- [ ] **Step 1: Update `src/endpoints/v3/events/startathon/login.ts`**

Find the response object inside `handle`:
```typescript
      return c.json({
        success: true,
        data: {
          access_token: accessToken,
          expires_in: 7 * 24 * 60 * 60,
          user: {
            user_id: user.user_id as string,
            team_id: user.team_id as string,
            role: user.role as string,
            name: user.name as string,
            email: user.email as string,
          },
        },
      });
```

Replace with:
```typescript
      return c.json({
        success: true,
        data: {
          access_token: accessToken,
          expires_in: 7 * 24 * 60 * 60,
          user: {
            user_id: user.user_id as string,
            team_id: (user.team_id as string) || null,
            role: (user.role as string) || null,
            name: user.name as string,
            email: user.email as string,
          },
        },
      });
```

- [ ] **Step 2: Rewrite `src/endpoints/v3/events/startathon/googleCallback.ts`**

Replace the entire file content:

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonAuthResponse,
  ErrorResponse,
} from "../../../../types";
import { generateStartathonJWT } from "../../../../utils/startathonJwt";

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture?: string;
}

/**
 * GET /api/v3/events/startathon/auth/google/callback
 * Handle Google OAuth callback for startathon.sctcoding.club.
 * Sign-up-or-login: creates a new teamless account on first Google
 * login (matching the main site's behavior), same as email signup.
 */
export class StartathonGoogleCallback extends OpenAPIRoute {
  schema = {
    summary: "Handle Startathon Google OAuth callback",
    responses: {
      "200": {
        description: "Logged in or signed up",
        content: {
          "application/json": {
            schema: StartathonAuthResponse,
          },
        },
      },
      "400": {
        description: "Invalid request",
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
      const { code, state } = c.req.query();

      if (!code || !state) {
        return c.json(
          { success: false, error: "Missing authorization code or state" },
          400,
        );
      }

      const {
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI_STARTATHON,
      } = c.env;

      if (
        !GOOGLE_CLIENT_ID ||
        !GOOGLE_CLIENT_SECRET ||
        !GOOGLE_REDIRECT_URI_STARTATHON
      ) {
        return c.json(
          { success: false, error: "Google OAuth not configured" },
          500,
        );
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI_STARTATHON,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        console.error("Token exchange error:", await tokenResponse.text());
        return c.json(
          { success: false, error: "Failed to exchange authorization code" },
          400,
        );
      }

      const tokenData = await tokenResponse.json<{ access_token: string }>();

      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );

      if (!userInfoResponse.ok) {
        return c.json(
          { success: false, error: "Failed to get user info from Google" },
          400,
        );
      }

      const googleUser = await userInfoResponse.json<GoogleUserInfo>();
      const normalizedEmail = googleUser.email.toLowerCase();

      // Match by google_id first, then by email (link on first Google login)
      let user = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_users WHERE google_id = ?",
      )
        .bind(googleUser.id)
        .first();

      if (!user) {
        user = await c.env.EVENTS_DB.prepare(
          "SELECT * FROM startathon_users WHERE email = ?",
        )
          .bind(normalizedEmail)
          .first();

        if (user) {
          await c.env.EVENTS_DB.prepare(
            "UPDATE startathon_users SET google_id = ? WHERE user_id = ?",
          )
            .bind(googleUser.id, user.user_id)
            .run();
        }
      }

      if (!user) {
        // First-time Google user: sign them up, teamless, no password.
        const userId = `STU_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;
        const now = Math.floor(Date.now() / 1000);

        await c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_users (user_id, name, email, google_id, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
          .bind(userId, googleUser.name, normalizedEmail, googleUser.id, now)
          .run();

        user = await c.env.EVENTS_DB.prepare(
          "SELECT * FROM startathon_users WHERE user_id = ?",
        )
          .bind(userId)
          .first();
      }

      if (!user) {
        return c.json(
          { success: false, error: "Failed to create or retrieve account" },
          500,
        );
      }

      const accessToken = await generateStartathonJWT(
        user.user_id as string,
        user.email as string,
        user.name as string,
        c.env.JWT_SECRET,
      );

      return c.json({
        success: true,
        data: {
          access_token: accessToken,
          expires_in: 7 * 24 * 60 * 60,
          user: {
            user_id: user.user_id as string,
            team_id: (user.team_id as string) || null,
            role: (user.role as string) || null,
            name: user.name as string,
            email: user.email as string,
          },
        },
      });
    } catch (error) {
      console.error("Startathon Google OAuth callback error:", error);
      return c.json(
        { success: false, error: "Failed to process OAuth callback" },
        500,
      );
    }
  }
}
```

Note: the `403` response schema entry is removed from `schema.responses` since the callback no longer rejects unknown emails — it signs them up instead.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "login.ts|googleCallback.ts"`
Expected: no output.

- [ ] **Step 4: Verify with wrangler dev + curl**

Start `npx wrangler dev` in the background.

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"secret123"}'
```
Expected: `200`, `user.team_id: null`, `user.role: null` (using the account from Task 5's signup test).

```bash
curl -s "http://localhost:8787/api/v3/events/startathon/auth/google/callback?code=fake&state=fake"
```
Expected: `400` "Failed to exchange authorization code" (dummy Google credentials — proves routing/config path; real account-creation-on-Google-login can only be verified post-deploy with real Google Console config).

Stop wrangler dev; confirm port 8787 free.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/v3/events/startathon/login.ts src/endpoints/v3/events/startathon/googleCallback.ts
git commit -m "feat(startathon): nullable team state in login, Google signup-or-login"
```

---

### Task 7: Create team endpoint

**Files:**
- Create: `src/endpoints/v3/events/startathon/createTeam.ts`
- Modify: `src/endpoints/v3/index.ts`

**Interfaces:**
- Consumes: `requireStartathonAuth` (Task 3); `StartathonCreateTeamRequest`, `StartathonCreateTeamResponse`, `ErrorResponse` (Task 2).
- Produces: `StartathonCreateTeam` route class at `POST /api/v3/events/startathon/team`.

- [ ] **Step 1: Create `src/endpoints/v3/events/startathon/createTeam.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonCreateTeamRequest,
  StartathonCreateTeamResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * POST /api/v3/events/startathon/team
 * Create a team. Caller becomes the leader. Caller must not already
 * be on a team.
 */
export class StartathonCreateTeam extends OpenAPIRoute {
  schema = {
    summary: "Create a Startathon team",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonCreateTeamRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Team created",
        content: {
          "application/json": {
            schema: StartathonCreateTeamResponse,
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
      "409": {
        description: "Already on a team, or team name taken",
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

      if (user.team_id) {
        return c.json(
          { success: false, error: "You already have a team" },
          409,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { team_name } = data.body;

      const existingTeam = await c.env.EVENTS_DB.prepare(
        "SELECT team_id FROM startathon_teams WHERE team_name = ?",
      )
        .bind(team_name)
        .first();
      if (existingTeam) {
        return c.json(
          { success: false, error: "Team name is already taken" },
          409,
        );
      }

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
    } catch (error) {
      console.error("Startathon create team error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 2: Register the route in `src/endpoints/v3/index.ts`**

Add import:
```typescript
import { StartathonCreateTeam } from "./events/startathon/createTeam";
```

Add route (after the signup route):
```typescript
openapi.post("/events/startathon/team", StartathonCreateTeam);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "createTeam.ts|index.ts"`
Expected: no output.

- [ ] **Step 4: Verify with wrangler dev + curl**

Start `npx wrangler dev`. Sign up a fresh user and create a team:

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob-leader@test.com","password":"secret123","phone":"9999999992","college":"SCT"}'
```
Save the `access_token` as `<LEADER_TOKEN>`.

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/team \
  -H "Content-Type: application/json" -H "Authorization: Bearer <LEADER_TOKEN>" \
  -d '{"team_name":"Byte Force"}'
```
Expected: `201`, `team_id` starting `ST_`, `join_code` present (8 chars), `status: "payment-pending"`.

Repeat the same request → expected `409` "You already have a team".

Stop wrangler dev; confirm port 8787 free.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/v3/events/startathon/createTeam.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): create team endpoint"
```

---

### Task 8: Rewrite get-my-team endpoint

**Files:**
- Modify: `src/endpoints/v3/events/startathon/getTeam.ts`

**Interfaces:**
- Consumes: `requireStartathonAuth` (Task 3); `StartathonTeamResponse` with `join_code` (Task 2).
- Produces: same route class, handles `team_id: null` and includes `join_code`.

- [ ] **Step 1: Rewrite `src/endpoints/v3/events/startathon/getTeam.ts`**

Replace the entire file content:

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonTeamResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * GET /api/v3/events/startathon/team
 * Get the authenticated user's team, members, and payment status.
 * 404 if the caller has no team yet.
 */
export class StartathonGetTeam extends OpenAPIRoute {
  schema = {
    summary: "Get my Startathon team",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Team details",
        content: {
          "application/json": {
            schema: StartathonTeamResponse,
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
      "404": {
        description: "Caller has no team yet",
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

      if (!user.team_id || !user.role) {
        return c.json(
          { success: false, error: "You don't have a team yet" },
          404,
        );
      }

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
    } catch (error) {
      console.error("Startathon get team error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep getTeam`
Expected: no output.

- [ ] **Step 3: Verify with wrangler dev + curl**

Start `npx wrangler dev`. Using `<LEADER_TOKEN>` from Task 7:

```bash
curl -s http://localhost:8787/api/v3/events/startathon/team \
  -H "Authorization: Bearer <LEADER_TOKEN>"
```
Expected: `200`, `team_name: "Byte Force"`, `join_code` present, `your_role: "leader"`, one member (Bob).

Sign up a second fresh user (no team) and check:
```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Carol","email":"carol-noteam@test.com","password":"secret123","phone":"9999999993","college":"SCT"}'
```
Save `access_token` as `<NOTEAM_TOKEN>`.
```bash
curl -s http://localhost:8787/api/v3/events/startathon/team \
  -H "Authorization: Bearer <NOTEAM_TOKEN>"
```
Expected: `404` "You don't have a team yet".

Stop wrangler dev; confirm port 8787 free.

- [ ] **Step 4: Commit**

```bash
git add src/endpoints/v3/events/startathon/getTeam.ts
git commit -m "feat(startathon): handle teamless users and expose join_code in get-team"
```

---

### Task 9: Invite member endpoint

**Files:**
- Create: `src/endpoints/v3/events/startathon/inviteMember.ts`
- Modify: `src/endpoints/v3/index.ts`

**Interfaces:**
- Consumes: `requireStartathonAuth` (Task 3); `StartathonInviteRequest`, `ErrorResponse` (Task 2); `EmailService.sendStartathonAccountSetupInviteEmail`, `EmailService.sendStartathonInviteReceivedEmail` (Task 4).
- Produces: `StartathonInviteMember` route class at `POST /api/v3/events/startathon/team/invite`.

- [ ] **Step 1: Create `src/endpoints/v3/events/startathon/inviteMember.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonInviteRequest,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { EmailService } from "../../../../services/emailService";

const TEAM_CAP = 4;

/**
 * POST /api/v3/events/startathon/team/invite
 * Leader invites someone by email. If no account exists for that
 * email, one is created (still teamless — not a member until they
 * accept). Either way, a pending invite is created and an email sent.
 */
export class StartathonInviteMember extends OpenAPIRoute {
  schema = {
    summary: "Invite someone to my Startathon team",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonInviteRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Invite created",
        content: {},
      },
      "400": {
        description: "Team full, or name missing for a new invitee",
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
        description: "Only the team leader can invite",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Invitee already on a team or already invited",
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

      if (!user.team_id) {
        return c.json(
          { success: false, error: "You don't have a team yet" },
          404,
        );
      }
      if (user.role !== "leader") {
        return c.json(
          { success: false, error: "Only the team leader can invite" },
          403,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { email, name } = data.body;
      const normalizedEmail = email.toLowerCase();

      const countResult = await c.env.EVENTS_DB.prepare(
        "SELECT COUNT(*) as cnt FROM startathon_users WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();
      if ((countResult?.cnt as number) >= TEAM_CAP) {
        return c.json({ success: false, error: "Team is full" }, 400);
      }

      let invitee = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_users WHERE email = ?",
      )
        .bind(normalizedEmail)
        .first();

      const now = Math.floor(Date.now() / 1000);
      let isNewAccount = false;

      if (!invitee) {
        if (!name) {
          return c.json(
            { success: false, error: "name required for new invitee" },
            400,
          );
        }
        isNewAccount = true;
        const newUserId = `STU_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

        await c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_users (user_id, name, email, created_at)
           VALUES (?, ?, ?, ?)`,
        )
          .bind(newUserId, name, normalizedEmail, now)
          .run();

        invitee = await c.env.EVENTS_DB.prepare(
          "SELECT * FROM startathon_users WHERE user_id = ?",
        )
          .bind(newUserId)
          .first();
      } else if (invitee.team_id) {
        return c.json(
          { success: false, error: "This person is already on a team" },
          409,
        );
      } else {
        const existingInvite = await c.env.EVENTS_DB.prepare(
          "SELECT invite_id FROM startathon_invites WHERE team_id = ? AND invited_email = ? AND status = 'pending'",
        )
          .bind(user.team_id, normalizedEmail)
          .first();
        if (existingInvite) {
          return c.json(
            { success: false, error: "This person is already invited" },
            409,
          );
        }
      }

      if (!invitee) {
        return c.json(
          { success: false, error: "Internal server error" },
          500,
        );
      }

      const inviteId = `INV_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      await c.env.EVENTS_DB.prepare(
        `INSERT INTO startathon_invites (invite_id, team_id, invited_email, invited_by, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      )
        .bind(inviteId, user.team_id, normalizedEmail, user.user_id, now)
        .run();

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT team_name FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();
      const teamName = (team?.team_name as string) || "";

      try {
        const emailService = new EmailService(c.env.BREVO_API_KEY);
        if (isNewAccount) {
          const resetToken = crypto.randomUUID();
          await c.env.EVENTS_DB.prepare(
            `INSERT INTO startathon_reset_tokens (token, user_id, expires_at, created_at)
             VALUES (?, ?, ?, ?)`,
          )
            .bind(resetToken, invitee.user_id, now + 7 * 24 * 60 * 60, now)
            .run();

          await emailService.sendStartathonAccountSetupInviteEmail(
            invitee.name as string,
            invitee.email as string,
            teamName,
            user.name,
            resetToken,
          );
        } else {
          await emailService.sendStartathonInviteReceivedEmail(
            invitee.name as string,
            invitee.email as string,
            teamName,
            user.name,
          );
        }
      } catch (emailError) {
        console.error("Startathon invite email error:", emailError);
      }

      console.log("Startathon invite created:", {
        invite_id: inviteId,
        team_id: user.team_id,
        invited_email: normalizedEmail,
      });

      return c.json(
        {
          success: true,
          data: { invite_id: inviteId },
          message: "Invite sent.",
        },
        201,
      );
    } catch (error) {
      console.error("Startathon invite error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 2: Register the route in `src/endpoints/v3/index.ts`**

Add import:
```typescript
import { StartathonInviteMember } from "./events/startathon/inviteMember";
```

Add route:
```typescript
openapi.post("/events/startathon/team/invite", StartathonInviteMember);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "inviteMember.ts|index.ts"`
Expected: no output.

- [ ] **Step 4: Verify with wrangler dev + curl**

Start `npx wrangler dev`. Using `<LEADER_TOKEN>` from Task 7 (leader of "Byte Force"):

Invite a brand-new email:
```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/team/invite \
  -H "Content-Type: application/json" -H "Authorization: Bearer <LEADER_TOKEN>" \
  -d '{"email":"dave-new@test.com","name":"Dave"}'
```
Expected: `201`, `invite_id` starting `INV_`. Confirm the account was created teamless:
```bash
npx wrangler d1 execute scc_treasure_hunt_registrations --local --command "SELECT user_id, team_id, role FROM startathon_users WHERE email='dave-new@test.com'"
```
Expected: one row, `team_id` NULL, `role` NULL.

Invite the same email again → expected `409` "This person is already invited".

Invite `carol-noteam@test.com` (exists, teamless, from Task 8) without a `name` → expected `201` (name ignored/not required for existing accounts).

Invite without `name` for a truly new email → expected `400` "name required for new invitee".

Stop wrangler dev; confirm port 8787 free.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/v3/events/startathon/inviteMember.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): invite member endpoint"
```

---

### Task 10: Join team by code endpoint

**Files:**
- Create: `src/endpoints/v3/events/startathon/joinTeam.ts`
- Modify: `src/endpoints/v3/index.ts`

**Interfaces:**
- Consumes: `requireStartathonAuth` (Task 3); `StartathonJoinTeamRequest`, `ErrorResponse` (Task 2).
- Produces: `StartathonJoinTeam` route class at `POST /api/v3/events/startathon/team/join`.

- [ ] **Step 1: Create `src/endpoints/v3/events/startathon/joinTeam.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonJoinTeamRequest,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

const TEAM_CAP = 4;

/**
 * POST /api/v3/events/startathon/team/join
 * Join a team using its join_code. Immediate — no accept step, since
 * entering the code is itself the consent action.
 */
export class StartathonJoinTeam extends OpenAPIRoute {
  schema = {
    summary: "Join a Startathon team by code",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonJoinTeamRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Joined the team",
        content: {},
      },
      "400": {
        description: "Team is full",
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
      "404": {
        description: "Invalid join code",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Already on a team",
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

      if (user.team_id) {
        return c.json(
          { success: false, error: "You already have a team" },
          409,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { join_code } = data.body;

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT team_id, team_name FROM startathon_teams WHERE join_code = ?",
      )
        .bind(join_code)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Invalid join code" }, 404);
      }

      const countResult = await c.env.EVENTS_DB.prepare(
        "SELECT COUNT(*) as cnt FROM startathon_users WHERE team_id = ?",
      )
        .bind(team.team_id)
        .first();
      if ((countResult?.cnt as number) >= TEAM_CAP) {
        return c.json({ success: false, error: "Team is full" }, 400);
      }

      await c.env.EVENTS_DB.prepare(
        "UPDATE startathon_users SET team_id = ?, role = 'member' WHERE user_id = ?",
      )
        .bind(team.team_id, user.user_id)
        .run();

      console.log("Startathon joined team:", {
        user_id: user.user_id,
        team_id: team.team_id,
      });

      return c.json({
        success: true,
        message: `Joined team "${team.team_name as string}".`,
      });
    } catch (error) {
      console.error("Startathon join team error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 2: Register the route in `src/endpoints/v3/index.ts`**

Add import:
```typescript
import { StartathonJoinTeam } from "./events/startathon/joinTeam";
```

Add route:
```typescript
openapi.post("/events/startathon/team/join", StartathonJoinTeam);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "joinTeam.ts|index.ts"`
Expected: no output.

- [ ] **Step 4: Verify with wrangler dev + curl**

Start `npx wrangler dev`. Get `<LEADER_TOKEN>`'s team join_code from `GET /team` (Task 8), then join as Carol (`<NOTEAM_TOKEN>` from Task 8):

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/team/join \
  -H "Content-Type: application/json" -H "Authorization: Bearer <NOTEAM_TOKEN>" \
  -d '{"join_code":"<JOIN_CODE>"}'
```
Expected: `200` "Joined team...".

Repeat with the same token → expected `409` "You already have a team".

Try a bogus code with a fresh signed-up user → expected `404` "Invalid join code".

Stop wrangler dev; confirm port 8787 free.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/v3/events/startathon/joinTeam.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): join team by code endpoint"
```

---

### Task 11: List my invites endpoint

**Files:**
- Create: `src/endpoints/v3/events/startathon/listInvites.ts`
- Modify: `src/endpoints/v3/index.ts`

**Interfaces:**
- Consumes: `requireStartathonAuth` (Task 3); `StartathonInvitesResponse`, `ErrorResponse` (Task 2).
- Produces: `StartathonListInvites` route class at `GET /api/v3/events/startathon/invites`.

- [ ] **Step 1: Create `src/endpoints/v3/events/startathon/listInvites.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonInvitesResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * GET /api/v3/events/startathon/invites
 * List the caller's own pending invites (matched by their email).
 */
export class StartathonListInvites extends OpenAPIRoute {
  schema = {
    summary: "List my pending Startathon invites",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Pending invites",
        content: {
          "application/json": {
            schema: StartathonInvitesResponse,
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

      const invites = await c.env.EVENTS_DB.prepare(
        `SELECT i.invite_id, i.created_at, t.team_name, u.name as invited_by_name
         FROM startathon_invites i
         JOIN startathon_teams t ON t.team_id = i.team_id
         JOIN startathon_users u ON u.user_id = i.invited_by
         WHERE i.invited_email = ? AND i.status = 'pending'
         ORDER BY i.created_at DESC`,
      )
        .bind(user.email)
        .all();

      return c.json({
        success: true,
        data: {
          invites: invites.results.map((i) => ({
            invite_id: i.invite_id as string,
            team_name: i.team_name as string,
            invited_by: i.invited_by_name as string,
            created_at: i.created_at as number,
          })),
        },
      });
    } catch (error) {
      console.error("Startathon list invites error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 2: Register the route in `src/endpoints/v3/index.ts`**

Add import:
```typescript
import { StartathonListInvites } from "./events/startathon/listInvites";
```

Add route:
```typescript
openapi.get("/events/startathon/invites", StartathonListInvites);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "listInvites.ts|index.ts"`
Expected: no output.

- [ ] **Step 4: Verify with wrangler dev + curl**

Start `npx wrangler dev`. Sign up Dave (the account created teamless by Task 9's invite) — set his password first:

```bash
npx wrangler d1 execute scc_treasure_hunt_registrations --local --command "SELECT t.token FROM startathon_reset_tokens t JOIN startathon_users u ON u.user_id = t.user_id WHERE u.email = 'dave-new@test.com' LIMIT 1"
```
```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/auth/password/reset/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<TOKEN>","new_password":"secret123"}'
```
```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dave-new@test.com","password":"secret123"}'
```
Save `access_token` as `<DAVE_TOKEN>`.

```bash
curl -s http://localhost:8787/api/v3/events/startathon/invites \
  -H "Authorization: Bearer <DAVE_TOKEN>"
```
Expected: `200`, one invite for team "Byte Force", `invited_by: "Bob"`.

Stop wrangler dev; confirm port 8787 free.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/v3/events/startathon/listInvites.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): list my invites endpoint"
```

---

### Task 12: Accept and decline invite endpoints

**Files:**
- Create: `src/endpoints/v3/events/startathon/acceptInvite.ts`
- Create: `src/endpoints/v3/events/startathon/declineInvite.ts`
- Modify: `src/endpoints/v3/index.ts`

**Interfaces:**
- Consumes: `requireStartathonAuth` (Task 3); `ErrorResponse` (Task 2).
- Produces: `StartathonAcceptInvite`, `StartathonDeclineInvite` route classes at `POST /api/v3/events/startathon/invites/:id/accept` and `.../decline`.

- [ ] **Step 1: Create `src/endpoints/v3/events/startathon/acceptInvite.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

const TEAM_CAP = 4;

/**
 * POST /api/v3/events/startathon/invites/:id/accept
 * Accept a pending invite addressed to the caller's email. Joins the
 * team and auto-cancels the caller's other pending invites.
 */
export class StartathonAcceptInvite extends OpenAPIRoute {
  schema = {
    summary: "Accept a Startathon team invite",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The invite ID to accept",
      },
    ],
    responses: {
      "200": {
        description: "Joined the team",
        content: {},
      },
      "400": {
        description: "Team is full",
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
      "404": {
        description: "Invite not found or not addressed to caller",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Already on a team, or invite no longer pending",
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

      if (user.team_id) {
        return c.json(
          { success: false, error: "You already have a team" },
          409,
        );
      }

      const inviteId = c.req.param("id");

      const invite = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_invites WHERE invite_id = ? AND invited_email = ?",
      )
        .bind(inviteId, user.email)
        .first();

      if (!invite) {
        return c.json({ success: false, error: "Invite not found" }, 404);
      }
      if (invite.status !== "pending") {
        return c.json(
          { success: false, error: "This invite is no longer pending" },
          409,
        );
      }

      const countResult = await c.env.EVENTS_DB.prepare(
        "SELECT COUNT(*) as cnt FROM startathon_users WHERE team_id = ?",
      )
        .bind(invite.team_id)
        .first();
      if ((countResult?.cnt as number) >= TEAM_CAP) {
        return c.json({ success: false, error: "Team is full" }, 400);
      }

      const now = Math.floor(Date.now() / 1000);

      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = ?, role = 'member' WHERE user_id = ?",
        ).bind(invite.team_id, user.user_id),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_invites SET status = 'accepted', responded_at = ? WHERE invite_id = ?",
        ).bind(now, inviteId),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_invites SET status = 'cancelled', responded_at = ? WHERE invited_email = ? AND status = 'pending' AND invite_id != ?",
        ).bind(now, user.email, inviteId),
      ]);

      console.log("Startathon invite accepted:", {
        invite_id: inviteId,
        user_id: user.user_id,
        team_id: invite.team_id,
      });

      return c.json({
        success: true,
        message: "Invite accepted. You've joined the team.",
      });
    } catch (error) {
      console.error("Startathon accept invite error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 2: Create `src/endpoints/v3/events/startathon/declineInvite.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * POST /api/v3/events/startathon/invites/:id/decline
 * Decline a pending invite addressed to the caller's email.
 */
export class StartathonDeclineInvite extends OpenAPIRoute {
  schema = {
    summary: "Decline a Startathon team invite",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The invite ID to decline",
      },
    ],
    responses: {
      "200": {
        description: "Invite declined",
        content: {},
      },
      "401": {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Invite not found or not addressed to caller",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Invite no longer pending",
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

      const inviteId = c.req.param("id");

      const invite = await c.env.EVENTS_DB.prepare(
        "SELECT invite_id, status FROM startathon_invites WHERE invite_id = ? AND invited_email = ?",
      )
        .bind(inviteId, user.email)
        .first();

      if (!invite) {
        return c.json({ success: false, error: "Invite not found" }, 404);
      }
      if (invite.status !== "pending") {
        return c.json(
          { success: false, error: "This invite is no longer pending" },
          409,
        );
      }

      const now = Math.floor(Date.now() / 1000);
      await c.env.EVENTS_DB.prepare(
        "UPDATE startathon_invites SET status = 'declined', responded_at = ? WHERE invite_id = ?",
      )
        .bind(now, inviteId)
        .run();

      console.log("Startathon invite declined:", { invite_id: inviteId, user_id: user.user_id });

      return c.json({ success: true, message: "Invite declined." });
    } catch (error) {
      console.error("Startathon decline invite error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 3: Register both routes in `src/endpoints/v3/index.ts`**

Add imports:
```typescript
import { StartathonAcceptInvite } from "./events/startathon/acceptInvite";
import { StartathonDeclineInvite } from "./events/startathon/declineInvite";
```

Add routes:
```typescript
openapi.post("/events/startathon/invites/:id/accept", StartathonAcceptInvite);
openapi.post("/events/startathon/invites/:id/decline", StartathonDeclineInvite);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "acceptInvite.ts|declineInvite.ts|index.ts"`
Expected: no output.

- [ ] **Step 5: Verify with wrangler dev + curl**

Start `npx wrangler dev`. Using `<DAVE_TOKEN>` from Task 11 and the invite from Task 9 (query its ID: `SELECT invite_id FROM startathon_invites WHERE invited_email='dave-new@test.com'`):

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/invites/<INVITE_ID>/accept \
  -H "Authorization: Bearer <DAVE_TOKEN>"
```
Expected: `200` "Invite accepted...". Then `GET /team` with `<DAVE_TOKEN>` shows him as a member of "Byte Force".

Re-accepting (or accepting a bogus ID) → `404`.

For decline: sign up one more fresh user, have the leader invite them, then decline:
```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/team/invite \
  -H "Content-Type: application/json" -H "Authorization: Bearer <LEADER_TOKEN>" \
  -d '{"email":"eve-noteam@test.com","name":"Eve"}'
```
(This will 400 "Team is full" once the team already has 4 members from prior tasks — that's fine, it confirms the cap works. If under the cap, invite an already-signed-up teamless user instead — e.g. sign up `eve-noteam@test.com` first via `/auth/signup`, then invite that email.)

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/invites/<EVE_INVITE_ID>/decline \
  -H "Authorization: Bearer <EVE_TOKEN>"
```
Expected: `200` "Invite declined.". `GET /invites` for Eve afterward shows no pending invites.

Stop wrangler dev; confirm port 8787 free.

- [ ] **Step 6: Commit**

```bash
git add src/endpoints/v3/events/startathon/acceptInvite.ts src/endpoints/v3/events/startathon/declineInvite.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): accept and decline invite endpoints"
```

---

### Task 13: Leave team and kick member endpoints

**Files:**
- Create: `src/endpoints/v3/events/startathon/leaveTeam.ts`
- Create: `src/endpoints/v3/events/startathon/kickMember.ts`
- Modify: `src/endpoints/v3/index.ts`

**Interfaces:**
- Consumes: `requireStartathonAuth` (Task 3); `ErrorResponse` (Task 2).
- Produces: `StartathonLeaveTeam` at `POST /api/v3/events/startathon/team/leave`, `StartathonKickMember` at `POST /api/v3/events/startathon/team/members/:user_id/kick`.

- [ ] **Step 1: Create `src/endpoints/v3/events/startathon/leaveTeam.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * POST /api/v3/events/startathon/team/leave
 * Member: leaves the team (clears their own team_id/role).
 * Leader: deletes the team entirely, freeing every member and
 * cancelling pending invites. Locked once the team is 'confirmed'.
 */
export class StartathonLeaveTeam extends OpenAPIRoute {
  schema = {
    summary: "Leave my Startathon team",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Left the team (or, if leader, deleted it)",
        content: {},
      },
      "401": {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Caller has no team",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Team is confirmed — roster is locked",
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

      if (!user.team_id || !user.role) {
        return c.json(
          { success: false, error: "You don't have a team" },
          404,
        );
      }

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT status FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }
      if (team.status !== "payment-pending") {
        return c.json(
          {
            success: false,
            error: "Team is confirmed — roster is locked",
          },
          409,
        );
      }

      const now = Math.floor(Date.now() / 1000);

      if (user.role === "member") {
        await c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = NULL, role = NULL WHERE user_id = ?",
        )
          .bind(user.user_id)
          .run();

        console.log("Startathon member left team:", {
          user_id: user.user_id,
          team_id: user.team_id,
        });

        return c.json({ success: true, message: "You've left the team." });
      }

      // Leader: delete the team entirely, free every member, cancel invites.
      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = NULL, role = NULL WHERE team_id = ?",
        ).bind(user.team_id),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_invites SET status = 'cancelled', responded_at = ? WHERE team_id = ? AND status = 'pending'",
        ).bind(now, user.team_id),
        c.env.EVENTS_DB.prepare(
          "DELETE FROM startathon_teams WHERE team_id = ?",
        ).bind(user.team_id),
      ]);

      console.log("Startathon leader deleted team:", {
        user_id: user.user_id,
        team_id: user.team_id,
      });

      return c.json({
        success: true,
        message: "Team deleted. All members have been freed.",
      });
    } catch (error) {
      console.error("Startathon leave team error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 2: Create `src/endpoints/v3/events/startathon/kickMember.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * POST /api/v3/events/startathon/team/members/:user_id/kick
 * Leader removes a member from their own team. Cannot target the
 * leader themselves (use /team/leave). Locked once 'confirmed'.
 */
export class StartathonKickMember extends OpenAPIRoute {
  schema = {
    summary: "Kick a member from my Startathon team",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "user_id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The user_id of the member to remove",
      },
    ],
    responses: {
      "200": {
        description: "Member removed",
        content: {},
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
        description: "Only the team leader can kick",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Target is not a member of caller's team",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Team is confirmed — roster is locked",
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

      if (!user.team_id) {
        return c.json(
          { success: false, error: "You don't have a team" },
          404,
        );
      }
      if (user.role !== "leader") {
        return c.json(
          { success: false, error: "Only the team leader can kick" },
          403,
        );
      }

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT status FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();
      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }
      if (team.status !== "payment-pending") {
        return c.json(
          {
            success: false,
            error: "Team is confirmed — roster is locked",
          },
          409,
        );
      }

      const targetUserId = c.req.param("user_id");

      const target = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, role FROM startathon_users WHERE user_id = ? AND team_id = ?",
      )
        .bind(targetUserId, user.team_id)
        .first();

      if (!target || target.role !== "member") {
        return c.json(
          { success: false, error: "That user is not a member of your team" },
          404,
        );
      }

      await c.env.EVENTS_DB.prepare(
        "UPDATE startathon_users SET team_id = NULL, role = NULL WHERE user_id = ?",
      )
        .bind(targetUserId)
        .run();

      console.log("Startathon member kicked:", {
        team_id: user.team_id,
        kicked_user_id: targetUserId,
        by: user.user_id,
      });

      return c.json({ success: true, message: "Member removed from team." });
    } catch (error) {
      console.error("Startathon kick member error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 3: Register both routes in `src/endpoints/v3/index.ts`**

Add imports:
```typescript
import { StartathonLeaveTeam } from "./events/startathon/leaveTeam";
import { StartathonKickMember } from "./events/startathon/kickMember";
```

Add routes:
```typescript
openapi.post("/events/startathon/team/leave", StartathonLeaveTeam);
openapi.post(
  "/events/startathon/team/members/:user_id/kick",
  StartathonKickMember,
);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "leaveTeam.ts|kickMember.ts|index.ts"`
Expected: no output.

- [ ] **Step 5: Verify with wrangler dev + curl**

Start `npx wrangler dev`.

Kick: using `<LEADER_TOKEN>` and Carol's `user_id` (she joined via code in Task 10):
```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/team/members/<CAROL_USER_ID>/kick \
  -H "Authorization: Bearer <LEADER_TOKEN>"
```
Expected: `200` "Member removed...". `GET /team` with `<NOTEAM_TOKEN>`... actually re-login as Carol and confirm `GET /team` now `404`s for her.

Leave: using `<DAVE_TOKEN>` (a member, from Task 12):
```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/team/leave \
  -H "Authorization: Bearer <DAVE_TOKEN>"
```
Expected: `200` "You've left the team.". `GET /team` with `<DAVE_TOKEN>` now `404`s.

Leader delete: using `<LEADER_TOKEN>`:
```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/team/leave \
  -H "Authorization: Bearer <LEADER_TOKEN>"
```
Expected: `200` "Team deleted...". Confirm via D1: `SELECT * FROM startathon_teams WHERE team_id='<TEAM_ID>'` returns no rows.

Locked-after-confirmed case: create a fresh team, ingest+link a ₹100 payment to confirm it (per Task 8/original payment endpoints, unchanged), then attempt `/team/leave` → expected `409` "Team is confirmed — roster is locked".

Stop wrangler dev; confirm port 8787 free.

- [ ] **Step 6: Commit**

```bash
git add src/endpoints/v3/events/startathon/leaveTeam.ts src/endpoints/v3/events/startathon/kickMember.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): leave team and kick member endpoints"
```

---

### Task 14: Final verification + update docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/startathon-api.md`

**Interfaces:**
- Consumes: everything above.
- Produces: verified module + updated docs reflecting the new flow.

- [ ] **Step 1: Full flow re-check on fresh accounts**

With `npx wrangler dev` running, walk the complete happy path end-to-end using brand-new emails not used in earlier tasks:

1. Sign up two users (`frank@test.com`, `grace@test.com`) via `/auth/signup`.
2. Frank creates a team via `POST /team` → note `join_code`.
3. Frank invites `grace@test.com` via `POST /team/invite` (existing account) → confirm `201` and that `GET /invites` for Grace shows the pending invite.
4. Grace accepts via `POST /invites/:id/accept` → confirm `GET /team` for Grace shows her as a member of Frank's team.
5. Frank invites a brand-new email `henry@test.com` with `name: "Henry"` → confirm the account was created teamless and `GET /invites` (after Henry sets a password and logs in) shows the invite.
6. Henry declines via `POST /invites/:id/decline` → confirm `GET /invites` for Henry is now empty and he's still teamless (`GET /team` → `404`).
7. Ingest a ₹100 transaction (`POST /transaction`, unchanged from before) and link it via `POST /payment` as Frank (leader) → confirm `GET /team` shows `status: "confirmed"`.
8. Attempt `POST /team/leave` as Grace → expect `409` "Team is confirmed — roster is locked".

Every response must match the expectations above. If anything deviates, that is a real finding — note it, do not paper over it.

- [ ] **Step 2: Typecheck and dry-run deploy**

Run: `npx tsc --noEmit` — expected: only pre-existing baseline errors (unrelated to any file touched in this plan), zero new ones.
Run: `npx wrangler deploy --dry-run` — expected: bundles successfully, lists routes including all new `startathon` endpoints, no errors, does NOT deploy.

- [ ] **Step 3: Update `CLAUDE.md`**

Find the existing block:
```markdown
### Startathon Module (standalone — client: startathon.sctcoding.club)

Self-contained team registration/auth/payment. Own tables (`startathon_teams`, `startathon_users`, `startathon_reset_tokens`, `startathon_transactions`); shares only Google client credentials, `JWT_SECRET`, Brevo, and the HDFC parser. JWTs carry `aud: "startathon"`.

- `POST /api/v3/events/startathon/register` - Register team (1 leader + 2-3 members, public)
- `POST /api/v3/events/startathon/auth/login` - Email/password login
- `GET /api/v3/events/startathon/auth/google` + `/callback` - Google login (login-only, no signup)
- `POST /api/v3/events/startathon/auth/password/reset` + `/verify` - Password set/reset
- `GET /api/v3/events/startathon/team` - My team + payment status
- `POST /api/v3/events/startathon/transaction` - Webhook ingest (₹100 fee, TOKEN-guarded)
- `POST /api/v3/events/startathon/payment` - Leader links UPI ref, team → confirmed
```

Replace it with:
```markdown
### Startathon Module (standalone — client: startathon.sctcoding.club)

Self-contained account/team/payment system. Own tables (`startathon_teams`, `startathon_users`, `startathon_invites`, `startathon_reset_tokens`, `startathon_transactions`); shares only Google client credentials, `JWT_SECRET`, Brevo, and the HDFC parser. JWTs carry `aud: "startathon"`. Accounts are independent of teams — users sign up first (email/password or Google, both create-or-login), then create or join a team separately.

- `POST /api/v3/events/startathon/auth/signup` - Create account (public, no team assigned)
- `POST /api/v3/events/startathon/auth/login` - Email/password login
- `GET /api/v3/events/startathon/auth/google` + `/callback` - Google sign-up-or-login
- `POST /api/v3/events/startathon/auth/password/reset` + `/verify` - Password set/reset
- `POST /api/v3/events/startathon/team` - Create a team (caller becomes leader)
- `GET /api/v3/events/startathon/team` - My team + payment status (404 if none)
- `POST /api/v3/events/startathon/team/invite` - Leader invites by email (creates account if needed)
- `POST /api/v3/events/startathon/team/join` - Join a team by `join_code`
- `POST /api/v3/events/startathon/team/leave` - Leave (member) or delete the team (leader)
- `POST /api/v3/events/startathon/team/members/:user_id/kick` - Leader removes a member
- `GET /api/v3/events/startathon/invites` - My pending invites
- `POST /api/v3/events/startathon/invites/:id/accept` + `/decline` - Respond to an invite
- `POST /api/v3/events/startathon/transaction` - Webhook ingest (₹100 fee, TOKEN-guarded)
- `POST /api/v3/events/startathon/payment` - Leader links UPI ref, team → confirmed
```

- [ ] **Step 4: Update `docs/startathon-api.md`**

Rewrite this file to describe the new endpoints and flow, following the same style as the current version (base URL, per-endpoint request/response JSON examples, error tables, and a lifecycle diagram at the end reflecting signup → create/join/invite/accept → payment). Base the content on the CLAUDE.md summary from Step 3 and the exact request/response shapes defined in Task 2's schemas and each endpoint task above — do not invent fields not present in the schemas.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/startathon-api.md
git commit -m "docs: document independent signup and team formation endpoints"
```
