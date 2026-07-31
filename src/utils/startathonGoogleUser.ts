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

export interface StartathonUtmData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export async function findOrCreateStartathonGoogleUser(
  db: D1Database,
  profile: StartathonGoogleProfile,
  utm?: StartathonUtmData,
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
        .prepare(
          "UPDATE startathon_users SET google_id = ?, name = COALESCE(name, ?) WHERE user_id = ?",
        )
        .bind(profile.googleId, profile.name, user.user_id)
        .run();
      user = await db
        .prepare("SELECT * FROM startathon_users WHERE user_id = ?")
        .bind(user.user_id)
        .first();
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
        `INSERT INTO startathon_users (user_id, name, email, google_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        userId,
        profile.name,
        normalizedEmail,
        profile.googleId,
        utm?.utm_source || null,
        utm?.utm_medium || null,
        utm?.utm_campaign || null,
        utm?.utm_term || null,
        utm?.utm_content || null,
        now,
      )
      .run();

    user = await db
      .prepare("SELECT * FROM startathon_users WHERE user_id = ?")
      .bind(userId)
      .first();
  }

  return user;
}
