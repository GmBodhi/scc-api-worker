# Startathon Registration Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-contained team registration, auth, and payment module for the Startathon event under `/api/v3/events/startathon/*`, per `docs/superpowers/specs/2026-07-11-startathon-registration-design.md`.

**Architecture:** Standalone tables in EVENTS_DB (`startathon_teams`, `startathon_users`, `startathon_reset_tokens`, `startathon_transactions`). `startathon_users` doubles as the auth table — every account belongs to a team. Auth uses its own JWT flavor (`aud: "startathon"`, 7-day expiry, no refresh tokens) and its own Google OAuth callback on `startathon.sctcoding.club`, reusing only the Google client credentials. Endpoints follow the existing chanfana `OpenAPIRoute` class pattern.

**Tech Stack:** Cloudflare Workers, Hono + chanfana, Zod, D1 (EVENTS_DB), Brevo via existing `EmailService`.

## Global Constraints

- Team = exactly 1 leader + 2–3 members (3–4 people). Enforced by Zod (`members: min(2).max(3)`).
- `startathon_users.team_id` is `NOT NULL`; `email` and `google_id` are `UNIQUE` — no user without a team, one team per email.
- Team fee: flat **₹100** — transaction ingest rejects any other amount.
- Team status values: `'payment-pending'` → `'confirmed'`. Transaction status values: `'unused'` → `'used'`.
- Startathon JWTs: signed with existing `JWT_SECRET`, MUST carry `aud: "startathon"`, 7-day expiry (`604800` s). Main-site tokens must be rejected by startathon middleware.
- Password hashing: SHA-256 hex via Web Crypto (matches existing codebase convention — see `src/endpoints/v3/auth/login.ts:73-79`).
- Emails are always non-fatal: wrap in try/catch, `console.error` on failure, never fail the request.
- Google OAuth: reuse `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; redirect URI from new var `GOOGLE_REDIRECT_URI_STARTATHON` (`https://startathon.sctcoding.club/auth/google/callback`). Callback NEVER creates accounts (403 for unknown emails).
- Do NOT touch existing tables, `src/middleware/auth.ts`, `src/utils/jwt.ts`, or GENERAL_DB.
- No test framework exists in this repo. Each task verifies with `npx tsc --noEmit` (typecheck) and, where marked, curl against `npx wrangler dev` (local D1). ALWAYS run typecheck before committing.
- ID formats: team `ST_<Date.now()>_<6-char-rand>`, user `STU_<Date.now()>_<6-char-rand>` (rand = `Math.random().toString(36).substring(2, 8).toUpperCase()`).
- Emails are stored and compared lowercased.
- Commit after every task with the message given in the task.

**Local dev setup (once, not committed):** `.dev.vars` already exists and is gitignored. Ensure it contains at least `JWT_SECRET=devsecret`, `TOKEN=devtoken`, `BREVO_API_KEY=dummy`, `GOOGLE_CLIENT_ID=dummy`, `GOOGLE_CLIENT_SECRET=dummy`. Apply local migrations before curl testing: `npx wrangler d1 migrations apply scc_treasure_hunt_registrations --local`. Start dev server with `npx wrangler dev` (serves on `http://localhost:8787`, v3 API at `/api/v3`). With `BREVO_API_KEY=dummy`, email sends fail and log errors — that is expected and non-fatal.

---

### Task 1: Database migrations

**Files:**
- Create: `migrations/events/0015_create_startathon_teams_table.sql`
- Create: `migrations/events/0016_create_startathon_users_table.sql`
- Create: `migrations/events/0017_create_startathon_reset_tokens_table.sql`
- Create: `migrations/events/0018_create_startathon_transactions_table.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: the four tables exactly as below; all later tasks depend on these column names.

- [ ] **Step 1: Write the four migration files**

`migrations/events/0015_create_startathon_teams_table.sql`:

```sql
CREATE TABLE startathon_teams (
  team_id         TEXT PRIMARY KEY,
  team_name       TEXT NOT NULL UNIQUE,
  leader_id       TEXT NOT NULL,
  transaction_ref TEXT,
  status          TEXT NOT NULL DEFAULT 'payment-pending',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER
);
```

`migrations/events/0016_create_startathon_users_table.sql`:

```sql
CREATE TABLE startathon_users (
  user_id       TEXT PRIMARY KEY,
  team_id       TEXT NOT NULL REFERENCES startathon_teams(team_id),
  role          TEXT NOT NULL CHECK (role IN ('leader','member')),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  college       TEXT,
  password_hash TEXT,
  google_id     TEXT UNIQUE,
  created_at    INTEGER NOT NULL
);

CREATE INDEX idx_startathon_users_team_id ON startathon_users (team_id);
```

`migrations/events/0017_create_startathon_reset_tokens_table.sql`:

```sql
CREATE TABLE startathon_reset_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

`migrations/events/0018_create_startathon_transactions_table.sql`:

```sql
CREATE TABLE startathon_transactions (
  id        TEXT PRIMARY KEY,
  vpa       TEXT NOT NULL,
  amount    REAL NOT NULL,
  date      TEXT NOT NULL,
  ref       TEXT NOT NULL UNIQUE,
  status    TEXT NOT NULL DEFAULT 'unused',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

- [ ] **Step 2: Apply locally and verify**

Run: `npx wrangler d1 migrations apply scc_treasure_hunt_registrations --local`
Expected: lists and applies migrations 0015–0018 with `🚣 Executed ... commands` and no errors.

Run: `npx wrangler d1 execute scc_treasure_hunt_registrations --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'startathon_%'"`
Expected: rows for `startathon_wl` (pre-existing), `startathon_teams`, `startathon_users`, `startathon_reset_tokens`, `startathon_transactions`.

