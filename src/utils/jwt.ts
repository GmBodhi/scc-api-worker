/**
 * JWT Utility Functions for Authentication
 * Provides stateless token-based authentication as an alternative to database sessions
 */

interface JWTPayload {
  sub: string; // user_id
  email: string;
  phone: string | null;
  name: string;
  iat: number; // issued at
  exp: number; // expires at
}

interface JWTHeader {
  alg: string;
  typ: string;
}

/**
 * Base64URL encode
 */
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return atob(str);
}

/**
 * Create HMAC SHA-256 signature
 */
async function createSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));

  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verify HMAC SHA-256 signature
 */
async function verifySignature(
  data: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expectedSignature = await createSignature(data, secret);
  return signature === expectedSignature;
}

/**
 * Generate JWT access token (short-lived)
 * @param userId - User ID
 * @param email - User email
 * @param name - User name
 * @param secret - Secret key for signing (from environment)
 * @param expiresIn - Token expiration in seconds (default: 15 minutes)
 */
export async function generateJWT(
  userId: string,
  email: string,
  phone: string | null,
  name: string,
  secret: string,
  expiresIn: number = 60 * 60, // 1 hour
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header: JWTHeader = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload: JWTPayload = {
    sub: userId,
    email: email,
    phone: phone,
    name: name,
    iat: now,
    exp: now + expiresIn,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;

  const signature = await createSignature(dataToSign, secret);

  return `${dataToSign}.${signature}`;
}

/**
 * Verify and decode JWT token
 * @param token - JWT token to verify
 * @param secret - Secret key for verification
 * @returns Decoded payload or null if invalid
 */
export async function verifyJWT(
  token: string,
  secret: string,
): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, payloadEncoded, signature] = parts;
    const dataToVerify = `${headerEncoded}.${payloadEncoded}`;

    // Verify signature
    const isValid = await verifySignature(dataToVerify, signature, secret);
    if (!isValid) {
      return null;
    }

    // Decode payload
    const payloadJson = base64UrlDecode(payloadEncoded);
    const payload: JWTPayload = JSON.parse(payloadJson);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Token expired
    }

    return payload;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}

/**
 * Extract user ID from JWT token without full verification
 * Use only for non-critical operations
 */
export function extractUserId(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson);
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson);
    return payload.exp || null;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiration(token);
  if (!exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return exp < now;
}

/**
 * Generate refresh token (longer expiration)
 * @param userId - User ID
 * @param secret - Secret key for signing
 * @param expiresIn - Token expiration in seconds (default: 30 days)
 */
export async function generateRefreshToken(
  userId: string,
  secret: string,
  expiresIn: number = 30 * 24 * 60 * 60, // 30 days
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header: JWTHeader = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    sub: userId,
    type: "refresh",
    iat: now,
    exp: now + expiresIn,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;

  const signature = await createSignature(dataToSign, secret);

  return `${dataToSign}.${signature}`;
}

/**
 * Verify refresh token
 * @param token - Refresh token to verify
 * @param secret - Secret key for verification
 * @returns User ID or null if invalid
 */
export async function verifyRefreshToken(
  token: string,
  secret: string,
): Promise<string | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, payloadEncoded, signature] = parts;
    const dataToVerify = `${headerEncoded}.${payloadEncoded}`;

    // Verify signature
    const isValid = await verifySignature(dataToVerify, signature, secret);
    if (!isValid) {
      return null;
    }

    // Decode payload
    const payloadJson = base64UrlDecode(payloadEncoded);
    const payload = JSON.parse(payloadJson);

    // Check if it's a refresh token
    if (payload.type !== "refresh") {
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Token expired
    }

    return payload.sub || null;
  } catch (error) {
    console.error("Refresh token verification error:", error);
    return null;
  }
}

/**
 * Hash refresh token for secure storage
 */
export async function hashRefreshToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
