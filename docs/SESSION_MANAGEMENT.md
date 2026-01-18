# Session Management Overview

## Current Implementation

The v3 API supports **two authentication methods** that work seamlessly together:

## 1. JWT Authentication (Recommended) ✅

### How it works

- Server signs a token with HMAC-SHA256
- Token contains user claims (id, email, name, expiration)
- Client stores token and sends with each request
- Server verifies signature without database lookup

### Advantages

- **Stateless** - No database queries needed for validation
- **Fast** - Verification takes ~1ms
- **Scalable** - No server-side storage required
- **Standard** - Industry-standard approach (RFC 7519)

### Disadvantages

- Cannot revoke tokens (they're valid until expiration)
- Slightly larger token size
- Requires secure secret management

### Configuration

```json
// wrangler.jsonc
"vars": {
  "JWT_SECRET": "your-secret-key"
}
```

### Example Token

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIiwibmFtZSI6IlVzZXIgTmFtZSIsImlhdCI6MTcwMzAwMTYwMCwiZXhwIjoxNzAzNjA2NDAwfQ.signature-here
```

## 2. Session Authentication (Legacy)

### How it works

- Server generates UUID session ID
- Session stored in `sessions` table with user_id and expiration
- Client stores session ID and sends with each request
- Server queries database to validate session

### Advantages

- **Simple** - Easy to understand
- **Revocable** - Can delete sessions immediately
- **Traditional** - Well-known pattern

### Disadvantages

- **Database query on every request** - Adds latency
- **Not scalable** - Requires shared session storage
- **Slower** - Validation takes 10-50ms

### Example Token

```
550e8400-e29b-41d4-a716-446655440000
```

## Authentication Flow Comparison

### JWT Flow

```
┌─────────┐                ┌─────────┐
│ Client  │                │ Server  │
└────┬────┘                └────┬────┘
     │                          │
     │  POST /auth/login        │
     ├─────────────────────────>│
     │                          │
     │                 1. Verify credentials
     │                 2. Generate JWT
     │                 3. Sign with JWT_SECRET
     │                          │
     │  JWT token               │
     │<─────────────────────────┤
     │                          │
     │  GET /auth/me            │
     │  (Bearer JWT)            │
     ├─────────────────────────>│
     │                          │
     │                 1. Verify signature
     │                 2. Check expiration
     │                 3. Extract user claims
     │                          │
     │  User data               │
     │<─────────────────────────┤
```

### Session Flow

```
┌─────────┐                ┌─────────┐
│ Client  │                │ Server  │
└────┬────┘                └────┬────┘
     │                          │
     │  POST /auth/login        │
     ├─────────────────────────>│
     │                          │
     │                 1. Verify credentials
     │                 2. Generate UUID
     │                 3. INSERT INTO sessions
     │                          │
     │  Session UUID            │
     │<─────────────────────────┤
     │                          │
     │  GET /auth/me            │
     │  (Bearer UUID)           │
     ├─────────────────────────>│
     │                          │
     │                 1. SELECT FROM sessions
     │                 2. JOIN users table
     │                 3. Check expiration
     │                          │
     │  User data               │
     │<─────────────────────────┤
```

## Which Method is Used?

The system automatically chooses based on configuration:

```typescript
// In login.ts and passkeyLoginVerify.ts
if (c.env.JWT_SECRET) {
  // Generate JWT token
  token = await generateJWT(userId, email, name, JWT_SECRET, 7_DAYS);
} else {
  // Fallback to session
  const sessionId = crypto.randomUUID();
  await db.insert('sessions', { id: sessionId, user_id, expires_at });
  token = sessionId;
}
```

## Authentication Middleware

The `authenticate()` middleware supports both methods transparently:

```typescript
export async function authenticate(c: AppContext): Promise<AuthUser | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.substring(7);

  // Try JWT first (if JWT_SECRET is configured)
  if (c.env.JWT_SECRET) {
    const jwtUser = await verifyJWT(token, c.env.JWT_SECRET);
    if (jwtUser) return jwtUser;
  }

  // Fallback to session database lookup
  const session = await c.env.GENERAL_DB.prepare(
    `SELECT u.* FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(token, Date.now() / 1000)
    .first();

  return session ? mapToAuthUser(session) : null;
}
```

## Token Identification

You can distinguish between JWT and session tokens:

```typescript
// JWTs have three Base64URL parts separated by dots
const isJWT = token.includes(".");

// Session tokens are UUIDs (no dots)
const isSession = !token.includes(".");
```

## Migration Strategy

### Phase 1: Add JWT Support (Current)

- JWT_SECRET configured in environment
- New logins get JWT tokens
- Old session tokens still work
- Both methods supported simultaneously

### Phase 2: Monitor Usage

- Track JWT vs session usage
- Identify clients still using sessions
- Plan deprecation timeline

### Phase 3: Deprecate Sessions (Future)

- Announce deprecation date
- Force re-authentication
- Remove session table and code

## Performance Impact

### Request Latency Reduction

**Before (Session-based):**

```
Request → Parse header → DB query (10-50ms) → Response
Total: ~50ms
```

**After (JWT-based):**

```
Request → Parse header → Verify signature (~1ms) → Response
Total: ~5ms
```

**Improvement: 10x faster authentication** 🚀

### Database Load Reduction

With 1000 authenticated requests per minute:

**Session-based:**

- 1000 SELECT queries to sessions table
- 1000 JOIN operations with users table
- Constant database load

**JWT-based:**

- 0 database queries for authentication
- CPU-only signature verification
- Database only used for actual data operations

## Security Comparison

| Aspect          | JWT                       | Session                 |
| --------------- | ------------------------- | ----------------------- |
| Revocation      | Complex (needs blacklist) | Simple (DELETE)         |
| Secret exposure | High impact               | Low impact              |
| Token theft     | Valid until expiration    | Can be revoked          |
| XSS protection  | Same as session           | Same as JWT             |
| CSRF protection | Not vulnerable            | Vulnerable (if cookies) |
| Replay attacks  | Time-limited              | Time-limited            |

## Best Practices

### For JWT

1. Use strong, random JWT_SECRET (minimum 32 bytes)
2. Store secret in Cloudflare secrets (not wrangler.jsonc)
3. Keep token expiration short (7 days or less)
4. Implement refresh tokens for longer sessions
5. Consider token blacklist for critical applications

### For Sessions

1. Use secure, random session IDs (crypto.randomUUID())
2. Set reasonable expiration (7 days)
3. Clean up expired sessions regularly
4. Consider moving to JWT for better performance

## Frequently Asked Questions

### Q: Can I use both methods simultaneously?

**A:** Yes! The system supports both. New logins get JWT (if configured), but old session tokens continue to work.

### Q: What happens if I remove JWT_SECRET?

**A:** System falls back to session-based authentication for all new logins.

### Q: How do I rotate JWT_SECRET?

**A:** Change the secret and all users will need to re-authenticate (existing tokens become invalid).

### Q: Can I revoke a JWT token?

**A:** Not directly. Options: 1) Wait for expiration, 2) Implement token blacklist, 3) Use short expiration + refresh tokens.