- [ ] **Step 3: Commit**

```bash
git add migrations/events/0015_create_startathon_teams_table.sql migrations/events/0016_create_startathon_users_table.sql migrations/events/0017_create_startathon_reset_tokens_table.sql migrations/events/0018_create_startathon_transactions_table.sql
git commit -m "feat(startathon): add teams, users, reset tokens, transactions tables"
```

> Deployment note (do NOT run now): production applies via `npm run migrate:events:remote`.

---

### Task 2: Zod schemas in types.ts

**Files:**
- Modify: `src/types.ts` (append at end of file)

**Interfaces:**
- Consumes: existing `z` import and `ErrorResponse` already in `src/types.ts`.
- Produces (exact names later tasks import from `../../../../types`): `StartathonMemberInput`, `StartathonRegisterRequest`, `StartathonRegisterResponse`, `StartathonLoginRequest`, `StartathonAuthResponse`, `StartathonPasswordResetRequestSchema`, `StartathonPasswordResetVerifySchema`, `StartathonTeamResponse`, `StartathonPaymentRequest`.

- [ ] **Step 1: Append the schemas to `src/types.ts`**

```typescript
// ============================================================
// Startathon (standalone module — startathon.sctcoding.club)
// ============================================================

export const StartathonMemberInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(10).max(15).optional(),
  college: z.string().min(1).max(150).optional(),
});

export const StartathonRegisterRequest = z.object({
  team_name: z.string().min(2).max(60),
  leader: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().min(10).max(15),
    college: z.string().min(1).max(150),
  }),
  members: z.array(StartathonMemberInput).min(2).max(3),
});

export const StartathonParticipant = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["leader", "member"]),
});

export const StartathonRegisterResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      team_id: z.string(),
      team_name: z.string(),
      status: z.string(),
      participants: z.array(StartathonParticipant),
    })
    .optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const StartathonLoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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

export const StartathonPasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const StartathonPasswordResetVerifySchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8).max(100),
});

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

export const StartathonPaymentRequest = z.object({
  transaction_id: z.string().min(1),
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(startathon): add request/response zod schemas"
```

---

### Task 3: Startathon JWT utility + auth middleware

**Files:**
- Create: `src/utils/startathonJwt.ts`
- Create: `src/middleware/startathonAuth.ts`

**Interfaces:**
- Consumes: `AppContext` from `src/types.ts`; `c.env.JWT_SECRET`, `c.env.EVENTS_DB`.
- Produces:
  - `generateStartathonJWT(userId: string, email: string, name: string, secret: string, expiresIn?: number): Promise<string>` (default `expiresIn` = 604800)
  - `verifyStartathonJWT(token: string, secret: string): Promise<StartathonJWTPayload | null>` — returns null unless `aud === "startathon"`
  - `hashPassword(password: string): Promise<string>` — SHA-256 hex
  - `requireStartathonAuth(c: AppContext): Promise<StartathonAuthResult>` where `StartathonAuthResult = { success: boolean; user?: StartathonAuthUser; error?: string }` and `StartathonAuthUser = { user_id: string; team_id: string; role: "leader" | "member"; name: string; email: string; phone: string | null; college: string | null }`

- [ ] **Step 1: Create `src/utils/startathonJwt.ts`**

Self-contained on purpose — the startathon module must not depend on `src/utils/jwt.ts` internals (its helpers are unexported, and its payload shape differs).

```typescript
/**
 * Startathon JWT — standalone token flavor for the startathon module.
 * Signed with the shared JWT_SECRET but carries aud: "startathon" so
 * main-site tokens and startathon tokens are not interchangeable.
 */

export interface StartathonJWTPayload {
  sub: string; // startathon_users.user_id
  email: string;
  name: string;
  aud: "startathon";
  iat: number;
  exp: number;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return atob(str);
}

async function createSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

export async function generateStartathonJWT(
  userId: string,
  email: string,
  name: string,
  secret: string,
  expiresIn: number = 7 * 24 * 60 * 60, // 7 days
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };
  const payload: StartathonJWTPayload = {
    sub: userId,
    email,
    name,
    aud: "startathon",
    iat: now,
    exp: now + expiresIn,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;
  const signature = await createSignature(dataToSign, secret);

  return `${dataToSign}.${signature}`;
}

export async function verifyStartathonJWT(
  token: string,
  secret: string,
): Promise<StartathonJWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, payloadEncoded, signature] = parts;
    const expectedSignature = await createSignature(
      `${headerEncoded}.${payloadEncoded}`,
      secret,
    );
    if (signature !== expectedSignature) {
      return null;
    }

    const payload: StartathonJWTPayload = JSON.parse(
      base64UrlDecode(payloadEncoded),
    );

    // Reject main-site tokens (no aud) and anything else
    if (payload.aud !== "startathon") {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error("Startathon JWT verification error:", error);
    return null;
  }
}

/** SHA-256 hex — same convention as the rest of the codebase. */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

- [ ] **Step 2: Create `src/middleware/startathonAuth.ts`**

```typescript
/**
 * Startathon Authentication Middleware
 * Standalone: authenticates against startathon_users in EVENTS_DB.
 * Only accepts JWTs with aud: "startathon".
 */

import { type AppContext } from "../types";
import { verifyStartathonJWT } from "../utils/startathonJwt";

export interface StartathonAuthUser {
  user_id: string;
  team_id: string;
  role: "leader" | "member";
  name: string;
  email: string;
  phone: string | null;
  college: string | null;
}

export interface StartathonAuthResult {
  success: boolean;
  user?: StartathonAuthUser;
  error?: string;
}

