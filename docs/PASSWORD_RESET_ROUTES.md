# Password Reset Routes

## 1. Request Password Reset

**Endpoint**: `POST /api/v3/auth/password/reset`  
**Authentication**: None required

### Request Body

```json
{
  "email": "user@example.com"
}
```

**Requirements**:

- `email` (string): Valid email format

### Success Response (200)

```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Note**: Always returns success to prevent email enumeration

---

## 2. Complete Password Reset

**Endpoint**: `POST /api/v3/auth/password/reset/verify`  
**Authentication**: None required

### Request Body

```json
{
  "token": "reset-token-from-email",
  "new_password": "newPassword123"
}
```

**Requirements**:

- `token` (string): Reset token from email, minimum 1 character
- `new_password` (string): Minimum 8 characters

### Success Response (200)

```json
{
  "success": true,
  "message": "Password has been reset successfully. Please login with your new password."
}
```

### Error Responses (400)

**Invalid token**:

```json
{
  "success": false,
  "error": "Invalid reset token"
}
```

**Expired token**:

```json
{
  "success": false,
  "error": "Reset token has expired"
}
```

**Already used**:

```json
{
  "success": false,
  "error": "Reset token has already been used"
}
```

---

## Quick Reference

| Route                         | Method | Auth | Body Fields             | Token Expiry |
| ----------------------------- | ------ | ---- | ----------------------- | ------------ |
| `/auth/password/reset`        | POST   | No   | `email`                 | N/A          |
| `/auth/password/reset/verify` | POST   | No   | `token`, `new_password` | 15 min       |
