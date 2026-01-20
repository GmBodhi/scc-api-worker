# Password Reset API

## Overview

Two-step password reset flow:

1. **Request Reset** - User provides email, receives reset link
2. **Verify & Reset** - User clicks link, provides new password

---

## 1. Request Password Reset

### Endpoint

```
POST /api/v3/auth/password/reset
```

**Authentication**: Not required

### Request

```json
{
  "email": "user@example.com"
}
```

### Response (200)

```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Security Note**: Always returns success to prevent email enumeration attacks.

---

## 2. Complete Password Reset

### Endpoint

```
POST /api/v3/auth/password/reset/verify
```

**Authentication**: Not required

### Request

```json
{
  "token": "reset-token-from-email",
  "new_password": "newSecurePassword123"
}
```

**Validation**:

- `token`: Required
- `new_password`: Minimum 8 characters

### Success Response (200)

```json
{
  "success": true,
  "message": "Password has been reset successfully. Please login with your new password."
}
```

### Error Responses

#### Invalid Token (400)

```json
{
  "success": false,
  "error": "Invalid reset token"
}
```

#### Expired Token (400)

```json
{
  "success": false,
  "error": "Reset token has expired"
}
```

#### Already Used (400)

```json
{
  "success": false,
  "error": "Reset token has already been used"
}
```

---

## Usage Flow

### 1. User Requests Reset

```typescript
const response = await fetch(
  "https://api.sctcoding.club/api/v3/auth/password/reset",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@example.com" }),
  },
);

const data = await response.json();
// Always returns success message
```

### 2. User Receives Email

Email contains:

- Reset link: `https://sctcoding.club/reset-password?token=<reset-token>`
- Expiry time: 15 minutes
- Security tips

### 3. User Completes Reset

```typescript
const response = await fetch(
  "https://api.sctcoding.club/api/v3/auth/password/reset/verify",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: tokenFromURL,
      new_password: "newSecurePassword123",
    }),
  },
);

const data = await response.json();
if (data.success) {
  // Redirect to login page
}
```

---

## Security Features

✅ **Email Enumeration Prevention**: Request endpoint always returns success  
✅ **Token Expiry**: Reset tokens expire in 15 minutes  
✅ **Single Use**: Tokens can only be used once  
✅ **Session Invalidation**: All existing sessions are terminated after reset  
✅ **Secure Tokens**: UUID v4 tokens (cryptographically random)

---

## React Example

```typescript
// Request reset
const handleRequestReset = async (email: string) => {
  const response = await fetch("/api/v3/auth/password/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();
  if (data.success) {
    setMessage("Check your email for reset instructions");
  }
};

// Complete reset
const handleCompleteReset = async (token: string, password: string) => {
  const response = await fetch("/api/v3/auth/password/reset/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      new_password: password,
    }),
  });

  const data = await response.json();
  if (data.success) {
    navigate("/login");
  } else {
    setError(data.error);
  }
};
```

---

## Notes

- Reset tokens expire in **15 minutes**
- Tokens are **single-use only**
- All user sessions are invalidated after password reset
- Users must login again with their new password
- Email is sent via Brevo (check spam folder if not received)
