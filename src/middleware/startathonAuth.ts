/**
 * Startathon Authentication Middleware
 * Standalone: authenticates against startathon_users in EVENTS_DB.
 * Only accepts JWTs with aud: "startathon".
 */

import { type AppContext } from "../types";
import { verifyStartathonJWT } from "../utils/startathonJwt";

export interface StartathonAuthUser {
  user_id: string;
  team_id: string;
  role: "leader" | "member";
  name: string;
  email: string;
  phone: string | null;
  college: string | null;
}

export interface StartathonAuthResult {
  success: boolean;
  user?: StartathonAuthUser;
  error?: string;
}

export async function requireStartathonAuth(
  c: AppContext,
): Promise<StartathonAuthResult> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { success: false, error: "Missing or invalid authorization header" };
  }

  const payload = await verifyStartathonJWT(
    authHeader.substring(7),
    c.env.JWT_SECRET,
  );
  if (!payload) {
    return { success: false, error: "Invalid or expired token" };
  }

  const user = await c.env.EVENTS_DB.prepare(
    "SELECT user_id, team_id, role, name, email, phone, college FROM startathon_users WHERE user_id = ?",
  )
    .bind(payload.sub)
    .first();

  if (!user) {
    return { success: false, error: "User not found" };
  }

  return {
    success: true,
    user: {
      user_id: user.user_id as string,
      team_id: user.team_id as string,
      role: user.role as "leader" | "member",
      name: user.name as string,
      email: user.email as string,
      phone: (user.phone as string) || null,
      college: (user.college as string) || null,
    },
  };
}
