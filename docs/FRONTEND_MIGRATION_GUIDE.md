# Frontend Migration Guide: Session-Based to JWT Authentication

## Overview

The authentication system has been migrated from session-based tokens to stateless JWT (JSON Web Tokens). This guide will help you update your frontend application to work with the new authentication system.

## What Changed

### Before (Session-Based)

- Tokens were stored in database sessions table
- Server validated tokens by querying database on every request
- Tokens were opaque session IDs (e.g., `"abc123xyz"`)
- Logout required server-side session deletion
- Tokens valid for 7 days

### After (JWT-Based with Refresh Tokens)

- Access tokens are short-lived (1 hour) cryptographically signed JWTs
- Refresh tokens are long-lived (30 days) for obtaining new access tokens
- Server validates access tokens without database queries
- Tokens contain encoded user data (e.g., `"eyJhbGc..."`))
- Logout is client-side only (delete tokens from storage)
- Automatic token refresh before expiration

## Breaking Changes

1. **Token Format**: Now uses two tokens (access + refresh) instead of one session token
2. **Token Expiry**: Access tokens expire after 1 hour (refresh tokens after 30 days)
3. **Login Response**: Returns `access_token` and `refresh_token` instead of `session_id`
4. **Token Refresh**: Must implement automatic refresh logic to maintain authentication
5. **Logout Endpoint**: Now returns success message, no server-side deletion
6. **Token Storage**: Must store both access and refresh tokens

## Migration Steps

### Step 1: Update Token Storage

Now you need to store **both** access and refresh tokens:

```javascript
// Store both tokens
localStorage.setItem("accessToken", accessToken);
localStorage.setItem("refreshToken", refreshToken);

// Retrieve tokens
const accessToken = localStorage.getItem("accessToken");
const refreshToken = localStorage.getItem("refreshToken");

// Clear both tokens on logout
localStorage.removeItem("accessToken");
localStorage.removeItem("refreshToken");
```

### Step 2: Update Authentication Requests

#### Login (Important Changes)

The login endpoint now returns both `access_token` and `refresh_token`:

```javascript
// ❌ OLD CODE
const response = await fetch("https://your-api.com/v3/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123",
  }),
});

const data = await response.json();
if (data.session_id) {
  // OLD: Single token
  localStorage.setItem("authToken", data.session_id);
}
```

```javascript
// ✅ NEW CODE
const response = await fetch("https://your-api.com/v3/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123",
  }),
});

const data = await response.json();
if (data.success && data.data) {
  // NEW: Two tokens
  localStorage.setItem("accessToken", data.data.access_token);
  localStorage.setItem("refreshToken", data.data.refresh_token);
}
```

#### Passkey Login (Important Changes)

Same changes apply to passkey authentication:

```javascript
// ✅ NEW CODE
const verifyResponse = await fetch(
  "https://your-api.com/v3/auth/passkey/login/verify",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, credential }),
  },
);

const data = await verifyResponse.json();
if (data.success && data.data) {
  localStorage.setItem("accessToken", data.data.access_token);
  localStorage.setItem("refreshToken", data.data.refresh_token);
}
```

### Step 3: Implement Token Refresh (New Required Feature)

This is the most important change. You must implement automatic token refresh:

```javascript
/**
 * Refresh the access token using the refresh token
 * Call this when you receive a 401 response
 */
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");

  if (!refreshToken) {
    // No refresh token, user must login
    return null;
  }

  try {
    const response = await fetch("https://your-api.com/v3/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      // Refresh token expired or invalid
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      return null;
    }

    const data = await response.json();
    if (data.success && data.data) {
      // Store new access token
      localStorage.setItem("accessToken", data.data.access_token);
      return data.data.access_token;
    }

    return null;
  } catch (error) {
    console.error("Token refresh failed:", error);
    return null;
  }
}
```

### Step 4: Update Authenticated Requests with Auto-Refresh

Update your fetch wrapper to automatically refresh tokens on 401:

```javascript
/**
 * Fetch with automatic token refresh
 * Retries the request once if access token is expired
 */
async function fetchWithAuth(url, options = {}) {
  const accessToken = localStorage.getItem("accessToken");

  // First attempt with current access token
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // If unauthorized, try refreshing token and retry
  if (response.status === 401) {
    const newAccessToken = await refreshAccessToken();

    if (!newAccessToken) {
      // Refresh failed, redirect to login
      window.location.href = "/login";
      throw new Error("Session expired");
    }

    // Retry request with new access token
    response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${newAccessToken}`,
      },
    });
  }

  return response;
}

