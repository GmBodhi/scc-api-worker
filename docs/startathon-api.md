# Startathon API Reference

Base URL: `https://api.sctcoding.club/api/v3/events/startathon`

Client: `startathon.sctcoding.club`

This module is **self-contained**: its own team/user/invite/reset-token/transaction tables in `EVENTS_DB`, its own login and password reset, and its own JWT (`aud: "startathon"`, 7-day expiry). It shares only the Google OAuth client credentials, `JWT_SECRET`, the Brevo email service, and the HDFC SMS parser with the rest of the API. Startathon tokens do not work on main-site endpoints and vice versa.

**Accounts are independent of teams.** A user signs up (or logs in with Google) first and gets a teamless account; they create a team or join one afterward, in a separate step. A user belongs to at most one team at a time.

**Auth header** (where required): `Authorization: Bearer <access_token>`

---

## 1. Sign up

```
POST /auth/signup
```

Public — no auth. Creates an account with email + password. No team is assigned — the account starts teamless. Returns a JWT immediately, same as login.

**Request body**

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "secret123",
  "phone": "9999999991",
  "college": "SCT"
}
```

- `name`: 1–100 characters.
- `password`: 8–100 characters.
- `phone`: 10–15 characters.
- `college`: 1–150 characters.
- Email is lowercased before the uniqueness check.

**201 Created**

```json
{
  "success": true,
  "data": {
    "access_token": "<jwt>",
    "expires_in": 604800,
    "user": {
      "user_id": "STU_...",
      "team_id": null,
      "role": null,
      "name": "Alice",
      "email": "alice@example.com"
    }
  }
}
```

**Errors**
| Status | Cause |
|---|---|
| 400 | Zod validation (missing/short fields, invalid email) |
| 409 | Email already registered |
| 500 | Internal error |

---

## 2. Login

```
POST /auth/login
```

Public. Email + password → 7-day startathon JWT. Same response shape as signup.

**Request**
```json
{ "email": "alice@example.com", "password": "secret123" }
```

**200 OK**
```json
{
  "success": true,
  "data": {
    "access_token": "<jwt>",
    "expires_in": 604800,
    "user": {
      "user_id": "STU_...",
      "team_id": "ST_...",
      "role": "leader",
      "name": "Alice",
      "email": "alice@example.com"
    }
  }
}
```

`team_id`/`role` are `null` for a teamless account.

**401** — `{"success": false, "error": "Invalid credentials"}` for unknown email, no password set yet, or wrong password (same message for all three, to avoid account enumeration).

---

## 3. Google sign-up-or-login

```
GET /auth/google
GET /auth/google/callback
```

Public. Same Google OAuth client as the main site (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), but a dedicated redirect URI (`GOOGLE_REDIRECT_URI_STARTATHON` → `https://startathon.sctcoding.club/auth/google/callback`).

- `GET /auth/google` → `200 { success: true, data: { auth_url } }` — send the user here.
- `GET /auth/google/callback?code=...&state=...` — handled after Google redirects back.

**Creates an account on first login** (unlike the old design). Matches by `google_id`, then falls back to matching by `email` and links `google_id` onto that existing row. If no match, a new teamless account is created (no password set). Response shape is identical to `/auth/login`.

**400** — missing `code`/`state`, failed token exchange, or failed to fetch Google user info.

---

## 4. Password reset

```
POST /auth/password/reset
POST /auth/password/reset/verify
```

Public. Unchanged from before this redesign — same flow covers first-time password setup (after an invite creates a teamless account) and forgotten-password resets.

**`POST /auth/password/reset`**
```json
{ "email": "alice@example.com" }
```
Always `200` with a generic message — does not reveal whether the email exists. If the account exists, emails a reset link with a 15-minute token.

**`POST /auth/password/reset/verify`**
```json
{ "token": "<token-from-email>", "new_password": "newSecret123" }
```
`new_password` must be 8–100 characters. On success (`200`), the token is deleted (single-use) and the password is set. `400` for an invalid or expired token.

---

## 5. Create a team

```
POST /team
```

Requires `Authorization: Bearer <access_token>`. Caller must not already be on a team; becomes the leader.

**Request**
```json
{ "team_name": "Byte Force" }
```
`team_name`: 2–60 characters, globally unique.

