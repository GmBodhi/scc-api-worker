import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  GetNotificationsResponse,
  ErrorResponse,
} from "../../types";
import { requireAuth } from "../../middleware/auth";

/**
 * GET /api/v3/notifications
 * Get all notifications for authenticated user
 */
export class GetNotifications extends OpenAPIRoute {
  schema = {
    summary: "Get user notifications",
    description: "Retrieve all notifications for the authenticated user",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "unread_only",
        in: "query",
        schema: { type: "boolean" },
        description: "Filter to show only unread notifications",
        required: false,
      },
      {
        name: "limit",
        in: "query",
        schema: { type: "number" },
        description: "Limit number of notifications returned",
        required: false,
      },
    ],
    responses: {
      "200": {
        description: "Notifications retrieved successfully",
        content: {
          "application/json": {
            schema: GetNotificationsResponse,
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

      const unreadOnly = c.req.query("unread_only") === "true";
      const limit = c.req.query("limit")
        ? parseInt(c.req.query("limit") as string)
        : 50;

      // Build query based on filters
      let query = "SELECT * FROM notifications WHERE user_id = ?";
      const bindings: any[] = [user.id];

      if (unreadOnly) {
        query += " AND read = 0";
      }

      query += " ORDER BY created_at DESC";

      if (limit) {
        query += " LIMIT ?";
        bindings.push(limit);
      }

      const { results } = await c.env.GENERAL_DB.prepare(query)
        .bind(...bindings)
        .all();

      // Get unread count
      const unreadCount = await c.env.GENERAL_DB.prepare(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0",
      )
        .bind(user.id)
        .first();

      return c.json({
        success: true,
        data: results,
        unread_count: (unreadCount?.count as number) || 0,
      });
    } catch (error) {
      console.error("Get notifications error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
