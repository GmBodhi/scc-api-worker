import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  GetCurrentUserResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";

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
      const AuthContext = await requireAuth(c);
      const user = AuthContext?.user;

      if (!user) {
        return c.json(
          { success: false, error: "Invalid or expired token" },
          401,
        );
      }

      const dbUser = await c.env.GENERAL_DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(user.id)
        .first();
      
      if (!dbUser) {
        return c.json(
          { success: false, error: "User not found" },
          404,
        );
      }

      return c.json({
        success: true,
        data: {
          id: dbUser.id,
          email: dbUser.email,
          phone: dbUser.phone || null,
          name: dbUser.name,
          google_id: dbUser.google_id || null,
          etlab_username: dbUser.etlab_username || null,
          profile_photo_url: dbUser.profile_photo_url || null,
          created_at: dbUser.created_at || 0,
          is_verified: dbUser.is_verified || false,
        },
      });
    } catch (error) {
      console.error("Get current user error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
