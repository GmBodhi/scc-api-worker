# Authentication API Migration Guide - Frontend

## Overview

The authentication flow has been simplified. EtLab verification is now optional and can be done after account creation.

## Breaking Changes Summary

### ❌ Removed Endpoints

- `POST /api/v3/auth/signup/complete` - No longer needed

### ✅ Updated Endpoints

- `POST /api/v3/auth/signup` - Now accepts password directly (single-step signup)
- `POST /api/v3/auth/etlab/verify` - Now requires authentication (for linking EtLab account)

### 🆕 Enhanced Endpoints

- `POST /api/v3/auth/password/reset` - Now detects first-time setup for EtLab-verified users

---

## Migration Guide

### 1. Regular Signup Flow

#### OLD Flow (2 steps)

```typescript
// Step 1: Create account
const signupResponse = await fetch("/api/v3/auth/etlab/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    name: "John Doe",
  }),
});
const { data } = await signupResponse.json();
// data: { user_id, signup_token, email, name, is_verified: false }

// Step 2: Complete signup with password
const completeResponse = await fetch("/api/v3/auth/signup/complete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    signup_token: data.signup_token,
    password: "securePassword123",
    phone: "+1234567890", // optional
    profile_photo: "data:image/png;base64,...", // optional
  }),
});
const { data: authData } = await completeResponse.json();
// authData: { access_token, refresh_token, expires_in, user }
```

#### NEW Flow (1 step) ✅

```typescript
// Single step: Create account with password
const signupResponse = await fetch("/api/v3/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    name: "John Doe",
    password: "securePassword123", // Now required
    phone: "+1234567890", // optional
    profile_photo: "data:image/png;base64,...", // optional
    profile_photo_filename: "avatar.png", // optional
  }),
});
const { data } = await signupResponse.json();
// data: { access_token, refresh_token, expires_in, user }
// User is immediately logged in!
```

**Response Format:**

```typescript
{
  success: true,
  data: {
    access_token: string,
    refresh_token: string,
    expires_in: 900, // 15 minutes in seconds
    user: {
      id: string,
      email: string,
      name: string,
      phone: string | null,
      profile_photo_url: string | null,
      is_verified: boolean // false for regular signup
    }
  },
  message: "Account created successfully"
}
```

---

### 2. EtLab Verification Flow

#### OLD Flow (During Signup)

```typescript
// Step 1: Verify EtLab credentials (creates account)
const etlabResponse = await fetch("/api/v3/auth/etlab/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "etlab_username",
    password: "etlab_password",
  }),
});
const { data } = await etlabResponse.json();
// data: { user_id, signup_token, name, email, etlab_username, ... }

// Step 2: Complete signup with password
const completeResponse = await fetch("/api/v3/auth/signup/complete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    signup_token: data.signup_token,
    password: "securePassword123",
  }),
});
```

#### NEW Flow (After Account Creation) ✅

```typescript
// Step 1: Regular signup first
const signupResponse = await fetch("/api/v3/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    name: "John Doe",
    password: "securePassword123",
  }),
});
const { data: authData } = await signupResponse.json();
// User is now logged in

// Step 2: Later, verify EtLab (requires authentication)
const etlabResponse = await fetch("/api/v3/auth/etlab/verify", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authData.access_token}`, // ⚠️ Now required!
  },
  body: JSON.stringify({
    username: "etlab_username",
    password: "etlab_password",
  }),
});
const { data: etlabData } = await etlabResponse.json();
// etlabData: { user_id, name, email, etlab_username, is_verified: true, ... }
```

**Response Format:**

```typescript
{
  success: true,
  data: {
    user_id: string,
    name: string | null,
    email: string | null,
    etlab_username: string,
    admission_no: string | null,
    batch: string | null,
    phone: string | null,
    register_no: string | null,
    profile_photo_url: string | null,
    is_verified: true // Now verified!
  },
  message: "EtLab account linked successfully"
}
```

---

### 3. User Profile Updates

All user-related endpoints now include `is_verified` field:

#### GET /api/v3/auth/me

```typescript
{
  success: true,
  data: {
    id: string,
    email: string,
    name: string,
    phone: string | null,
    etlab_username: string | null,
    profile_photo_url: string | null,
    created_at: number,
    is_verified: boolean // ⭐ New field
  }
}
```

#### PUT /api/v3/auth/profile

```typescript
{
  success: true,
  data: {
    id: string,
    email: string,
    name: string,
    phone: string | null,
    etlab_username: string | null,
    profile_photo_url: string | null,
    created_at: number,
    is_verified: boolean // ⭐ New field
  },
  message: "Profile updated successfully"
}
```

---

### 4. Special Case: Existing EtLab Users Without Password

For users who verified EtLab in the old system but never completed signup:

#### Solution: Use Password Reset Flow

```typescript
// Step 1: Request password reset
const resetResponse = await fetch("/api/v3/auth/password/reset", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
  }),
});

