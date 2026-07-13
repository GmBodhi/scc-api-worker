# Frontend Migration Guide: Startathon Account (`/me`) Endpoints

## Overview

Two new endpoints and one field addition were added to the Startathon module (`startathon.sctcoding.club`). Nothing existing was removed or renamed — this is purely additive, so no code breaks if you don't touch it. It's documented as a migration guide because there's a `phone`/`college` gap in `signup`/`login`/Google-callback responses worth fixing on the frontend.

Full reference: `docs/startathon-api.md` (§5, §6).

## What Changed

### 1. `phone` and `college` now appear in auth responses

`POST /auth/signup`, `POST /auth/login`, and `GET /auth/google/callback` all now include `phone` and `college` on the returned `user` object. Previously these fields were silently dropped even though they were collected at signup.

```json
// Before
"user": { "user_id": "STU_...", "team_id": null, "role": null, "name": "Alice", "email": "alice@example.com" }

// After
"user": { "user_id": "STU_...", "team_id": null, "role": null, "name": "Alice", "email": "alice@example.com", "phone": "9999999991", "college": "SCT" }
```

Additive — existing code that reads `user.name`/`user.email` etc. keeps working. If you have a TypeScript interface for this `user` shape, add the two optional/nullable fields.

### 2. `GET /me` — fetch the current account

```
GET /api/v3/events/startathon/me
Authorization: Bearer <access_token>
```

Returns the same `user` shape (`user_id`, `team_id`, `role`, `name`, `email`, `phone`, `college`) without needing to re-login or decode the JWT. Use this to hydrate an account/profile page, or to refresh user state after `PATCH /me`.

```javascript
const res = await fetch("https://api.sctcoding.club/api/v3/events/startathon/me", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const { data: user } = await res.json();
```

### 3. `PATCH /me` — update the current account

```
PATCH /api/v3/events/startathon/me
Authorization: Bearer <access_token>
Content-Type: application/json

{ "name": "Alice B.", "phone": "9999999992", "college": "SCT CE" }
```

- Send only the fields you want to change — any subset of `name`, `phone`, `college`.
- **`email` is not editable through this endpoint** (it's the account's unique identifier and invites are matched by it). There is no email-change flow yet — don't build a UI control for it.
- Returns the full updated `user` object on `200`, same shape as `GET /me`.
- `400` if the body has no updatable fields at all (e.g. an empty `{}` or all-`undefined` payload) — validate on the client so you don't send that.

```javascript
const res = await fetch("https://api.sctcoding.club/api/v3/events/startathon/me", {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ college: "SCT CE" }),
});
const { success, data, error } = await res.json();
```

## Migration Steps

1. **Auth response types** — if you have a shared TS type for the startathon `user` object (from signup/login/Google callback), add `phone: string | null` and `college: string | null`.
2. **Profile screen** — if you have (or are building) an account/profile page for startathon users, wire it to `GET /me` on load and `PATCH /me` on save, instead of relying on stale data from the login response or local storage.
3. **No email field in the edit form** — omit `email` from any "edit profile" UI; it's read-only for now.

## Errors

Both endpoints follow the same pattern as the rest of the module: `401` for missing/invalid/expired token (same as every other Startathon endpoint), `500` for unexpected server errors. `PATCH /me` additionally returns `400` for an empty update body or a field failing validation (`name` 1–100 chars, `phone` 10–15 chars, `college` 1–150 chars).