**201 Created**
```json
{
  "success": true,
  "data": {
    "team_id": "ST_...",
    "team_name": "Byte Force",
    "join_code": "94QL8SU8",
    "status": "payment-pending"
  }
}
```

**Errors**
| Status | Cause |
|---|---|
| 401 | Missing/invalid token |
| 409 | Caller already has a team, or `team_name` is taken |
| 500 | Internal error |

---

## 6. Get my team

```
GET /team
```

Requires `Authorization: Bearer <access_token>`. `404` if the caller has no team yet.

**200 OK**
```json
{
  "success": true,
  "data": {
    "team_id": "ST_...",
    "team_name": "Byte Force",
    "join_code": "94QL8SU8",
    "status": "payment-pending",
    "transaction_ref": null,
    "created_at": 1752230400,
    "your_role": "leader",
    "members": [
      { "user_id": "STU_...", "name": "Alice", "email": "alice@example.com", "role": "leader" },
      { "user_id": "STU_...", "name": "Bob", "email": "bob@example.com", "role": "member" }
    ]
  }
}
```

Members are ordered leader-first, then alphabetically. A team has 1–4 members (the leader plus up to 3 more).

**401** — missing/invalid/wrong-audience token. **404** — `{"success": false, "error": "You don't have a team yet"}`.

---

## 7. Invite a member

```
POST /team/invite
```

Requires `Authorization: Bearer <access_token>` — **leader only**. If no account exists for the given email, one is created (teamless, no password) and sent a "set your password" email; otherwise the existing (teamless) account is sent an "invite received" email. Either way a pending invite row is created — the invitee is **not** added to the team until they accept.

**Request**
```json
{ "email": "bob@example.com", "name": "Bob" }
```
`name` is **required** if the email has no existing account (used to create it); ignored/optional if the account already exists.

**201 Created**
```json
{
  "success": true,
  "data": { "invite_id": "INV_..." },
  "message": "Invite sent."
}
```

**Errors**
| Status | Cause |
|---|---|
| 400 | Team already has 4 members, or `name` missing for a brand-new invitee |
| 401 | Missing/invalid token |
| 403 | Caller is not the team leader |
| 404 | Caller has no team |
| 409 | Invitee is already on a team, or already has a pending invite from this team |
| 500 | Internal error |

---

## 8. Join a team by code

```
POST /team/join
```

Requires `Authorization: Bearer <access_token>`. Immediate — no accept step, since entering the code is itself the consent action. Caller must not already be on a team.

**Request**
```json
{ "join_code": "94QL8SU8" }
```

**200 OK**
```json
{ "success": true, "message": "Joined team \"Byte Force\"." }
```

**Errors**
| Status | Cause |
|---|---|
| 400 | Team already has 4 members |
| 401 | Missing/invalid token |
| 404 | Invalid join code |
| 409 | Caller already has a team |
| 500 | Internal error |

---

## 9. List my invites

```
GET /invites
```

Requires `Authorization: Bearer <access_token>`. Returns the caller's own pending invites, matched by their account email.

**200 OK**
```json
{
  "success": true,
  "data": {
    "invites": [
      {
        "invite_id": "INV_...",
        "team_name": "Byte Force",
        "invited_by": "Alice",
        "created_at": 1752230400
      }
    ]
  }
}
```

**401** — missing/invalid token.

---

## 10. Accept / decline an invite

```
POST /invites/:id/accept
POST /invites/:id/decline
```

Requires `Authorization: Bearer <access_token>`. The invite must be addressed to the caller's account email and still `pending`.

**Accept** joins the caller to the inviting team (as a member) and auto-cancels any of the caller's *other* pending invites.

**200 OK**
```json
{ "success": true, "message": "Invite accepted. You've joined the team." }
```

**Decline** just marks the invite `declined`; the caller stays teamless.

**200 OK**
```json
{ "success": true, "message": "Invite declined." }
```

**Errors**
| Status | Cause |
|---|---|
| 400 | *(accept only)* Team already has 4 members |
| 401 | Missing/invalid token |
| 404 | Invite not found, or not addressed to the caller |
| 409 | *(accept only)* Caller already has a team; or invite is no longer pending |
| 500 | Internal error |

---

## 11. Leave my team

```
POST /team/leave
```

