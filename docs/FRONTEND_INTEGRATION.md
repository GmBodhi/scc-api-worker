# Frontend Integration Guide

## Quick Start

The v3 API provides a complete authentication system with:

- Traditional email/password authentication
- WebAuthn passkey support (passwordless)
- JWT token authentication (stateless, fast)
- Profile photo management with R2 storage

Base URL: `https://api.sctcoding.club`

## Authentication Methods

### 1. JWT Token Authentication (Recommended) ⚡

**Why JWT?**

- ✅ Stateless - no database lookups
- ✅ Fast - 10x faster than session-based auth
- ✅ Scalable - works across multiple servers
- ✅ Standard - RFC 7519 compliant

All login endpoints automatically return JWT tokens. Use them in the `Authorization` header:

```typescript
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

📖 **See:** [JWT Authentication Guide](./JWT_AUTHENTICATION.md) for detailed JWT documentation

### 2. Session Token Authentication (Legacy)

UUID-based session tokens stored in database. Works the same way from client perspective.

📖 **See:** [Session Management](./SESSION_MANAGEMENT.md) for comparison

## API Endpoints

### Authentication Flow

#### Traditional Two-Step Signup

**Step 1: Verify with EtLab**

```http
POST /api/v3/auth/etlab/verify
Content-Type: application/json

{
  "username": "etlab_username"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "verification_token": "temp-token-123",
    "user": {
      "etlab_username": "johndoe",
      "name": "John Doe",
      "profile_photo_url": "https://etlab.sctcoding.club/..."
    }
  }
}
```

**Step 2: Complete Signup**

```http
POST /api/v3/auth/signup
Content-Type: application/json

{
  "verification_token": "temp-token-123",
  "email": "john@example.com",
  "password": "secure-password",
  "profile_photo": "<base64-encoded-image>" // optional, for custom photo
}
```

Response:

```json
{
  "success": true,
  "data": {
    "session_id": "jwt-token-here",
    "user": {
      "id": "user-id",
      "email": "john@example.com",
      "name": "John Doe",
      "etlab_username": "johndoe",
      "profile_photo_url": "https://..."
    }
  }
}
```

#### Traditional Login

```http
POST /api/v3/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "secure-password"
}
```

Response: Same as signup

#### Passkey Authentication (Passwordless)

📖 **See:** [Passkey Implementation Guide](./PASSKEY_IMPLEMENTATION.md) for complete WebAuthn integration

**Quick summary:**

1. Register passkey: `POST /api/v3/auth/passkey/register/start` → `POST /api/v3/auth/passkey/register/verify`
2. Login with passkey: `POST /api/v3/auth/passkey/login/start` → `POST /api/v3/auth/passkey/login/verify`

### Protected Endpoints

All protected endpoints require `Authorization: Bearer <token>` header.

#### Get Current User

```http
GET /api/v3/auth/me
Authorization: Bearer <your-token>
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "john@example.com",
    "name": "John Doe",
    "etlab_username": "johndoe",
    "profile_photo_url": "https://...",
    "created_at": 1703001600
  }
}
```

#### Logout

```http
POST /api/v3/auth/logout
Authorization: Bearer <your-token>
```

Response:

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### Passkey Management

```http
# List passkeys
GET /api/v3/auth/passkeys
Authorization: Bearer <your-token>

# Delete passkey
DELETE /api/v3/auth/passkeys/:credential_id
Authorization: Bearer <your-token>
```

## TypeScript Integration

### API Client

```typescript
// api/auth.ts
const API_BASE = "https://api.sctcoding.club";

interface User {
  id: string;
  email: string;
  name: string;
  etlab_username?: string;
  profile_photo_url?: string;
  created_at?: number;
}

interface AuthResponse {
  success: boolean;
  data?: {
    session_id: string;
    user: User;
  };
  error?: string;
}

class AuthAPI {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem("auth_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  async verifyEtLab(username: string) {
    const response = await this.request<{
      success: boolean;
      data: {
        verification_token: string;
        user: Partial<User>;
      };
    }>("/api/v3/auth/etlab/verify", {
      method: "POST",
      body: JSON.stringify({ username }),
    });

    return response.data;
  }

  async signup(
    verificationToken: string,
    email: string,
    password: string,
    customPhoto?: string,
  ) {
    const response = await this.request<AuthResponse>("/api/v3/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        verification_token: verificationToken,
        email,
        password,
        profile_photo: customPhoto,
      }),
    });

    if (response.data) {
      this.token = response.data.session_id;
      localStorage.setItem("auth_token", this.token);
      return response.data.user;
    }

    throw new Error("Signup failed");
  }

  async login(email: string, password: string) {
    const response = await this.request<AuthResponse>("/api/v3/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (response.data) {
      this.token = response.data.session_id;
      localStorage.setItem("auth_token", this.token);
      return response.data.user;
    }

    throw new Error("Login failed");
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.token) return null;

    try {
      const response = await this.request<{ success: boolean; data: User }>(
        "/api/v3/auth/me",
      );
      return response.data;
    } catch {
      this.logout();
      return null;
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem("auth_token");

    // Optionally notify server (for session-based tokens)
    fetch(`${API_BASE}/api/v3/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
    }).catch(() => {});
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }
}

export const authAPI = new AuthAPI();
```

### React Hook

```typescript
// hooks/useAuth.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../api/auth';

interface User {
  id: string;
  email: string;
  name: string;
  etlab_username?: string;
  profile_photo_url?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  signup: (
    verificationToken: string,
    email: string,
    password: string,
    customPhoto?: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authAPI.getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const user = await authAPI.login(email, password);
    setUser(user);
  };

  const signup = async (
    verificationToken: string,
    email: string,
    password: string,
    customPhoto?: string
  ) => {
    const user = await authAPI.signup(verificationToken, email, password, customPhoto);
    setUser(user);
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Usage in Components

```typescript
// pages/Login.tsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">Login</button>
    </form>
  );
}
```

```typescript
// pages/Signup.tsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authAPI } from '../api/auth';

