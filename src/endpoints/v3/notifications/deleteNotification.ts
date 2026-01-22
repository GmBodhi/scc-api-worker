import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  MarkNotificationReadResponse,
  ErrorResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";

/**
 * DELETE /api/v3/notifications/:id
 * Delete a notification
 */
export class DeleteNotification extends OpenAPIRoute {
  schema = {
    summary: "Delete notification",
    description: "Delete a specific notification for the authenticated user",
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
        description: "Notification deleted successfully",
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

      // Delete notification
      await c.env.GENERAL_DB.prepare("DELETE FROM notifications WHERE id = ?")
        .bind(notificationId)
        .run();

      return c.json({
        success: true,
        message: "Notification deleted successfully",
      });
    } catch (error) {
      console.error("Delete notification error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