// System detects user has no password and sends "Complete Your Account Setup" email

// Step 2: User receives email with reset token
// Step 3: Complete password setup
const verifyResponse = await fetch("/api/v3/auth/password/reset/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token: "reset_token_from_email",
    new_password: "securePassword123",
  }),
});

// Step 4: User can now login
const loginResponse = await fetch("/api/v3/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "securePassword123",
  }),
});
```

---

## UI/UX Recommendations

### 1. Signup Page

```typescript
// Simple form with email, name, password
<form onSubmit={handleSignup}>
  <input type="email" name="email" required />
  <input type="text" name="name" required />
  <input type="password" name="password" minLength={8} required />
  <input type="tel" name="phone" placeholder="Optional" />
  <button type="submit">Sign Up</button>
</form>

// ✅ User is logged in immediately after signup
```

### 2. Profile/Settings Page

```typescript
// Show verification status
{!user.is_verified && (
  <div className="verification-banner">
    <p>Verify your EtLab account to unlock additional features</p>
    <button onClick={openEtlabVerificationModal}>
      Verify EtLab Account
    </button>
  </div>
)}

// EtLab verification modal (for logged-in users)
<Modal>
  <form onSubmit={handleEtlabVerify}>
    <input type="text" name="username" placeholder="EtLab Username" />
    <input type="password" name="password" placeholder="EtLab Password" />
    <button type="submit">Verify</button>
  </form>
</Modal>
```

### 3. Display Verification Badge

```typescript
{user.is_verified && (
  <span className="verified-badge" title="EtLab Verified">
    ✓ Verified
  </span>
)}
```

---

## Error Handling

### Signup Errors

```typescript
try {
  const response = await fetch("/api/v3/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });

  const result = await response.json();

  if (!response.ok) {
    // Handle errors
    switch (response.status) {
      case 400:
        // Email already registered
        setError(result.error); // "Email already registered"
        break;
      case 500:
        setError("Server error. Please try again later.");
        break;
    }
  } else {
    // Success - store tokens
    localStorage.setItem("access_token", result.data.access_token);
    localStorage.setItem("refresh_token", result.data.refresh_token);
    // Redirect to dashboard
  }
} catch (error) {
  setError("Network error. Please check your connection.");
}
```

### EtLab Verification Errors

```typescript
try {
  const response = await fetch("/api/v3/auth/etlab/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`, // Required!
    },
    body: JSON.stringify({ username, password }),
  });

  const result = await response.json();

  if (!response.ok) {
    switch (response.status) {
      case 400:
        setError(result.error); // "Account already verified with EtLab" or "This EtLab account is already linked to another user"
        break;
      case 401:
        setError(result.error); // "Invalid EtLab credentials" or "Authentication required"
        break;
      case 503:
        setError("EtLab service unavailable. Please try again later.");
        break;
      case 504:
        setError("Connection to EtLab timed out. Please try again.");
        break;
    }
  } else {
    // Success - refresh user data
    fetchCurrentUser();
    showSuccessMessage("EtLab account verified successfully!");
  }
} catch (error) {
  setError("Network error. Please check your connection.");
}
```

---

## Testing Checklist

- [ ] Update signup form to include password field
- [ ] Remove any references to `/auth/signup/complete` endpoint
- [ ] Update EtLab verification to require authentication
- [ ] Move EtLab verification UI to profile/settings (not signup flow)
- [ ] Add `is_verified` field to user type definitions
- [ ] Display verification status in UI
- [ ] Test signup → immediate login flow
- [ ] Test signup → later EtLab verification flow
- [ ] Test password reset for users without passwords
- [ ] Update error handling for new response formats
- [ ] Test that existing tokens still work after migration

---

## Database Migration

The backend includes a migration that:

- Adds `is_verified` column to users table
- Automatically marks existing users with `etlab_username` as verified
- No action needed on frontend, but be aware of this field in responses

---

## Timeline

1. **Deploy backend first** - Backend is backward compatible initially
2. **Update frontend** - Use this guide to migrate frontend code
3. **Test thoroughly** - Verify all flows work as expected
4. **Deploy frontend** - Roll out new authentication flow

---

## Support

If you encounter issues:

1. Check that you're using the correct endpoints
2. Verify authentication headers are included where required
3. Check response format matches new schemas
4. Review error messages for specific issues

For questions, contact the backend team.