export async function requireStartathonAuth(
  c: AppContext,
): Promise<StartathonAuthResult> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { success: false, error: "Missing or invalid authorization header" };
  }

  const payload = await verifyStartathonJWT(
    authHeader.substring(7),
    c.env.JWT_SECRET,
  );
  if (!payload) {
    return { success: false, error: "Invalid or expired token" };
  }

  const user = await c.env.EVENTS_DB.prepare(
    "SELECT user_id, team_id, role, name, email, phone, college FROM startathon_users WHERE user_id = ?",
  )
    .bind(payload.sub)
    .first();

  if (!user) {
    return { success: false, error: "User not found" };
  }

  return {
    success: true,
    user: {
      user_id: user.user_id as string,
      team_id: user.team_id as string,
      role: user.role as "leader" | "member",
      name: user.name as string,
      email: user.email as string,
      phone: (user.phone as string) || null,
      college: (user.college as string) || null,
    },
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/utils/startathonJwt.ts src/middleware/startathonAuth.ts
git commit -m "feat(startathon): add aud-scoped JWT util and auth middleware"
```

---

### Task 4: Email templates + EmailService methods

**Files:**
- Create: `src/templates/startathon-account-setup.ts`
- Create: `src/templates/startathon-password-reset.ts`
- Create: `src/templates/startathon-payment-confirmation.ts`
- Modify: `src/services/emailService.ts` (add imports + three methods)

**Interfaces:**
- Consumes: existing `EmailService.sendEmail` private method (already used by every other send method — add methods in the same style, before the private `sendEmail`).
- Produces (methods later tasks call):
  - `sendStartathonAccountSetupEmail(name: string, email: string, teamName: string, teamId: string, role: string, resetToken: string): Promise<boolean>`
  - `sendStartathonPasswordResetEmail(name: string, email: string, resetToken: string): Promise<boolean>`
  - `sendStartathonPaymentConfirmationEmail(name: string, email: string, teamName: string, teamId: string, transactionRef: string): Promise<boolean>`

- [ ] **Step 1: Create `src/templates/startathon-account-setup.ts`**

Dark theme consistent with `src/templates/startathon-waitlist-confirmation.ts`. Set-password links point at the startathon subdomain.

```typescript
const CLIENT_URL = "https://startathon.sctcoding.club";

interface StartathonAccountSetupData {
  name: string;
  teamName: string;
  teamId: string;
  role: string;
  resetToken: string;
}

export function getStartathonAccountSetupEmail(
  data: StartathonAccountSetupData,
): string {
  const { name, teamName, teamId, role, resetToken } = data;
  const setupUrl = `${CLIENT_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your team is registered for Startathon</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#ffffff;">Startathon<span style="color:#888888;">.</span></p>
              <h1 style="margin:20px 0 12px;font-size:22px;color:#ffffff;">You're in, ${name}!</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#bbbbbb;">
                Your team <strong style="color:#ffffff;">${teamName}</strong> has been registered for Startathon.
                You joined as <strong style="color:#ffffff;">${role}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:13px;color:#888888;">Team ID: <span style="color:rgba(200,255,0,0.9);font-family:monospace;">${teamId}</span></p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#bbbbbb;">
                Set a password to access your team dashboard. You can also sign in with Google using this email address.
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

- [ ] **Step 2: Create `src/templates/startathon-password-reset.ts`**

```typescript
const CLIENT_URL = "https://startathon.sctcoding.club";

interface StartathonPasswordResetData {
  name: string;
  resetToken: string;
}

export function getStartathonPasswordResetEmail(
  data: StartathonPasswordResetData,
): string {
  const { name, resetToken } = data;
  const resetUrl = `${CLIENT_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Startathon password</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#ffffff;">Startathon<span style="color:#888888;">.</span></p>
              <h1 style="margin:20px 0 12px;font-size:22px;color:#ffffff;">Password reset</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#bbbbbb;">
                Hi ${name}, we received a request to reset your Startathon password. Click below to choose a new one.
              </p>
              <a href="${resetUrl}" style="display:inline-block;background:rgba(200,255,0,0.9);color:#000000;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">Reset password</a>
              <p style="margin:24px 0 0;font-size:12px;color:#666666;">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
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

- [ ] **Step 3: Create `src/templates/startathon-payment-confirmation.ts`**

```typescript
interface StartathonPaymentConfirmationData {
  name: string;
  teamName: string;
  teamId: string;
  transactionRef: string;
}

export function getStartathonPaymentConfirmationEmail(
  data: StartathonPaymentConfirmationData,
): string {
  const { name, teamName, teamId, transactionRef } = data;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Startathon payment confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#ffffff;">Startathon<span style="color:#888888;">.</span></p>
              <h1 style="margin:20px 0 12px;font-size:22px;color:#ffffff;">Payment confirmed &#127881;</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#bbbbbb;">
                Hi ${name}, payment for your team <strong style="color:#ffffff;">${teamName}</strong> is confirmed. You're all set for Startathon.
              </p>
              <p style="margin:0;font-size:13px;color:#888888;">Team ID: <span style="color:rgba(200,255,0,0.9);font-family:monospace;">${teamId}</span></p>
              <p style="margin:8px 0 0;font-size:13px;color:#888888;">UPI Ref: <span style="color:rgba(200,255,0,0.9);font-family:monospace;">${transactionRef}</span></p>
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

- [ ] **Step 4: Wire into `src/services/emailService.ts`**

Add to the import block at the top of the file (import directly from templates, since `templateLoader` re-exports are only needed where variables get remapped — these don't):

```typescript
import { getStartathonAccountSetupEmail } from "../templates/startathon-account-setup";
import { getStartathonPasswordResetEmail } from "../templates/startathon-password-reset";
import { getStartathonPaymentConfirmationEmail } from "../templates/startathon-payment-confirmation";
```

Add these three methods to the `EmailService` class (next to the other `send*` methods, before the private `sendEmail`):

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

  async sendStartathonPasswordResetEmail(
    name: string,
    email: string,
    resetToken: string,
  ): Promise<boolean> {
    const html = getStartathonPasswordResetEmail({ name, resetToken });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: "🔐 Reset your Startathon password",
      html,
    });
  }

  async sendStartathonPaymentConfirmationEmail(
    name: string,
    email: string,
    teamName: string,
    teamId: string,
    transactionRef: string,
  ): Promise<boolean> {
    const html = getStartathonPaymentConfirmationEmail({
      name,
      teamName,
      teamId,
      transactionRef,
    });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: "🎉 Startathon payment confirmed!",
      html,
    });
  }
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/templates/startathon-account-setup.ts src/templates/startathon-password-reset.ts src/templates/startathon-payment-confirmation.ts src/services/emailService.ts
git commit -m "feat(startathon): add account setup, password reset, payment emails"
```

---

### Task 5: Team registration endpoint

**Files:**
- Create: `src/endpoints/v3/events/startathon/register.ts`
- Modify: `src/endpoints/v3/index.ts` (import + route)

**Interfaces:**
- Consumes: `StartathonRegisterRequest`, `StartathonRegisterResponse`, `ErrorResponse` from types (Task 2); `EmailService.sendStartathonAccountSetupEmail` (Task 4); tables from Task 1.
- Produces: `StartathonRegister` route class at `POST /api/v3/events/startathon/register`.

- [ ] **Step 1: Create `src/endpoints/v3/events/startathon/register.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonRegisterRequest,
  StartathonRegisterResponse,
  ErrorResponse,
} from "../../../../types";
import { EmailService } from "../../../../services/emailService";