### Q: Should I migrate existing session tokens to JWT?

**A:** No need. Users will get JWT tokens on their next login. Old sessions expire naturally.

### Q: Which method should new projects use?

**A:** JWT for better performance and scalability. Sessions only if you need immediate revocation.

## Environment Variables

```jsonc
// wrangler.jsonc
{
  "vars": {
    // If set, JWT authentication is used (recommended)
    "JWT_SECRET": "your-secret-key",

    // If not set, falls back to session-based auth
    // No JWT_SECRET = sessions only
  },
}
```

## Related Files

### Core Implementation

- [src/utils/jwt.ts](../src/utils/jwt.ts) - JWT generation and verification
- [src/middleware/auth.ts](../src/middleware/auth.ts) - Unified authentication
- [src/endpoints/v3/login.ts](../src/endpoints/v3/login.ts) - Login endpoint
- [src/endpoints/v3/getCurrentUser.ts](../src/endpoints/v3/getCurrentUser.ts) - Auth validation

### Documentation

- [JWT Authentication Guide](./JWT_AUTHENTICATION.md) - Detailed JWT documentation
- [Frontend Integration](./FRONTEND_INTEGRATION.md) - Client-side implementation
- [V3 API Overview](./V3_IMPLEMENTATION_SUMMARY.md) - Complete API documentation
