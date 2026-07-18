# Startathon API — Frontend Integration Guide

Base URL: `https://api.sctcoding.club/api/v3/events/startathon`

All responses follow `{ success: boolean, data?: ..., error?: string }` (or `{ success, message }` for actions with no payload). All authenticated routes require:

```
Authorization: Bearer <access_token>
```

The token is a 7-day JWT scoped to Startathon (`aud: "startathon"`) — it will not work against the main site's auth, and vice versa.

Accounts are independent of teams: a user signs up (or logs in) first, and creates/joins a team as a separate step. `team_id` and `role` are `null` until they do.

---

## Auth

### `POST /auth/signup`
Create an account with email + password. No team assigned.

Request:
```json
{ "name": "Jane Doe", "email": "jane@x.com", "password": "at-least-8-chars", "phone": "9999999999", "college": "SCT", "gender": "female" }
```
`gender` is required — one of `"male" | "female" | "other"`.

Response `201`:
```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "expires_in": 604800,
    "user": { "user_id": "STU_...", "team_id": null, "role": null, "name": "Jane Doe", "email": "jane@x.com", "phone": "9999999999", "college": "SCT", "gender": "female" }
  }
}
```
`409` if the email is already registered.

### `POST /auth/login`
```json
{ "email": "jane@x.com", "password": "..." }
```
Same response shape as signup. `401 Invalid credentials` for wrong password, unknown email, or an account that has no password set yet (e.g. was created via an invite and hasn't onboarded — see below).

> `gender` can be `null` in the `user` object for accounts that skipped `/auth/signup` — invited users (created nameless/genderless until they onboard) and Google sign-ups (Google doesn't provide gender). Use `PATCH /me` to fill it in.

### `GET /auth/google` → `{ data: { auth_url } }`
Redirect the user to `auth_url`. Google redirects back to `GOOGLE_REDIRECT_URI_STARTATHON` with `?code&state`, which your frontend should forward to:

### `GET /auth/google/callback?code&state`
Sign-up-or-login by Google. Same response shape as signup/login.

### `POST /auth/google/credential`
For Google Identity Services (One Tap / rendered button) flows that hand you an ID token directly instead of a redirect.
```json
{ "credential": "<google id_token>" }
```
Same response shape as signup/login.

### `POST /auth/password/reset`
Request a reset email. Always returns `200` regardless of whether the email exists (no enumeration).
```json
{ "email": "jane@x.com" }
```

### `POST /auth/password/reset/verify`
Complete a reset **or** finish account setup for an invited user (the invite email links here with a token). `name` is optional and only needed the first time — an invited account has no name until this step or a Google login fills it in.
```json
{ "token": "...", "new_password": "at-least-8-chars", "name": "Jane Doe" }
```
`200` on success, `400` for an invalid/expired token.

> **Important for the invite flow:** when someone is invited by email who doesn't have an account yet, we create one for them with no password and no name. They can't log in with a password until they complete this step, and can't log in at all until then except via Google (which auto-fills their name from their Google profile). Your "set up your account" screen (reached from the invite email) should collect `name` + `new_password` and call this endpoint.

---

## My account

### `GET /me`
```json
{ "success": true, "data": { "user_id": "...", "team_id": "...|null", "role": "leader|member|null", "name": "...", "email": "...", "phone": "...|null", "college": "...|null", "gender": "male|female|other|null" } }
```

### `PATCH /me`
Update your own name/phone/college/gender. Email is not editable. Send only the fields you want to change.
```json
{ "name": "New Name", "phone": "9999999999", "college": "SCT", "gender": "other" }
```
`400` if the body has no valid fields.

---

## Team

### `POST /team`
Create a team. Caller becomes leader. Fails `409` if you're already on a team, or the team name is taken.
```json
{ "team_name": "The Byte Club" }
```
Response `201`: `{ team_id, team_name, join_code, referral_code, status: "payment-pending" }`.

### `GET /team`
Full team snapshot — 404 if you have no team.
```json
{
  "success": true,
  "data": {
    "team_id": "ST_...",
    "team_name": "The Byte Club",
    "join_code": "ABC12345",
    "referral_code": "XYZ98765",
    "referred_by": "ST_...|null",
    "expected_fee": 100,
    "referral_count": 3,
    "status": "payment-pending|confirmed",
    "transaction_ref": "...|null",
    "created_at": 1737000000,
    "your_role": "leader|member",
    "members": [
      { "user_id": "STU_...", "name": "Jane Doe", "email": "jane@x.com", "role": "leader" }
    ],
    "invites": [
      { "invite_id": "INV_...", "email": "invitee@x.com", "status": "pending", "created_at": 1737000100 }
    ]
  }
}
```
Notes:
- `invites` only lists **pending** invites (not yet accepted/declined/cancelled) — use it to render an "invited, awaiting response" row alongside `members` in your team roster UI. Accepted invites simply show up in `members` instead.
- `referral_count` is only populated (non-null) when `your_role === "leader"`.
- `expected_fee` reflects the referral discount automatically (₹90 vs ₹100).

### `POST /team/join`
Join by code — immediate, no accept step.
```json
{ "join_code": "ABC12345" }
```
`400` team full, `404` invalid code, `409` already on a team.

### `POST /team/leave`
No body. If you're a member, this just leaves. **If you're the leader, this deletes the team entirely** — every member is freed and pending invites are cancelled. Locked (`409`) once the team is `confirmed`.

### `POST /team/members/:user_id/kick`
Leader-only. Removes a member. Cannot target the leader (use leave instead). Locked once `confirmed`.

---

## Invites

### `POST /team/invite`
Leader-only. Invite by email. No `name` field — if the person doesn't have an account yet, one is created for them (teamless, nameless, no password) and they get an "account setup" email with a link into `/auth/password/reset/verify`. If they already have an account, they get a plain "you've been invited" email.
```json
{ "email": "invitee@x.com" }
```
`201` on success. `400` team full. `409` invitee already on a team, or already has a pending invite from your team.

### `POST /team/invite/:id/cancel` — **new**
Leader-only. Cancels one of your team's own pending invites (`id` = `invite_id`, from the `invites` array in `GET /team`). Use this to let a leader retract an invite before it's accepted — e.g. they mistyped the email or changed their mind about who to add.
```
POST /team/invite/INV_.../cancel
```
`200` `{ success: true, message: "Invite cancelled." }`.
`404` if the invite doesn't exist, isn't pending anymore, or doesn't belong to your team.
`403` if you're not the leader.

There was previously no way to do this — an invite could only leave `pending` by the invitee accepting/declining, or implicitly (auto-cancelled if the invitee joined a different team or accepted a different invite). This endpoint is now live.

### `GET /invites`
The caller's own pending invites (matched by their email — i.e. invites *received*, not sent).
```json
{ "success": true, "data": { "invites": [ { "invite_id": "INV_...", "team_name": "The Byte Club", "invited_by": "Jane Doe", "created_at": 1737000100 } ] } }
```

### `POST /invites/:id/accept`
Joins the team the invite is for; auto-cancels the caller's other pending invites. `400` team full, `404` not found/not yours, `409` invite no longer pending or you already have a team.

### `POST /invites/:id/decline`
`200` on success. `404`/`409` same as accept.

---

## Referral & payment

### `PUT /team/referral`
Leader-only. Apply another team's referral code before paying, for a discount (₹90 vs ₹100). Callable repeatedly while `payment-pending`.
```json
{ "referral_code": "XYZ98765" }
```
`200` `{ data: { referred_by, expected_fee: 90 } }`. `400` invalid/self code or already paid.

### `POST /payment`
Leader-only. Link the team's UPI transaction ref once the payment webhook has recorded it. Amount must match `expected_fee` exactly. On success, team → `confirmed`, roster locks, confirmation emails go to all members.
```json
{ "transaction_id": "..." }
```
`400` transaction not found/already used, or wrong amount / team already paid.

---

## Team status lifecycle

```
payment-pending  →  confirmed
```
While `payment-pending`: roster is editable (invite/kick/leave/join all work), referral code can be applied/changed.
Once `confirmed`: roster is locked — `team/leave` and `team/members/:id/kick` return `409`. Invites can still be viewed but new ones would be pointless since the team is done.

## Error shape

Every non-2xx response is:
```json
{ "success": false, "error": "human-readable message" }
```
Status codes are meaningful (401 unauth, 403 wrong role, 404 not found, 409 conflict, 400 bad input/state) — branch UI on the code, not just the string.