/**
 * POST /api/v3/events/startathon/register
 * Register a Startathon team: 1 leader + 2-3 members (public, no auth).
 * Creates startathon accounts for every participant and emails each a
 * set-password link. Team starts as 'payment-pending'.
 */
export class StartathonRegister extends OpenAPIRoute {
  schema = {
    summary: "Register a Startathon team",
    description:
      "Register a team of 1 leader + 2-3 members. Every participant gets a Startathon account and a set-password email. Team fee is ₹100, payable by the leader after registration.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonRegisterRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Team registered",
        content: {
          "application/json": {
            schema: StartathonRegisterResponse,
          },
        },
      },
      "400": {
        description: "Validation error (member count, duplicate emails in payload)",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Team name taken or email already on a team",
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
      const { team_name, leader, members } = data.body;

      const emails = [leader.email, ...members.map((m) => m.email)].map((e) =>
        e.toLowerCase(),
      );
      if (new Set(emails).size !== emails.length) {
        return c.json(
          { success: false, error: "Duplicate emails in the team" },
          400,
        );
      }

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

      const placeholders = emails.map(() => "?").join(", ");
      const existingUser = await c.env.EVENTS_DB.prepare(
        `SELECT email FROM startathon_users WHERE email IN (${placeholders})`,
      )
        .bind(...emails)
        .first();
      if (existingUser) {
        return c.json(
          {
            success: false,
            error: `${existingUser.email} is already registered on a team`,
          },
          409,
        );
      }

      const now = Math.floor(Date.now() / 1000);
      const rand = () =>
        Math.random().toString(36).substring(2, 8).toUpperCase();
      const teamId = `ST_${Date.now()}_${rand()}`;

      const participants = [
        { ...leader, role: "leader" as const },
        ...members.map((m) => ({ ...m, role: "member" as const })),
      ].map((p) => ({
        ...p,
        user_id: `STU_${Date.now()}_${rand()}`,
        email: p.email.toLowerCase(),
      }));

      const leaderId = participants[0].user_id;

      // Team + all users in one atomic batch — no partial teams
      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_teams (team_id, team_name, leader_id, status, created_at)
           VALUES (?, ?, ?, 'payment-pending', ?)`,
        ).bind(teamId, team_name, leaderId, now),
        ...participants.map((p) =>
          c.env.EVENTS_DB.prepare(
            `INSERT INTO startathon_users (user_id, team_id, role, name, email, phone, college, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            p.user_id,
            teamId,
            p.role,
            p.name,
            p.email,
            p.phone ?? null,
            p.college ?? null,
            now,
          ),
        ),
      ]);

      // Account-setup emails (non-fatal, token valid 7 days)
      const emailService = new EmailService(c.env.BREVO_API_KEY);
      for (const p of participants) {
        try {
          const token = crypto.randomUUID();
          await c.env.EVENTS_DB.prepare(
            `INSERT INTO startathon_reset_tokens (token, user_id, expires_at, created_at)
             VALUES (?, ?, ?, ?)`,
          )
            .bind(token, p.user_id, now + 7 * 24 * 60 * 60, now)
            .run();

          const sent = await emailService.sendStartathonAccountSetupEmail(
            p.name,
            p.email,
            team_name,
            teamId,
            p.role,
            token,
          );
          if (!sent) {
            console.error(`Failed to send setup email to ${p.email}`);
          }
        } catch (emailError) {
          console.error("Startathon setup email error:", emailError);
        }
      }

      console.log("Startathon team registered:", {
        team_id: teamId,
        team_name,
        size: participants.length,
      });

      return c.json(
        {
          success: true,
          data: {
            team_id: teamId,
            team_name,
            status: "payment-pending",
            participants: participants.map((p) => ({
              user_id: p.user_id,
              name: p.name,
              email: p.email,
              role: p.role,
            })),
          },
          message:
            "Team registered. Check your inboxes to set passwords, then complete the ₹100 payment to confirm.",
        },
        201,
      );
    } catch (error) {
      console.error("Startathon register error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 2: Register the route in `src/endpoints/v3/index.ts`**

Add with the other events imports:

```typescript
import { StartathonRegister } from "./events/startathon/register";
```

Add after the `openapi.post("/events/startathon/waitlist", StartathonWaitlist);` line:

```typescript
// Startathon (standalone module — startathon.sctcoding.club)
openapi.post("/events/startathon/register", StartathonRegister);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify with wrangler dev + curl**

Start: `npx wrangler dev` (background). Then:

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/register \
  -H "Content-Type: application/json" \
  -d '{"team_name":"Test Team","leader":{"name":"Alice","email":"alice@test.com","phone":"9999999991","college":"SCT"},"members":[{"name":"Bob","email":"bob@test.com"},{"name":"Carol","email":"carol@test.com"}]}'
```

Expected: `201` with `success: true`, a `team_id` starting `ST_`, 3 participants (roles leader/member/member), status `payment-pending`. (Email errors in the dev log are expected with a dummy Brevo key.)

Repeat the same curl → expected `409` "Team name is already taken".
Send with only 1 member → expected `400` Zod validation error.
Send with a different team name but `alice@test.com` as a member → expected `409` "...already registered on a team".

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/v3/events/startathon/register.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): team registration endpoint"
```

---

### Task 6: Login + password reset endpoints

**Files:**
- Create: `src/endpoints/v3/events/startathon/login.ts`
- Create: `src/endpoints/v3/events/startathon/passwordResetRequest.ts`
- Create: `src/endpoints/v3/events/startathon/passwordResetVerify.ts`
- Modify: `src/endpoints/v3/index.ts` (imports + routes)

**Interfaces:**
- Consumes: `StartathonLoginRequest`, `StartathonAuthResponse`, `StartathonPasswordResetRequestSchema`, `StartathonPasswordResetVerifySchema`, `ErrorResponse` (Task 2); `generateStartathonJWT`, `hashPassword` (Task 3); `EmailService.sendStartathonPasswordResetEmail` (Task 4).
- Produces: `StartathonLogin`, `StartathonPasswordResetRequest`, `StartathonPasswordResetVerify` route classes.

- [ ] **Step 1: Create `src/endpoints/v3/events/startathon/login.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonLoginRequest,
  StartathonAuthResponse,
  ErrorResponse,
} from "../../../../types";
import {
  generateStartathonJWT,
  hashPassword,
} from "../../../../utils/startathonJwt";

