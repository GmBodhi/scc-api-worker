import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  CreateNotificationRequest,
  NotificationResponse,
  ErrorResponse,
} from "../../types";

/**
 * POST /api/v3/notifications
 * Create a notification (admin/system use)
 */
export class CreateNotification extends OpenAPIRoute {
  schema = {
    summary: "Create notification",
    description: "Create a new notification for a user (system/admin use)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateNotificationRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Notification created successfully",
        content: {
          "application/json": {
            schema: NotificationResponse,
          },
        },
      },
      "400": {
        description: "Bad request",
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
      const data = await this.getValidatedData<typeof this.schema>();
      const { user_id, title, message, type, link } = data.body;

      // Verify user exists
      const user = await c.env.GENERAL_DB.prepare(
        "SELECT id FROM users WHERE id = ?",
      )
        .bind(user_id)
        .first();

      if (!user) {
        return c.json({ success: false, error: "User not found" }, 400);
      }

      // Create notification
      const notificationId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      await c.env.GENERAL_DB.prepare(
        `INSERT INTO notifications (id, user_id, title, message, type, link, created_at, read, read_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      )
        .bind(
          notificationId,
          user_id,
          title,
          message,
          type || "info",
          link || null,
          now,
        )
        .run();

      const notification = {
        id: notificationId,
        user_id,
        title,
        message,
        type: type || "info",
        link: link || null,
        created_at: now,
        read: 0,
        read_at: null,
      };

      return c.json(
        {
          success: true,
          data: notification,
          message: "Notification created successfully",
        },
        201,
      );
    } catch (error) {
      console.error("Create notification error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