// Usage
const response = await fetchWithAuth("https://your-api.com/v3/auth/me");
const userData = await response.json();
```

### Step 5: Update Logout Flow

Logout now needs to clear both tokens:

```javascript
// ✅ NEW: Clear both tokens
function logout() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.location.href = "/login";
}
```

Optional: Call the logout endpoint (just validates the token):

```javascript
async function logout() {
  const accessToken = localStorage.getItem("accessToken");

  // Optional: Validate token before logout
  if (accessToken) {
    await fetch("https://your-api.com/v3/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  // Clear both tokens
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.location.href = "/login";
}
```

## Complete Examples

### React Hook with Token Refresh

```typescript
import { useState, useEffect, useCallback } from "react";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Refresh access token
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    try {
      const response = await fetch("https://your-api.com/v3/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        return null;
      }

      const data = await response.json();
      if (data.success && data.data) {
        localStorage.setItem("accessToken", data.data.access_token);
        return data.data.access_token;
      }
      return null;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return null;
    }
  }, []);

  // Fetch with automatic token refresh
  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}) => {
      let accessToken = localStorage.getItem("accessToken");

      let response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // If 401, try refreshing token
      if (response.status === 401) {
        const newAccessToken = await refreshAccessToken();
        if (!newAccessToken) {
          throw new Error("Session expired");
        }

        // Retry with new token
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newAccessToken}`,
          },
        });
      }

      return response;
    },
    [refreshAccessToken],
  );

  const checkAuth = useCallback(async () => {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (!accessToken && !refreshToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetchWithAuth("https://your-api.com/v3/auth/me");
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  async function login(email: string, password: string) {
    const response = await fetch("https://your-api.com/v3/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (data.success && data.data) {
      localStorage.setItem("accessToken", data.data.access_token);
      localStorage.setItem("refreshToken", data.data.refresh_token);
      await checkAuth();
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    window.location.href = "/login";
  }

  return { user, loading, login, logout, checkAuth, fetchWithAuth };
}
```

### Vue Composable with Token Refresh

```typescript
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";

export function useAuth() {
  const user = ref(null);
  const loading = ref(true);
  const router = useRouter();

  // Refresh access token
  async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    try {
      const response = await fetch("https://your-api.com/v3/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        return null;
      }

      const data = await response.json();
      if (data.success && data.data) {
        localStorage.setItem("accessToken", data.data.access_token);
        return data.data.access_token;
      }
      return null;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return null;
    }
  }

  // Fetch with automatic token refresh
  async function fetchWithAuth(url: string, options: RequestInit = {}) {
    let accessToken = localStorage.getItem("accessToken");

    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // If 401, try refreshing token
    if (response.status === 401) {
      const newAccessToken = await refreshAccessToken();
      if (!newAccessToken) {
        throw new Error("Session expired");
      }

      // Retry with new token
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newAccessToken}`,
        },
      });
    }

    return response;
  }

  async function checkAuth() {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (!accessToken && !refreshToken) {
      loading.value = false;
      return;
    }

    try {
      const response = await fetchWithAuth("https://your-api.com/v3/auth/me");
      if (response.ok) {
        const data = await response.json();
        user.value = data.user;
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    checkAuth();
  });

  async function login(email: string, password: string) {
    const response = await fetch("https://your-api.com/v3/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (data.success && data.data) {
      localStorage.setItem("accessToken", data.data.access_token);
      localStorage.setItem("refreshToken", data.data.refresh_token);
      await checkAuth();
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    user.value = null;
    router.push("/login");
  }

  return { user, loading, login, logout, checkAuth, fetchWithAuth };
}
```

## Testing Checklist

- [ ] Login flow generates and stores both access and refresh tokens
- [ ] Passkey login flow generates and stores both tokens
- [ ] Authenticated requests include `Authorization: Bearer <access_token>` header
- [ ] Token refresh automatically happens on 401 responses
- [ ] Both tokens are removed from storage on logout
- [ ] User data is correctly fetched from `/v3/auth/me`
- [ ] Logout redirects to login page
- [ ] Tokens persist across page refreshes
- [ ] Mobile apps use secure storage for tokens
- [ ] Refresh token endpoint (`/v3/auth/refresh`) works correctly

## Token Format Differences

### Session Token (Old)

```
7f8e9d0c-1a2b-3c4d-5e6f-7g8h9i0j1k2l
```

### Access Token (New - 1 hour)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZjhlOWQwYy0xYTJiLTNjNGQtNWU2Zi03ZzhoOWkwajFrMmwiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE3MzY5NTIwMDAsImV4cCI6MTczNjk1MjkwMH0.signature
```

### Refresh Token (New - 30 days)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZjhlOWQwYy0xYTJiLTNjNGQtNWU2Zi03ZzhoOWkwajFrMmwiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTczNjk1MjAwMCwiZXhwIjoxNzM5NTQ0MDAwfQ.signature
```

JWT tokens are Base64-encoded and contain three parts separated by dots:

1. Header (algorithm and type)
2. Payload (user data and claims)
3. Signature (cryptographic verification)

## FAQ

### Q: Why two tokens instead of one?

**A:** Short-lived access tokens (1 hour) limit exposure if compromised. Long-lived refresh tokens (30 days) provide convenience without requiring frequent logins.

### Q: What happens if my access token expires?

**A:** Your `fetchWithAuth` wrapper automatically uses the refresh token to get a new access token and retries the request.

### Q: What happens if my refresh token expires?

**A:** The user must log in again. Refresh tokens last 30 days, so users only need to log in monthly.

### Q: Can I decode the JWT token on the frontend?

**A:** Yes, but only for reading user data. Never trust frontend-decoded JWTs for security decisions. Always verify with the server.

```javascript
// Decode JWT payload (for display purposes only)
function decodeJWT(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );
  return JSON.parse(jsonPayload);
}