/**
 * POST /api/v3/events/startathon/auth/login
 * Login with email and password (startathon accounts only)
 */
export class StartathonLogin extends OpenAPIRoute {
  schema = {
    summary: "Startathon login",
    description:
      "Login with email and password. Returns a 7-day startathon-scoped JWT.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonLoginRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Login successful",
        content: {
          "application/json": {
            schema: StartathonAuthResponse,
          },
        },
      },
      "401": {
        description: "Invalid credentials",
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
      const { email, password } = data.body;

      const user = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_users WHERE email = ?",
      )
        .bind(email.toLowerCase())
        .first();

      // Same error for unknown email / no password set / wrong password
      if (!user || !user.password_hash) {
        return c.json({ success: false, error: "Invalid credentials" }, 401);
      }

      const providedHash = await hashPassword(password);
      if (providedHash !== user.password_hash) {
        return c.json({ success: false, error: "Invalid credentials" }, 401);
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
            team_id: user.team_id as string,
            role: user.role as string,
            name: user.name as string,
            email: user.email as string,
          },
        },
      });
    } catch (error) {
      console.error("Startathon login error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 2: Create `src/endpoints/v3/events/startathon/passwordResetRequest.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonPasswordResetRequestSchema,
  ErrorResponse,
} from "../../../../types";
import { EmailService } from "../../../../services/emailService";

/**
 * POST /api/v3/events/startathon/auth/password/reset
 * Request a password reset email (always returns success — no enumeration)
 */
export class StartathonPasswordResetRequest extends OpenAPIRoute {
  schema = {
    summary: "Request Startathon password reset",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonPasswordResetRequestSchema,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Reset email sent if the account exists",
        content: {},
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
      const { email } = data.body;

      const user = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, name, email FROM startathon_users WHERE email = ?",
      )
        .bind(email.toLowerCase())
        .first();

      if (user) {
        const resetToken = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        await c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_reset_tokens (token, user_id, expires_at, created_at)
           VALUES (?, ?, ?, ?)`,
        )
          .bind(resetToken, user.user_id, now + 900, now) // 15 minutes
          .run();

        try {
          const emailService = new EmailService(c.env.BREVO_API_KEY);
          await emailService.sendStartathonPasswordResetEmail(
            user.name as string,
            user.email as string,
            resetToken,
          );
        } catch (emailError) {
          console.error("Startathon reset email error:", emailError);
        }
      } else {
        console.log(
          "Startathon password reset for non-existent email:",
          email,
        );
      }

      return c.json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      console.error("Startathon password reset request error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 3: Create `src/endpoints/v3/events/startathon/passwordResetVerify.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonPasswordResetVerifySchema,
  ErrorResponse,
} from "../../../../types";
import { hashPassword } from "../../../../utils/startathonJwt";

/**
 * POST /api/v3/events/startathon/auth/password/reset/verify
 * Set a new password using a token from the setup or reset email.
 * Tokens are single-use: deleted after a successful reset.
 */
export class StartathonPasswordResetVerify extends OpenAPIRoute {
  schema = {
    summary: "Complete Startathon password reset",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonPasswordResetVerifySchema,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Password set successfully",
        content: {},
      },
      "400": {
        description: "Invalid or expired token",
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
      const { token, new_password } = data.body;

      const resetToken = await c.env.EVENTS_DB.prepare(
        "SELECT token, user_id, expires_at FROM startathon_reset_tokens WHERE token = ?",
      )
        .bind(token)
        .first();

      if (!resetToken) {
        return c.json({ success: false, error: "Invalid reset token" }, 400);
      }

      const now = Math.floor(Date.now() / 1000);
      if ((resetToken.expires_at as number) < now) {
        return c.json(
          { success: false, error: "Reset token has expired" },
          400,
        );
      }

      const passwordHash = await hashPassword(new_password);

      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET password_hash = ? WHERE user_id = ?",
        ).bind(passwordHash, resetToken.user_id),
        c.env.EVENTS_DB.prepare(
          "DELETE FROM startathon_reset_tokens WHERE token = ?",
        ).bind(token),
      ]);

      console.log(
        "Startathon password set for user:",
        resetToken.user_id,
      );

      return c.json({
        success: true,
        message: "Password set successfully. You can now log in.",
      });
    } catch (error) {
      console.error("Startathon password reset verify error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 4: Register routes in `src/endpoints/v3/index.ts`**

Add imports:

```typescript
import { StartathonLogin } from "./events/startathon/login";
import { StartathonPasswordResetRequest } from "./events/startathon/passwordResetRequest";
import { StartathonPasswordResetVerify } from "./events/startathon/passwordResetVerify";
```

Add after the startathon register route:

```typescript
openapi.post("/events/startathon/auth/login", StartathonLogin);
openapi.post(
  "/events/startathon/auth/password/reset",
  StartathonPasswordResetRequest,
);
openapi.post(
  "/events/startathon/auth/password/reset/verify",
  StartathonPasswordResetVerify,
);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Verify the full auth loop with curl**

With `npx wrangler dev` running and the team from Task 5 registered, grab a token straight from the local DB (simulating the email link):

```bash
npx wrangler d1 execute scc_treasure_hunt_registrations --local --command "SELECT t.token FROM startathon_reset_tokens t JOIN startathon_users u ON u.user_id = t.user_id WHERE u.email = 'alice@test.com' LIMIT 1"
```

Then (substituting `<TOKEN>`):

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/auth/password/reset/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<TOKEN>","new_password":"secret123"}'
```

Expected: `200` `success: true`.

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"secret123"}'
```

Expected: `200` with `access_token` (save it for Task 7 verification), `expires_in: 604800`, `role: "leader"`.

Wrong password → `401` "Invalid credentials". Re-using the same reset token → `400` "Invalid reset token" (deleted). `POST .../auth/password/reset` with `{"email":"alice@test.com"}` → `200` generic message (dev log shows email error with dummy key — fine).

- [ ] **Step 7: Commit**

```bash
git add src/endpoints/v3/events/startathon/login.ts src/endpoints/v3/events/startathon/passwordResetRequest.ts src/endpoints/v3/events/startathon/passwordResetVerify.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): login and password reset endpoints"
```

---

### Task 7: Get-my-team endpoint

**Files:**
- Create: `src/endpoints/v3/events/startathon/getTeam.ts`
- Modify: `src/endpoints/v3/index.ts` (import + route)

**Interfaces:**
- Consumes: `requireStartathonAuth` (Task 3); `StartathonTeamResponse`, `ErrorResponse` (Task 2).
- Produces: `StartathonGetTeam` route class at `GET /api/v3/events/startathon/team`.

- [ ] **Step 1: Create `src/endpoints/v3/events/startathon/getTeam.ts`**

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
 * Get the authenticated user's team, members, and payment status
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

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        // Cannot happen normally: users are only created with a team
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

- [ ] **Step 2: Register route in `src/endpoints/v3/index.ts`**

```typescript
import { StartathonGetTeam } from "./events/startathon/getTeam";
```

```typescript
openapi.get("/events/startathon/team", StartathonGetTeam);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify with curl**

