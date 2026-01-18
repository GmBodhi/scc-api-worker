/**
 * Authentication Middleware
 * JWT-based authentication only
 */

import { type AppContext } from "../types";
import { verifyJWT } from "../utils/jwt";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  etlab_username?: string | null;
  profile_photo_url?: string | null;
  created_at?: number;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

/**
 * Extract and validate JWT authentication token
 *
 * @param c - Hono context
 * @returns AuthResult with user data or error
 */
export async function authenticate(c: AppContext): Promise<AuthResult> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { success: false, error: "Missing or invalid authorization header" };
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  // Verify JWT
  const jwtPayload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!jwtPayload) {
    return { success: false, error: "Invalid or expired token" };
  }

  // Fetch full user data from database
  const user = await c.env.GENERAL_DB.prepare(
    "SELECT id, email, name, etlab_username, profile_photo_url, created_at FROM users WHERE id = ?",
  )
    .bind(jwtPayload.sub)
    .first();

  if (!user) {
    return { success: false, error: "User not found" };
  }

  return {
    success: true,
    user: {
      id: user.id as string,
      email: user.email as string,
      name: user.name as string,
      etlab_username: user.etlab_username as string | null,
      profile_photo_url: user.profile_photo_url as string | null,
      created_at: user.created_at as number,
    },
  };
}

/**
 * Require authentication middleware
 * Returns AuthResult with user data or error
 *
 * Usage in endpoints:
 * const authResult = await requireAuth(c);
 * if (!authResult.success) {
 *   return c.json({ error: authResult.error }, 401);
 * }
 * const user = authResult.user;
 */
export async function requireAuth(c: AppContext): Promise<AuthResult> {
  return authenticate(c);
}

/**
 * Optional authentication middleware
 * Returns user if authenticated, null otherwise (no error)
 */
export async function optionalAuth(c: AppContext): Promise<AuthUser | null> {
  try {
    const result = await authenticate(c);
    return result.success ? result.user || null : null;
  } catch {
    return null;
  }
}
