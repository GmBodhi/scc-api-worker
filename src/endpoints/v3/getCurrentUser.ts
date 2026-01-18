import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  GetCurrentUserResponse,
} from "../../types";
import { requireAuth } from "../../middleware/auth";

/**
 * GET /api/v3/auth/me
 * Get current authenticated user
 */
export class GetCurrentUser extends OpenAPIRoute {
  schema = {
    summary: "Get current user",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "User details retrieved successfully",
        content: {
          "application/json": {
            schema: GetCurrentUserResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized - invalid or missing session",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "500": {
        description: "Internal server error",
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
      // Authenticate user (supports both JWT and session)
      const user = await requireAuth(c);

      if (!user) {
        return c.json(
          { success: false, error: "Invalid or expired token" },
          401,
        );
      }

      return c.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          etlab_username: user.etlab_username || null,
          profile_photo_url: user.profile_photo_url || null,
          created_at: user.created_at || 0,
        },
      });
    } catch (error) {
      console.error("Get current user error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