Using the `access_token` from Task 6 Step 6:

```bash
curl -s http://localhost:8787/api/v3/events/startathon/team \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Expected: `200` with team name `Test Team`, `status: "payment-pending"`, `your_role: "leader"`, 3 members with the leader first.

No header → `401`. A main-site token (any JWT without `aud: startathon`) → `401` "Invalid or expired token".

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/v3/events/startathon/getTeam.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): get-my-team endpoint"
```

---

### Task 8: Transaction ingest + payment linking

**Files:**
- Create: `src/endpoints/v3/events/startathon/transactionIngest.ts`
- Create: `src/endpoints/v3/events/startathon/linkPayment.ts`
- Modify: `src/endpoints/v3/index.ts` (imports + routes)

**Interfaces:**
- Consumes: `RawTransaction` (already in types, used by v1 ingest), `StartathonPaymentRequest`, `ErrorResponse` (Task 2); `parseTransactionHDFC` from `src/services/transaction.ts`; `requireStartathonAuth` (Task 3); `EmailService.sendStartathonPaymentConfirmationEmail` (Task 4).
- Produces: `StartathonTransactionIngest` and `StartathonLinkPayment` route classes.

- [ ] **Step 1: Create `src/endpoints/v3/events/startathon/transactionIngest.ts`**

Mirrors `src/endpoints/v1/transactionCreate.ts` but writes to `startathon_transactions` and enforces the ₹100 team fee.

