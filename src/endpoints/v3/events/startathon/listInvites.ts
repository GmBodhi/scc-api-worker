import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonInvitesResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * GET /api/v3/events/startathon/invites
 * List the caller's own pending invites (matched by their email).
 */
export class StartathonListInvites extends OpenAPIRoute {
  schema = {
    summary: "List my pending Startathon invites",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Pending invites",
        content: {
          "application/json": {
            schema: StartathonInvitesResponse,
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
      const authResult = await requireStartathonAuth(c);
      if (!authResult.success || !authResult.user) {
        return c.json(
          { success: false, error: authResult.error || "Unauthorized" },
          401,
        );
      }
      const user = authResult.user;

      const invites = await c.env.EVENTS_DB.prepare(
        `SELECT i.invite_id, i.created_at, t.team_name, u.name as invited_by_name
         FROM startathon_invites i
         JOIN startathon_teams t ON t.team_id = i.team_id
         JOIN startathon_users u ON u.user_id = i.invited_by
         WHERE i.invited_email = ? AND i.status = 'pending'
         ORDER BY i.created_at DESC`,
      )
        .bind(user.email)
        .all();

      return c.json({
        success: true,
        data: {
          invites: invites.results.map((i) => ({
            invite_id: i.invite_id as string,
            team_name: i.team_name as string,
            invited_by: i.invited_by_name as string,
            created_at: i.created_at as number,
          })),
        },
      });
    } catch (error) {
      console.error("Startathon list invites error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