export function SignupPage() {
  const [step, setStep] = useState<'etlab' | 'complete'>('etlab');
  const [etlabUsername, setEtlabUsername] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signup } = useAuth();

  const handleEtLabVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await authAPI.verifyEtLab(etlabUsername);
    setVerificationToken(data.verification_token);
    setUserData(data.user);
    setStep('complete');
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    await signup(verificationToken, email, password);
  };

  if (step === 'etlab') {
    return (
      <form onSubmit={handleEtLabVerify}>
        <h2>Verify with EtLab</h2>
        <input
          value={etlabUsername}
          onChange={(e) => setEtlabUsername(e.target.value)}
          placeholder="EtLab Username"
          required
        />
        <button type="submit">Verify</button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCompleteSignup}>
      <h2>Complete Signup</h2>
      <p>Welcome, {userData?.name}!</p>
      {userData?.profile_photo_url && (
        <img src={userData.profile_photo_url} alt="Profile" />
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit">Complete Signup</button>
    </form>
  );
}
```

## Profile Photo Handling

### Using EtLab Photo

By default, users get their profile photo from EtLab during signup. No additional handling needed.

### Custom Photo Upload

```typescript
async function uploadCustomPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;
      resolve(base64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Usage
const file = document.querySelector('input[type="file"]').files[0];
const base64Photo = await uploadCustomPhoto(file);
await authAPI.signup(token, email, password, base64Photo);
```

Photos are automatically:

- Stored in Cloudflare R2
- Validated (max 5MB)
- Served with public URLs
- Optimized for web delivery

## Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common errors:

| Status | Error                    | Meaning                    |
| ------ | ------------------------ | -------------------------- |
| 400    | Invalid credentials      | Wrong email/password       |
| 401    | Invalid or expired token | Re-authentication required |
| 404    | User not found           | Account doesn't exist      |
| 409    | Email already registered | Use different email        |
| 500    | Internal server error    | Server issue, retry later  |

## Security Best Practices

### Token Storage

**Recommended: sessionStorage** (cleared on tab close)

```typescript
sessionStorage.setItem("auth_token", token);
```

**Alternative: localStorage** (persists across sessions)

```typescript
localStorage.setItem("auth_token", token);
```

**Most Secure: HttpOnly Cookies** (requires server configuration)

```typescript
// Server sets: Set-Cookie: auth_token=...; HttpOnly; Secure; SameSite=Strict
// Client: automatic, no JavaScript access
```

### HTTPS Only

Always use HTTPS in production. Never send tokens over HTTP.

### Token Expiration

Tokens expire after 7 days. Handle expiration gracefully:

```typescript
async function requestWithAuth(endpoint: string) {
  try {
    return await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (error.status === 401) {
      // Token expired, redirect to login
      window.location.href = "/login";
    }
    throw error;
  }
}
```

## Testing

### Manual Testing

Use the HTTP test file: [test-v3-passkey.http](../test-v3-passkey.http)

### Automated Testing

```typescript
describe("Auth Flow", () => {
  it("should complete signup flow", async () => {
    // 1. Verify EtLab
    const verification = await authAPI.verifyEtLab("testuser");
    expect(verification.verification_token).toBeDefined();

    // 2. Complete signup
    const user = await authAPI.signup(
      verification.verification_token,
      "test@example.com",
      "password123",
    );
    expect(user.email).toBe("test@example.com");

    // 3. Verify authentication
    const currentUser = await authAPI.getCurrentUser();
    expect(currentUser?.id).toBe(user.id);
  });
});
```

## Migration from Old API

If migrating from previous API versions:

1. Update base URL to use `/api/v3/`
2. Change session handling to use Bearer tokens
3. Update signup flow to two-step process
4. Implement EtLab verification
5. Test with new endpoints

## Related Documentation

- 📖 [JWT Authentication](./JWT_AUTHENTICATION.md) - Deep dive into JWT tokens
- 📖 [Session Management](./SESSION_MANAGEMENT.md) - JWT vs Session comparison
- 📖 [Passkey Implementation](./PASSKEY_IMPLEMENTATION.md) - WebAuthn integration
- 📖 [V3 API Summary](./V3_IMPLEMENTATION_SUMMARY.md) - Complete API overview

## Support

For issues or questions:

- Check error messages in API responses
- Review documentation above
- Test with HTTP client first
- Verify token format and expiration
