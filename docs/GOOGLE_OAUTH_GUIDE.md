# Google OAuth Integration Guide

## Overview

Google OAuth provides a secure, one-click authentication method allowing users to sign up or log in using their Google account. The system automatically links Google accounts to existing users with matching emails.

## Flow Diagram

```
Frontend → GET /auth/google → Receive auth_url
    ↓
User redirects to Google consent screen
    ↓
Google redirects to callback URL with code & state
    ↓
Frontend extracts code & state from URL
    ↓
Frontend calls backend callback endpoint
    ↓
Backend returns JWT tokens + user data
```

## Implementation

### Step 1: Initiate OAuth Flow

```typescript
async function initiateGoogleLogin() {
  try {
    const response = await fetch(
      "https://api.sctcoding.club/api/v3/auth/google",
    );
    const data = await response.json();

    if (data.success) {
      // Redirect user to Google consent screen
      window.location.href = data.data.auth_url;
    }
  } catch (error) {
    console.error("Failed to initiate Google OAuth:", error);
  }
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
  }
}
```

### Step 2: Handle OAuth Callback

After Google redirects the user back to your application, extract the `code` and `state` from the URL query parameters and send them to the callback endpoint.

```typescript
// Parse URL params on your callback page
const params = new URLSearchParams(window.location.search);
const code = params.get("code");
const state = params.get("state");

if (!code || !state) {
  console.error("Missing OAuth parameters");
  return;
}

// Exchange code for tokens
async function completeGoogleLogin(code: string, state: string) {
  try {
    const response = await fetch(
      `https://api.sctcoding.club/api/v3/auth/google/callback?code=${code}&state=${state}`,
    );
    const data = await response.json();

    if (data.success) {
      // Store tokens
      localStorage.setItem("access_token", data.data.access_token);
      localStorage.setItem("refresh_token", data.data.refresh_token);

      // Check if new user
      if (data.data.is_new_user) {
        console.log("Welcome new user!");
        // Optionally show onboarding
      }

      // Redirect to dashboard
      window.location.href = "/dashboard";
    } else {
      console.error("OAuth failed:", data.error);
    }
  } catch (error) {
    console.error("Failed to complete Google OAuth:", error);
  }
}

// Call immediately on callback page load
completeGoogleLogin(code, state);
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "550e8400-e29b-41d4-a716-446655440000",
    "expires_in": 3600,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "profile_photo_url": "https://lh3.googleusercontent.com/...",
      "is_verified": true
    },
    "is_new_user": false
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Failed to exchange authorization code"
}
```

## React Example

```typescript
// GoogleLoginButton.tsx
export function GoogleLoginButton() {
  const handleGoogleLogin = async () => {
    try {
      const response = await fetch('https://api.sctcoding.club/api/v3/auth/google');
      const data = await response.json();

      if (data.success) {
        window.location.href = data.data.auth_url;
      }
    } catch (error) {
      console.error('Google login failed:', error);
    }
  };

  return (
    <button onClick={handleGoogleLogin}>
      Continue with Google
    </button>
  );
}
```

```typescript
// GoogleCallbackPage.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      navigate('/login?error=oauth_failed');
      return;
    }

    fetch(`https://api.sctcoding.club/api/v3/auth/google/callback?code=${code}&state=${state}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('access_token', data.data.access_token);
          localStorage.setItem('refresh_token', data.data.refresh_token);
          navigate('/dashboard');
        } else {
          navigate('/login?error=oauth_failed');
        }
      })
      .catch(() => navigate('/login?error=oauth_failed'));
  }, [searchParams, navigate]);

  return <div>Completing Google sign-in...</div>;
}
```

## Important Notes

### Account Linking

- If a user signs up with email/password first, then logs in with Google using the same email, their accounts are automatically linked
- The `google_id` is added to their existing account without creating a duplicate

### Email Verification

- Users who sign in via Google are automatically marked as verified if their Google email is verified
- New users receive a welcome email upon first sign-in

### Security

- The `state` parameter provides CSRF protection
- Always validate that `code` and `state` are present before calling the callback endpoint
- Tokens should be stored securely (HttpOnly cookies preferred over localStorage)

## Redirect URI Configuration

Your redirect URI must be registered with Google Cloud Console and match the `GOOGLE_REDIRECT_URI` environment variable on the backend.

**Example redirect URI:**

```
https://your-frontend-domain.com/auth/google/callback
```

## Error Handling

Common errors:

- `"Missing authorization code or state"` - URL params missing from callback
- `"Failed to exchange authorization code"` - Invalid/expired code or misconfigured credentials
- `"Google OAuth not configured"` - Backend missing environment variables

Handle errors gracefully and provide users with a clear path to retry authentication.

## Disconnecting Google Account

Users can disconnect their Google account if they have a password set (to maintain account access).

### Endpoint

**DELETE** `/api/v3/auth/google` (Requires authentication)

### Implementation

```typescript
async function disconnectGoogle() {
  try {
    const accessToken = localStorage.getItem("access_token");

    const response = await fetch(
      "https://api.sctcoding.club/api/v3/auth/google",
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const data = await response.json();

    if (data.success) {
      console.log("Google account disconnected");
      // Update UI to reflect disconnection
    } else {
      console.error("Failed to disconnect:", data.error);
      // Show error message to user
    }
  } catch (error) {
    console.error("Failed to disconnect Google account:", error);
  }
}
```

### Success Response

```json
{
  "success": true,
  "message": "Google account disconnected successfully"
}
```

### Error Responses

**No Google account linked:**

```json
{
  "success": false,
  "error": "No Google account linked"
}
```

**No password set (cannot disconnect):**

```json
{
  "success": false,
  "error": "Cannot disconnect Google account. Please set a password first to maintain account access."
}
```

### React Example

```typescript
// AccountSettings.tsx
export function GoogleAccountSection() {
  const [isLinked, setIsLinked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) {
      return;
    }

    setLoading(true);
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch(
        'https://api.sctcoding.club/api/v3/auth/google',
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setIsLinked(false);
        alert('Google account disconnected successfully');
      } else {
        alert(data.error || 'Failed to disconnect Google account');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('An error occurred while disconnecting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {isLinked ? (
        <button onClick={handleDisconnect} disabled={loading}>
          {loading ? 'Disconnecting...' : 'Disconnect Google'}
        </button>
      ) : (
        <button onClick={initiateGoogleLogin}>
          Connect Google Account
        </button>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Check Account Link Status

Fetch user profile to determine if Google is linked:

```typescript
async function checkGoogleLinked() {
  const response = await fetch("https://api.sctcoding.club/api/v3/auth/me", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
    },
  });

  const data = await response.json();
  return data.data?.user?.google_id != null;
}
```

### 2. Password Requirement Warning

Before allowing disconnection, check if user has a password:

```typescript
if (!user.password_hash && user.google_id) {
  // Show warning: "Set a password before disconnecting Google"
}
```

### 3. Graceful Error Handling

Always handle the case where disconnection fails:

```typescript
if (data.error?.includes("set a password")) {
  // Redirect to password setup page
  navigate("/settings/password");
}
```