Requires `Authorization: Bearer <access_token>`. Behavior depends on the caller's role:
- **Member**: leaves the team (their own `team_id`/`role` are cleared). Team and other members are unaffected.
- **Leader**: deletes the team entirely — every member is freed (teamless again) and any pending invites for the team are cancelled.

Locked once the team's `status` is no longer `payment-pending` (i.e. `confirmed`).

**200 OK**
```json
{ "success": true, "message": "You've left the team." }
```
(Leader response: `"Team deleted. All members have been freed."`)

**Errors**
| Status | Cause |
|---|---|
| 401 | Missing/invalid token |
| 404 | Caller has no team |
| 409 | Team is confirmed — roster is locked |
| 500 | Internal error |

---

## 12. Kick a member

```
POST /team/members/:user_id/kick
```

Requires `Authorization: Bearer <access_token>` — **leader only**. Cannot target the leader themselves (use `/team/leave` to disband instead). Locked once `confirmed`.

**200 OK**
```json
{ "success": true, "message": "Member removed from team." }
```

**Errors**
| Status | Cause |
|---|---|
| 401 | Missing/invalid token |
| 403 | Caller is not the team leader |
| 404 | Caller has no team, or `:user_id` is not a member of it |
| 409 | Team is confirmed — roster is locked |
| 500 | Internal error |

---

## 13. Transaction ingest (webhook)

```
POST /transaction
```

Internal webhook, not called by the frontend. Guarded by a shared-secret header: `Authorization: <TOKEN>` (raw string equality, not a bearer JWT). Parses a raw HDFC bank SMS and stores it as an unused payment. Unchanged from before this redesign.

**Request**
```json
{ "data": "Rs.100.00 credited to HDFC Bank A/c XX1234 on 11-07-26 from VPA alice@upi (UPI 111122223333)" }
```

Only **₹100** transactions are accepted (the flat team fee). Duplicate UPI refs are rejected (`ref` is unique).

**201** `{ "success": true, "ref": "111122223333" }`
**404** wrong/missing token · **400** wrong amount or duplicate ref.

---

## 14. Link payment

```
POST /payment
```

Requires `Authorization: Bearer <access_token>` — **leader only**. Unchanged from before this redesign, except it no longer requires the team to be "full" — any team with a leader can confirm once it has a valid payment.

**Request**
```json
{ "transaction_id": "111122223333" }
```

Looks up the UPI ref in the ingested transactions; if unused, atomically marks it `used` and the team `confirmed`, and emails every current team member a payment confirmation. Guarded against a race on the same ref (an `UPDATE ... WHERE status='unused'` check-then-act, not a blind write) — if another request already claimed the ref, this returns `400` rather than double-confirming two teams.

**200** `{ "success": true, "message": "Payment linked. Team confirmed — see you at Startathon!" }`

**Errors**
| Status | Cause |
|---|---|
| 400 | Transaction not found / already used, or team already confirmed |
| 401 | Missing/invalid token |
| 403 | Caller is a member, not the leader |
| 500 | Internal error |

---

## Team & user lifecycle

```
auth/signup (or Google) → teamless account
  │
  ├─ POST /team ─────────────────────────────► leader of a new team (payment-pending)
  │
  └─ POST /team/join (join_code)
       or
     GET /invites → POST /invites/:id/accept ─► member of an existing team
       (POST /invites/:id/decline → stays teamless)

team (payment-pending)
  ├─ leader: POST /team/invite (email) ──► invitee: existing account gets an invite;
  │                                        new email gets a teamless account + invite
  ├─ leader: POST /team/members/:user_id/kick ──► member freed (teamless)
  ├─ member: POST /team/leave ──► member freed (teamless)
  ├─ leader: POST /team/leave ──► team deleted, all members freed
  │
  └─ /transaction (webhook, external) → leader: POST /payment
                                              │
                                              ▼
                                     team (confirmed) — roster locked:
                                     /team/leave and /team/members/:id/kick now 409
```

- A `startathon_users` row is created by `/auth/signup`, Google sign-up-or-login, or `/team/invite` (for a brand-new invitee email) — always teamless at creation.
- One team per user at a time; `team_name` is globally unique; a team caps at 4 members (1 leader + up to 3 more).
- `/team/invite` never adds someone to the team directly — it only creates a pending `startathon_invites` row; the invitee must `POST /invites/:id/accept` (or the leader can instead share the `join_code` for `POST /team/join`, which has no accept step).