```typescript
import { OpenAPIRoute } from "chanfana";
import { type AppContext, RawTransaction } from "../../../../types";
import { parseTransactionHDFC } from "../../../../services/transaction";

const STARTATHON_FEE = 100;

/**
 * POST /api/v3/events/startathon/transaction
 * Webhook ingest for raw bank SMS. Guarded by the shared TOKEN header.
 * Accepts only ₹100 transactions (flat team fee); stores as 'unused'.
 */
export class StartathonTransactionIngest extends OpenAPIRoute {
  schema = {
    summary: "Ingest a Startathon payment transaction (webhook)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: RawTransaction,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Transaction stored",
        content: {},
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const rawTxn = data.body?.data;

    const auth = c.req.header("Authorization");
    if (auth != c.env.TOKEN) {
      c.status(404);
      return c.json({ error: "Not found" });
    }

    const extracted = parseTransactionHDFC(rawTxn);

    if (!extracted || extracted.amount !== STARTATHON_FEE) {
      c.status(400);
      return c.json({ error: "Invalid transaction data" });
    }

    const res = await c.env.EVENTS_DB.prepare(
      "INSERT INTO startathon_transactions (id, vpa, amount, date, ref, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        Math.random().toString(36).substring(2, 10).toUpperCase(),
        extracted.vpa,
        extracted.amount,
        extracted.date,
        extracted.upiRef,
        "unused",
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run()
      .catch((e: Error) => ({ error: true, details: e.message }));

    if ("error" in res) {
      // Most likely the UNIQUE(ref) constraint — duplicate SMS delivery
      console.error("Startathon transaction insert error:", res);
      c.status(400);
      return c.json({ error: "Duplicate or invalid transaction" });
    }

    console.log("Startathon transaction stored:", extracted);
    c.status(201);
    return c.json({ success: true, ref: extracted.upiRef });
  }
}
```

- [ ] **Step 2: Create `src/endpoints/v3/events/startathon/linkPayment.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonPaymentRequest,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { EmailService } from "../../../../services/emailService";

/**
 * POST /api/v3/events/startathon/payment
 * Leader links the team's ₹100 UPI payment. Confirms the team and
 * emails every member.
 */
export class StartathonLinkPayment extends OpenAPIRoute {
  schema = {
    summary: "Link payment to Startathon team",
    description:
      "Team leader submits the UPI reference of the ₹100 team fee. On success the team status becomes 'confirmed'.",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonPaymentRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Payment linked, team confirmed",
        content: {},
      },
      "400": {
        description: "Transaction not found/used, or team not payment-pending",
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
        description: "Only the team leader can link payment",
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
          { success: false, error: "Only the team leader can link payment" },
          403,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { transaction_id } = data.body;

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

      const now = Math.floor(Date.now() / 1000);
      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_transactions SET status = 'used', updatedAt = ? WHERE ref = ?",
        ).bind(new Date().toISOString(), transaction_id),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_teams SET status = 'confirmed', transaction_ref = ?, updated_at = ? WHERE team_id = ?",
        ).bind(transaction_id, now, user.team_id),
      ]);

      // Confirmation email to every member (non-fatal)
      try {
        const members = await c.env.EVENTS_DB.prepare(
          "SELECT name, email FROM startathon_users WHERE team_id = ?",
        )
          .bind(user.team_id)
          .all();

        const emailService = new EmailService(c.env.BREVO_API_KEY);
        for (const m of members.results) {
          const sent = await emailService.sendStartathonPaymentConfirmationEmail(
            m.name as string,
            m.email as string,
            team.team_name as string,
            user.team_id,
            transaction_id,
          );
          if (!sent) {
            console.error(`Failed to send payment email to ${m.email}`);
          }
        }
      } catch (emailError) {
        console.error("Startathon payment email error:", emailError);
      }

      console.log("Startathon payment linked:", {
        team_id: user.team_id,
        ref: transaction_id,
      });

      return c.json({
        success: true,
        message: "Payment linked. Team confirmed — see you at Startathon!",
      });
    } catch (error) {
      console.error("Startathon link payment error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
```

- [ ] **Step 3: Register routes in `src/endpoints/v3/index.ts`**

```typescript
import { StartathonTransactionIngest } from "./events/startathon/transactionIngest";
import { StartathonLinkPayment } from "./events/startathon/linkPayment";
```

```typescript
openapi.post("/events/startathon/transaction", StartathonTransactionIngest);
openapi.post("/events/startathon/payment", StartathonLinkPayment);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Verify the payment flow with curl**

Ingest a fake ₹100 SMS (TOKEN from `.dev.vars`, e.g. `devtoken`):

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/transaction \
  -H "Content-Type: application/json" \
  -H "Authorization: devtoken" \
  -d '{"data":"Rs.100.00 credited to HDFC Bank A/c XX1234 on 11-07-26 from VPA alice@upi (UPI 111122223333)"}'
```

Expected: `201` `{"success":true,"ref":"111122223333"}`.
Wrong token header → `404`. Amount `Rs.50.00` → `400` "Invalid transaction data". Same SMS again → `400` "Duplicate or invalid transaction".

Link it (leader token from Task 6):

```bash
curl -s -X POST http://localhost:8787/api/v3/events/startathon/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"transaction_id":"111122223333"}'
```

Expected: `200` "Payment linked...". Then `GET /api/v3/events/startathon/team` shows `status: "confirmed"` and `transaction_ref: "111122223333"`. Linking again → `400` "Team payment is already completed". A member's token (set bob's password via a reset token, log in, retry) → `403`.

- [ ] **Step 6: Commit**

```bash
git add src/endpoints/v3/events/startathon/transactionIngest.ts src/endpoints/v3/events/startathon/linkPayment.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): transaction ingest and payment linking"
```

---

### Task 9: Google OAuth for the startathon subdomain

**Files:**
- Modify: `wrangler.jsonc` (add var)
- Create: `src/endpoints/v3/events/startathon/googleInitiate.ts`
- Create: `src/endpoints/v3/events/startathon/googleCallback.ts`
- Modify: `src/endpoints/v3/index.ts` (imports + routes)