const payload = decodeJWT(accessToken);
console.log(payload.name); // User's name
console.log(payload.exp); // Expiration timestamp
```

### Q: Should I call the logout endpoint?

**A:** It's optional. The logout endpoint just validates your access token. The actual logout is deleting both tokens from client storage.

### Q: What if I want longer/shorter token expiry?

**A:** Token expiry is configured server-side. Contact your backend team to adjust:

- Access token: Default 1 hour (adjustable)
- Refresh token: Default 30 days (adjustable)

### Q: Will old session tokens still work?

**A:** No. After migration, only JWT tokens will be accepted. All users must re-login.

### Q: Can I store tokens in cookies instead of localStorage?

**A:** Yes, but you'll need to handle CSRF protection. httpOnly cookies are more secure but require server-side cookie management.

## Security Best Practices

1. **Store refresh tokens securely**: Use httpOnly cookies or secure storage (never localStorage for production)
2. **Implement token rotation**: Consider rotating refresh tokens on each use
3. **Add token revocation**: Implement a token blacklist for compromised tokens
4. **Use HTTPS only**: Never transmit tokens over HTTP
5. **Implement rate limiting**: Limit refresh token requests to prevent abuse
6. **Monitor refresh patterns**: Alert on suspicious refresh token usage

## Rollback Plan

If you need to rollback to session-based authentication:

1. Restore previous version of backend code
2. Re-add `SESSION_SECRET` to environment variables
3. Frontend changes needed: Update to use single token storage again

## Support

For questions or issues during migration:

- Check API error responses for detailed messages
- Review token expiry (1 hour access, 30 days refresh)
- Ensure `Authorization: Bearer <access_token>` header format is correct
- Verify both tokens are being stored and retrieved correctly
- Test token refresh flow with 401 responses

## Summary

**Key Changes**:

1. **Two tokens**: Store both `accessToken` (1 hour) and `refreshToken` (30 days)
2. **Auto-refresh**: Implement automatic token refresh on 401 responses
3. **Login response**: Now returns `access_token` and `refresh_token` instead of `session_id`
4. **Logout**: Delete both tokens from storage

```javascript
// Complete minimal example
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  const response = await fetch("/v3/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await response.json();
  if (data.success) {
    localStorage.setItem("accessToken", data.data.access_token);
    return data.data.access_token;
  }
  return null;
}

async function fetchWithAuth(url, options = {}) {
  let token = localStorage.getItem("accessToken");
  let response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      response = await fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
      });
    }
  }

  return response;
}
```
