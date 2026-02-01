import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../types";
import { z } from "zod";
import { requireAuth } from "../../../middleware/auth";

const DisconnectGoogleResponse = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

/**
 * DELETE /api/v3/auth/google
 * Disconnect Google account from user profile
 * Requires authentication
 */
export class GoogleOAuthDisconnect extends OpenAPIRoute {
  schema = {
    summary: "Disconnect Google account from user profile",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Google account disconnected successfully",
        content: {
          "application/json": {
            schema: DisconnectGoogleResponse,
          },
        },
      },
      "400": {
        description: "Cannot disconnect - no password set",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized",
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
      const AuthContext = await requireAuth(c);

      if (!AuthContext?.user) {
        return c.json(
          {
            success: false,
            error: "Unauthorized",
          },
          401,
        );
      }

      const userId = AuthContext.user.id;

      // Get user to check if they have a password
      const user = await c.env.GENERAL_DB.prepare(
        "SELECT password_hash, google_id FROM users WHERE id = ?",
      )
        .bind(userId)
        .first();

      if (!user) {
        return c.json(
          {
            success: false,
            error: "User not found",
          },
          404,
        );
      }

      if (!user.google_id) {
        return c.json(
          {
            success: false,
            error: "No Google account linked",
          },
          400,
        );
      }

      // Prevent disconnecting if user has no password (Google is only auth method)
      if (!user.password_hash) {
        return c.json(
          {
            success: false,
            error:
              "Cannot disconnect Google account. Please set a password first to maintain account access.",
          },
          400,
        );
      }

      // Disconnect Google account
      await c.env.GENERAL_DB.prepare(
        "UPDATE users SET google_id = NULL WHERE id = ?",
      )
        .bind(userId)
        .run();

      return c.json({
        success: true,
        message: "Google account disconnected successfully",
      });
    } catch (error) {
      console.error("Google OAuth disconnect error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to disconnect Google account",
        },
        500,
      );
    }
  }
}
