import { OpenAPIRoute } from "chanfana";
import { type AppContext, GoogleOAuthInitiateResponse } from "../../../types";

/**
 * GET /api/v3/auth/google
 * Initiate Google OAuth flow by generating authorization URL
 */
export class GoogleOAuthInitiate extends OpenAPIRoute {
  schema = {
    summary: "Initiate Google OAuth authentication",
    responses: {
      "200": {
        description: "OAuth URL generated successfully",
        content: {
          "application/json": {
            schema: GoogleOAuthInitiateResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    try {
      const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = c.env;

      if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
        return c.json(
          {
            success: false,
            error: "Google OAuth not configured",
          },
          500,
        );
      }

      // Check if client wants account selection (for signup flow)
      const { signup } = c.req.query();

      // Generate random state for CSRF protection
      const state = crypto.randomUUID();

      // Store state in a short-lived way (could use KV or cookies)
      // For now, client should verify state matches what they sent

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: "openid email profile",
        state,
        access_type: "online",
      });

      // Add account selection prompt for signup flow
      if (signup === "true") {
        params.set("prompt", "select_account");
      }

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      return c.json({
        success: true,
        data: {
          auth_url: authUrl,
        },
      });
    } catch (error) {
      console.error("Google OAuth initiate error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to initiate OAuth",
        },
        500,
      );
    }
  }
}
