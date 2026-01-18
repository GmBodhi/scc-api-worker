import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse, LogoutResponse } from "../../types";
import { requireAuth } from "../../middleware/auth";

/**
 * POST /api/v3/auth/logout
 * Logout current user
 */
export class Logout extends OpenAPIRoute {
  schema = {
    summary: "Logout user",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Logout successful",
        content: {
          "application/json": {
            schema: LogoutResponse,
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
      // Verify authentication (JWT validation)
      const authResult = await requireAuth(c);
      if (!authResult.success) {
        return c.json(
          { success: false, error: authResult.error || "Unauthorized" },
          401,
        );
      }

      // For JWT, logout is handled client-side by deleting the token
      // Server-side, we just confirm the token was valid
      return c.json({
        success: true,
        message:
          "Logged out successfully. Please delete the token from client storage.",
      });
    } catch (error) {
      console.error("Logout error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
