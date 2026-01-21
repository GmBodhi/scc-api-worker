import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  MarkNotificationReadResponse,
  ErrorResponse,
} from "../../types";
import { requireAuth } from "../../middleware/auth";

/**
 * PUT /api/v3/notifications/:id/read
 * Mark a notification as read
 */
export class MarkNotificationRead extends OpenAPIRoute {
  schema = {
    summary: "Mark notification as read",
    description:
      "Mark a specific notification as read for the authenticated user",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "id",
        in: "path",
        schema: { type: "string" },
        description: "Notification ID",
        required: true,
      },
    ],
    responses: {
      "200": {
        description: "Notification marked as read",
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
      "404": {
        description: "Notification not found",
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

      const notificationId = c.req.param("id");

      // Check if notification exists and belongs to user
      const notification = await c.env.GENERAL_DB.prepare(
        "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
      )
        .bind(notificationId, user.id)
        .first();

      if (!notification) {
        return c.json({ success: false, error: "Notification not found" }, 404);
      }

      // Mark as read
      const now = Math.floor(Date.now() / 1000);
      await c.env.GENERAL_DB.prepare(
        "UPDATE notifications SET read = 1, read_at = ? WHERE id = ?",
      )
        .bind(now, notificationId)
        .run();

      return c.json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      console.error("Mark notification read error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
