import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  GoogleOAuthCallbackRequest,
  GoogleOAuthCallbackResponse,
} from "../../../types";
import {
  generateJWT,
  generateRefreshToken,
  hashRefreshToken,
} from "../../../utils/jwt";
import { EmailService } from "../../../services/emailService";

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * GET /api/v3/auth/google/callback
 * Handle Google OAuth callback and create/login user
 */
export class GoogleOAuthCallback extends OpenAPIRoute {
  schema = {
    summary: "Handle Google OAuth callback",
    request: {
      query: GoogleOAuthCallbackRequest,
    },
    responses: {
      "200": {
        description: "OAuth callback processed successfully",
        content: {
          "application/json": {
            schema: GoogleOAuthCallbackResponse,
          },
        },
      },
      "400": {
        description: "Invalid request",
        content: {
          "application/json": {
            schema: GoogleOAuthCallbackResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    try {
      const { code, state } = c.req.query();

      if (!code || !state) {
        return c.json(
          {
            success: false,
            error: "Missing authorization code or state",
          },
          400,
        );
      }

      const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
        c.env;

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        return c.json(
          {
            success: false,
            error: "Google OAuth not configured",
          },
          500,
        );
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("Token exchange error:", errorData);
        return c.json(
          {
            success: false,
            error: "Failed to exchange authorization code",
          },
          400,
        );
      }

      const tokenData = await tokenResponse.json<{
        access_token: string;
        id_token: string;
      }>();

      // Get user info from Google
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        },
      );

      if (!userInfoResponse.ok) {
        return c.json(
          {
            success: false,
            error: "Failed to get user info from Google",
          },
          400,
        );
      }

      const googleUser = await userInfoResponse.json<GoogleUserInfo>();

      console.log("Google user info:", JSON.stringify(googleUser));

      // Check if user exists by google_id
      let user = await c.env.GENERAL_DB.prepare(
        "SELECT * FROM users WHERE google_id = ?",
      )
        .bind(googleUser.id)
        .first();

      let isNewUser = false;

      if (!user) {
        // Check if user exists by email
        user = await c.env.GENERAL_DB.prepare(
          "SELECT * FROM users WHERE email = ?",
        )
          .bind(googleUser.email)
          .first();

        if (user) {
          // Link Google account to existing user

          console.log("Linking Google account to existing user:", user.id);
          await c.env.GENERAL_DB.prepare(
            "UPDATE users SET google_id = ?, name = ?, profile_photo_url = COALESCE(profile_photo_url, ?) WHERE id = ?",
          )
            .bind(
              googleUser.id,
              googleUser.name,
              googleUser.picture || null,
              user.id,
            )
            .run();
        } else {
          // Create new user
          isNewUser = true;
          const userId = crypto.randomUUID();

          await c.env.GENERAL_DB.prepare(
            `INSERT INTO users (
              id, email, name, google_id, profile_photo_url, is_verified, created_at
            ) VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
          )
            .bind(
              userId,
              googleUser.email,
              googleUser.name,
              googleUser.id,
              googleUser.picture || null,
            )
            .run();

          user = await c.env.GENERAL_DB.prepare(
            "SELECT * FROM users WHERE id = ?",
          )
            .bind(userId)
            .first();

          // Send welcome email
          try {
            const emailService = new EmailService(c.env.BREVO_API_KEY);
            await emailService.sendWelcomeEmail(
              googleUser.email,
              googleUser.name,
            );
          } catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
            // Don't fail the request if email fails
          }
        }
      }

      if (!user) {
        return c.json(
          {
            success: false,
            error: "Failed to create or retrieve user",
          },
          500,
        );
      }

      // Generate JWT tokens
      const accessToken = await generateJWT(
        user.id as string,
        user.email as string,
        (user.phone as string) || null,
        user.name as string,
        c.env.JWT_SECRET,
        15 * 60, // 15 minutes
      );

      const refreshTokenValue = await generateRefreshToken(
        user.id as string,
        c.env.JWT_SECRET,
        30 * 24 * 60 * 60, // 30 days
      );
      const hashedRefreshToken = await hashRefreshToken(refreshTokenValue);

      // Store refresh token
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 30 * 24 * 60 * 60;

      console.log("Storing refresh token for user:", user.id);

      await c.env.GENERAL_DB.prepare(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          crypto.randomUUID(),
          user.id,
          hashedRefreshToken,
          expiresAt,
          now,
          c.req.header("cf-connecting-ip") || null,
          c.req.header("user-agent") || null,
        )
        .run();

      return c.json({
        success: true,
        data: {
          access_token: accessToken,
          refresh_token: refreshTokenValue,
          expires_in: 900, // 15 minutes in seconds
          user: {
            id: user.id as string,
            email: user.email as string,
            name: user.name as string,
            profile_photo_url: (user.profile_photo_url as string) || null,
            is_verified: Boolean(user.is_verified),
          },
          is_new_user: isNewUser,
        },
      });
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to process OAuth callback",
        },
        500,
      );
    }
  }
}
