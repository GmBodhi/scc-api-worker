import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonAuthResponse,
  ErrorResponse,
} from "../../../../types";
import { generateStartathonJWT } from "../../../../utils/startathonJwt";
import { findOrCreateStartathonGoogleUser } from "../../../../utils/startathonGoogleUser";

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture?: string;
}

/**
 * GET /api/v3/events/startathon/auth/google/callback
 * Handle Google OAuth callback for startathon.sctcoding.club.
 * Sign-up-or-login: creates a new teamless account on first Google
 * login (matching the main site's behavior), same as email signup.
 */
export class StartathonGoogleCallback extends OpenAPIRoute {
  schema = {
    summary: "Handle Startathon Google OAuth callback",
    responses: {
      "200": {
        description: "Logged in or signed up",
        content: {
          "application/json": {
            schema: StartathonAuthResponse,
          },
        },
      },
      "400": {
        description: "Invalid request",
        content: {
          "application/json": {
            schema: ErrorResponse,
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
          { success: false, error: "Missing authorization code or state" },
          400,
        );
      }

      const {
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI_STARTATHON,
      } = c.env;

      if (
        !GOOGLE_CLIENT_ID ||
        !GOOGLE_CLIENT_SECRET ||
        !GOOGLE_REDIRECT_URI_STARTATHON
      ) {
        return c.json(
          { success: false, error: "Google OAuth not configured" },
          500,
        );
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI_STARTATHON,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        console.error("Token exchange error:", await tokenResponse.text());
        return c.json(
          { success: false, error: "Failed to exchange authorization code" },
          400,
        );
      }

      const tokenData = await tokenResponse.json<{ access_token: string }>();

      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );

      if (!userInfoResponse.ok) {
        return c.json(
          { success: false, error: "Failed to get user info from Google" },
          400,
        );
      }

      const googleUser = await userInfoResponse.json<GoogleUserInfo>();

      const user = await findOrCreateStartathonGoogleUser(c.env.EVENTS_DB, {
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
      });

      if (!user) {
        return c.json(
          { success: false, error: "Failed to create or retrieve account" },
          500,
        );
      }

      const accessToken = await generateStartathonJWT(
        user.user_id as string,
        user.email as string,
        user.name as string,
        c.env.JWT_SECRET,
      );

      return c.json({
        success: true,
        data: {
          access_token: accessToken,
          expires_in: 7 * 24 * 60 * 60,
          user: {
            user_id: user.user_id as string,
            team_id: (user.team_id as string) || null,
            role: (user.role as string) || null,
            name: user.name as string,
            email: user.email as string,
            phone: (user.phone as string) || null,
            college: (user.college as string) || null,
          },
        },
      });
    } catch (error) {
      console.error("Startathon Google OAuth callback error:", error);
      return c.json(
        { success: false, error: "Failed to process OAuth callback" },
        500,
      );
    }
  }
}
