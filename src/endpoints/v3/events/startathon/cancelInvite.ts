import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";

/**
 * POST /api/v3/events/startathon/team/invite/:id/cancel
 * Leader cancels a pending invite sent from their own team.
 */
export class StartathonCancelInvite extends OpenAPIRoute {
  schema = {
    summary: "Cancel a pending Startathon team invite",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The invite_id to cancel",
      },
    ],
    responses: {
      "200": {
        description: "Invite cancelled",
        content: {},
      },
      "401": {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "403": {
        description: "Only the team leader can cancel invites",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Invite not found, not pending, or not from caller's team",
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

      if (!user.team_id) {
        return c.json(
          { success: false, error: "You don't have a team" },
          404,
        );
      }
      if (user.role !== "leader") {
        return c.json(
          { success: false, error: "Only the team leader can cancel invites" },
          403,
        );
      }

      const inviteId = c.req.param("id");

      const invite = await c.env.EVENTS_DB.prepare(
        "SELECT invite_id, status FROM startathon_invites WHERE invite_id = ? AND team_id = ?",
      )
        .bind(inviteId, user.team_id)
        .first();

      if (!invite || invite.status !== "pending") {
        return c.json(
          { success: false, error: "Invite not found or not pending" },
          404,
        );
      }

      const now = Math.floor(Date.now() / 1000);
      await c.env.EVENTS_DB.prepare(
        "UPDATE startathon_invites SET status = 'cancelled', responded_at = ? WHERE invite_id = ?",
      )
        .bind(now, inviteId)
        .run();

      console.log("Startathon invite cancelled:", {
        invite_id: inviteId,
        team_id: user.team_id,
        by: user.user_id,
      });

      return c.json({ success: true, message: "Invite cancelled." });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon cancel invite error:");
    }
  }
}
