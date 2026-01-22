import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  MarkNotificationReadResponse,
  ErrorResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";

/**
 * PUT /api/v3/notifications/read-all
 * Mark all notifications as read for authenticated user
 */
export class MarkAllNotificationsRead extends OpenAPIRoute {
  schema = {
    summary: "Mark all notifications as read",
    description: "Mark all notifications as read for the authenticated user",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "All notifications marked as read",
        content: {
          "application/json": {
            schema: MarkNotificationReadResponse,
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
      const authContext = await requireAuth(c);
      const user = authContext?.user;

      if (!user) {
        return c.json(
          { success: false, error: "Invalid or expired token" },
          401,
        );
      }

      const now = Math.floor(Date.now() / 1000);

      // Mark all unread notifications as read
      await c.env.GENERAL_DB.prepare(
        "UPDATE notifications SET read = 1, read_at = ? WHERE user_id = ? AND read = 0",
      )
        .bind(now, user.id)
        .run();

      return c.json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