**Interfaces:**
- Consumes: `GoogleOAuthInitiateResponse` (already in types — generic `{success, data: {auth_url}}`), `ErrorResponse`; `generateStartathonJWT` (Task 3); env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, new `GOOGLE_REDIRECT_URI_STARTATHON`.
- Produces: `StartathonGoogleInitiate`, `StartathonGoogleCallback` route classes.

- [ ] **Step 1: Add the redirect URI var to `wrangler.jsonc`**

In the existing `"vars"` block, add:

```jsonc
		"GOOGLE_REDIRECT_URI_STARTATHON": "https://startathon.sctcoding.club/auth/google/callback",
```

Then regenerate the `Env` type:

Run: `npm run cf-typegen`
Expected: `worker-configuration.d.ts` regenerated; it now contains `GOOGLE_REDIRECT_URI_STARTATHON: string`.

Also add to `.dev.vars` (NOT committed): `GOOGLE_REDIRECT_URI_STARTATHON=http://localhost:8787/auth/google/callback`.

- [ ] **Step 2: Create `src/endpoints/v3/events/startathon/googleInitiate.ts`**

```typescript
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  GoogleOAuthInitiateResponse,
} from "../../../../types";

/**
 * GET /api/v3/events/startathon/auth/google
 * Initiate Google OAuth for startathon.sctcoding.club.
 * Same Google client as the main site; startathon-specific redirect URI.
 */
export class StartathonGoogleInitiate extends OpenAPIRoute {
  schema = {
    summary: "Initiate Startathon Google OAuth",
    responses: {
      "200": {
        description: "OAuth URL generated",
        content: {
          "application/json": {
            schema: GoogleOAuthInitiateResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    try {
      const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI_STARTATHON } = c.env;

      if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI_STARTATHON) {
        return c.json(
          { success: false, error: "Google OAuth not configured" },
          500,
        );
      }

      const state = crypto.randomUUID();

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI_STARTATHON,
        response_type: "code",
        scope: "openid email profile",
        state,
        access_type: "online",
        prompt: "select_account",
      });

      return c.json({
        success: true,
        data: {
          auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        },
      });
    } catch (error) {
      console.error("Startathon Google OAuth initiate error:", error);
      return c.json({ success: false, error: "Failed to initiate OAuth" }, 500);
    }
  }
}
```

- [ ] **Step 3: Create `src/endpoints/v3/events/startathon/googleCallback.ts`**

Login-only: never creates accounts. Matches `startathon_users` by `google_id`, then by email (linking `google_id` on first Google login).

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
 * Login only — unknown emails get 403 (registration is team-based).
 */
export class StartathonGoogleCallback extends OpenAPIRoute {
  schema = {
    summary: "Handle Startathon Google OAuth callback",
    responses: {
      "200": {
        description: "Logged in",
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
      "403": {
        description: "Google account not registered for Startathon",
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
          .bind(googleUser.email.toLowerCase())
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
        return c.json(
          {
            success: false,
            error:
              "This Google account is not registered for Startathon. Ask your team leader to register your email.",
          },
          403,
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
            team_id: user.team_id as string,
            role: user.role as string,
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

- [ ] **Step 4: Register routes in `src/endpoints/v3/index.ts`**

```typescript
import { StartathonGoogleInitiate } from "./events/startathon/googleInitiate";
import { StartathonGoogleCallback } from "./events/startathon/googleCallback";
```

```typescript
openapi.get("/events/startathon/auth/google", StartathonGoogleInitiate);
openapi.get(
  "/events/startathon/auth/google/callback",
  StartathonGoogleCallback,
);
```

- [ ] **Step 5: Typecheck + curl smoke test**

Run: `npx tsc --noEmit` — expected exit 0.

```bash
curl -s http://localhost:8787/api/v3/events/startathon/auth/google
```

Expected: `200` with an `auth_url` containing `redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fauth%2Fgoogle%2Fcallback` and `prompt=select_account`.

```bash
curl -s "http://localhost:8787/api/v3/events/startathon/auth/google/callback?code=fake&state=fake"
```

Expected: `400` "Failed to exchange authorization code" (proves routing + config path; a real end-to-end Google login can only be tested after deploy + Console setup).

- [ ] **Step 6: Commit**

```bash
git add wrangler.jsonc worker-configuration.d.ts src/endpoints/v3/events/startathon/googleInitiate.ts src/endpoints/v3/events/startathon/googleCallback.ts src/endpoints/v3/index.ts
git commit -m "feat(startathon): google oauth for startathon subdomain"
```

> Manual step for the human (post-deploy): in Google Cloud Console, add `https://startathon.sctcoding.club/auth/google/callback` as an authorized redirect URI on the existing OAuth client.

---

### Task 10: Final verification + docs

**Files:**
- Modify: `CLAUDE.md` (document the new module)

**Interfaces:**
- Consumes: everything above.
- Produces: verified module + updated docs.

- [ ] **Step 1: Full flow re-check**

With `npx wrangler dev` running, walk the complete happy path end-to-end on a FRESH team (new emails/team name): register → fetch setup token from local DB → set password → login → get team (`payment-pending`) → ingest ₹100 transaction → link payment → get team (`confirmed`). Every response must match the expectations listed in Tasks 5–8.

- [ ] **Step 2: Typecheck and dry-run deploy**

Run: `npx tsc --noEmit` — expected exit 0.
Run: `npx wrangler deploy --dry-run` — expected: bundles successfully, lists routes, no errors, does NOT deploy.

- [ ] **Step 3: Document in CLAUDE.md**

Add under the "### API Endpoints" section:

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

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document startathon module endpoints"
```

> Deployment checklist for the human (not part of this plan's execution): `npm run migrate:events:remote`, `wrangler deploy`, add the redirect URI in Google Cloud Console, point the startathon client at these endpoints.
