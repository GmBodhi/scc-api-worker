import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  GoogleOAuthInitiateResponse,
} from "../../../../types";
import { handleEndpointError } from "../../../../utils/errorResponse";

/**
 * GET /api/v3/events/startathon/auth/google
 * Initiate Google OAuth for startathon.sctcoding.club.
 * Same Google client as the main site; startathon-specific redirect URI.
 */
export class StartathonGoogleInitiate extends OpenAPIRoute {
  schema = {
    summary: "Initiate Startathon Google OAuth",
    responses: {
      "200": {
        description: "OAuth URL generated",
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
      const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI_STARTATHON } = c.env;

      if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI_STARTATHON) {
        return c.json(
          { success: false, error: "Google OAuth not configured" },
          500,
        );
      }

      const state = crypto.randomUUID();

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI_STARTATHON,
        response_type: "code",
        scope: "openid email profile",
        state,
        access_type: "online",
        prompt: "select_account",
      });

      return c.json({
        success: true,
        data: {
          auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        },
      });
    } catch (error) {
      return handleEndpointError(
        c,
        error,
        "Startathon Google OAuth initiate error:",
      );
    }
  }
}
