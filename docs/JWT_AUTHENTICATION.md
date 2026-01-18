# JWT Authentication Guide

## Overview

The v3 API uses **JWT-based authentication** for stateless, scalable authentication.

All endpoints use JWT tokens with the `Authorization: Bearer <token>` header format.

## Architecture

### JWT Flow

```
Login/Passkey → JWT signed with HMAC-SHA256 → Client stores JWT →
Protected endpoint → Verify JWT signature → Access granted (no DB query)
```

## JWT Token Structure

JWT tokens consist of three Base64URL-encoded parts separated by dots:

```
header.payload.signature
```

### Header

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Payload (Claims)

```json
{
  "sub": "user-id-here",
  "email": "user@example.com",
  "name": "User Name",
  "iat": 1703001600,
  "exp": 1703606400
}
```

### Signature

HMAC-SHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), JWT_SECRET)

## Configuration

### Environment Variable

Add to `wrangler.jsonc`:

```json
"vars": {
  "JWT_SECRET": "your-secret-key-here"
}
```

**Generate a secure secret:**

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Production Deployment

For production, use Cloudflare secrets (not plaintext in wrangler.jsonc):

```bash
wrangler secret put JWT_SECRET
# Paste your secret when prompted
```

## Usage

### Authentication Endpoints

All authentication endpoints automatically return JWT tokens when `JWT_SECRET` is configured:

#### Traditional Login

```http
POST /api/v3/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "...",
    "expires_in": 900,
    "user": {
      "id": "...",
      "email": "user@example.com",
      "name": "User Name",
      "profile_photo_url": "..."
    }
  }
}
```

#### Passkey Login

```http
POST /api/v3/auth/passkey/login/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "credential": { ... }
}
```

Returns the same structure with JWT token.

### Protected Endpoints

All protected endpoints accept JWT tokens via Bearer authentication:

```http
GET /api/v3/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Protected endpoints that support JWT:

- `GET /api/v3/auth/me` - Get current user
- `POST /api/v3/auth/logout` - Logout (no-op for JWT)
- `GET /api/v3/auth/passkeys` - List user's passkeys
- `DELETE /api/v3/auth/passkeys/:id` - Delete a passkey

## Token Lifecycle

### Access Tokens

- **Duration**: 7 days
- **Purpose**: API authentication
- **Storage**: Client-side (localStorage, sessionStorage, or secure cookie)

### Refresh Tokens (Future)

- **Duration**: 30 days
- **Purpose**: Obtain new access tokens without re-authentication
- **Endpoint**: `POST /api/v3/auth/refresh` (not yet implemented)

## Security Considerations

### Token Storage (Client-Side)

**Option 1: localStorage (Simple but less secure)**

```javascript
localStorage.setItem("auth_token", token);
```

⚠️ Vulnerable to XSS attacks

**Option 2: HttpOnly Cookies (Most secure)**

```javascript
// Server sets:
Set-Cookie: auth_token=...; HttpOnly; Secure; SameSite=Strict
```

✅ Protected from XSS, requires CORS configuration

**Option 3: sessionStorage (Better than localStorage)**

```javascript
sessionStorage.setItem("auth_token", token);
```

✅ Cleared when tab closes

### Token Validation

The middleware performs:

1. **Signature verification** - Ensures token wasn't tampered with
2. **Expiration check** - Rejects expired tokens
3. **Structure validation** - Verifies all required claims

### Secret Key Security

- Never commit `JWT_SECRET` to version control
- Use Cloudflare secrets for production
- Rotate secrets periodically
- Use strong, randomly generated keys (minimum 32 bytes)

## Logout Behavior

Since JWTs are stateless, they cannot be revoked server-side. Options:

1. **Client-side removal** (current implementation)
   - Client deletes the token
   - Token remains valid until expiration
2. **Token blacklist** (future enhancement)
   - Store revoked tokens in KV with expiration
   - Check blacklist during validation

3. **Short expiration + refresh tokens**
   - Use 1-hour access tokens
   - Implement refresh token endpoint
   - Revoke refresh tokens on logout

### Session Tokens

The system supports both authentication methods simultaneously for backward compatibility:

###Performance Benefits

| Metric           | JWT         |
| ---------------- | ----------- |
| Validation time  | ~1ms        |
| Database queries | 0           |
| Scalability      | Excellent   |
| Storage          | Client-only |

```typescript
// api.ts
const API_BASE = "https://api.sctcoding.club";

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE}/api/v3/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (data.success) {
    localStorage.setItem("auth_token", data.data.session_id);
    return data.data.user;
  }
  throw new Error(data.error);
}

export async function getCurrentUser() {
  const token = localStorage.getItem("auth_token");
  if (!token) return null;

  const response = await fetch(`${API_BASE}/api/v3/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  return data.success ? data.data : null;
}
access_token);
    localStorage.setItem("refresh_token", data.data.refresh_token
export function logout() {
  localStorage.removeItem("auth_token");
}
```

### React Context

```typescript
import { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  profile_photo_url?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(setUser).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const user = await loginAPI(email, password);
    setUser(user);
  };

  const logout = () => {
    logoutAPI();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

## Testing

### Manual Testing (HTTP client)

```http
### 1. Login
POST https://api.sctcoding.club/api/v3/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}

### 2. Get current user (copy token from step 1)
GET https://api.sctcoding.club/api/v3/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

### 3. Logout
POST https://api.sctcoding.club/api/v3/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Automated Testing

```bash
# Run the test script
chmod +x test-v3-auth.sh
./test-v3-auth.sh
```

## Troubleshooting

### "Invalid or expired token"

- Token may be expired (check `exp` claim)
- Token signature may be invalid (wrong JWT_SECRET)
- Token format may be incorrect

### "Missing or invalid authorization header"

- Ensure header format: `Authorization: Bearer <token>`
- Check for extra spaces or missing "Bearer" prefix

### Token not working after secret rotation

- Old tokens are immediately invalid
- Users need to re-authenticate
- Consider using refresh tokens for smoother rotation

## Future Enhancements

1. **Refresh Token Endpoint**
   - `POST /api/v3/auth/refresh`
   - Accept refresh token, return new access token

2. **Token Blacklist**
   - Store revoked tokens in KV namespace
   - Implement during logout

3. **Token Introspection**
   - `POST /api/v3/auth/introspect`
   - Verify token validity

4. **Multiple JWT Algorithms**
   - Support RS256 (public/private key)
   - Better for microservices

## Related Documentation

- [Passkey Implementation](./PASSKEY_IMPLEMENTATION.md)
- [Frontend Integration](./FRONTEND_INTEGRATION.md)
- [V3 API Overview](./V3_IMPLEMENTATION_SUMMARY.md)
