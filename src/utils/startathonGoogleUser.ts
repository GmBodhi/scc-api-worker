/**
 * Shared D1 lookup/create logic for Startathon accounts arriving via
 * Google — used by both the redirect-flow callback and the GIS
 * credential (ID token) endpoint so the matching rules stay identical.
 */

export interface StartathonGoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

export async function findOrCreateStartathonGoogleUser(
  db: D1Database,
  profile: StartathonGoogleProfile,
) {
  const normalizedEmail = profile.email.toLowerCase();

  // Match by google_id first, then by email (link on first Google login)
  let user = await db
    .prepare("SELECT * FROM startathon_users WHERE google_id = ?")
    .bind(profile.googleId)
    .first();

  if (!user) {
    user = await db
      .prepare("SELECT * FROM startathon_users WHERE email = ?")
      .bind(normalizedEmail)
      .first();

    if (user) {
      await db
        .prepare("UPDATE startathon_users SET google_id = ? WHERE user_id = ?")
        .bind(profile.googleId, user.user_id)
        .run();
    }
  }

  if (!user) {
    // First-time Google user: sign them up, teamless, no password.
    const userId = `STU_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO startathon_users (user_id, name, email, google_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(userId, profile.name, normalizedEmail, profile.googleId, now)
      .run();

    user = await db
      .prepare("SELECT * FROM startathon_users WHERE user_id = ?")
      .bind(userId)
      .first();
  }

  return user;
}
