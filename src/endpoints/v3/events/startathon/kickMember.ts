import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * POST /api/v3/events/startathon/team/members/:user_id/kick
 * Leader removes a member from their own team. Cannot target the
 * leader themselves (use /team/leave). Locked once 'confirmed'.
 */
export class StartathonKickMember extends OpenAPIRoute {
  schema = {
    summary: "Kick a member from my Startathon team",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "user_id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The user_id of the member to remove",
      },
    ],
    responses: {
      "200": {
        description: "Member removed",
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
        description: "Only the team leader can kick",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Target is not a member of caller's team",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Team is confirmed — roster is locked",
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
          { success: false, error: "Only the team leader can kick" },
          403,
        );
      }

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT status FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();
      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }
      if (team.status !== "payment-pending") {
        return c.json(
          {
            success: false,
            error: "Team is confirmed — roster is locked",
          },
          409,
        );
      }

      const targetUserId = c.req.param("user_id");

      const target = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, role FROM startathon_users WHERE user_id = ? AND team_id = ?",
      )
        .bind(targetUserId, user.team_id)
        .first();

      if (!target || target.role !== "member") {
        return c.json(
          { success: false, error: "That user is not a member of your team" },
          404,
        );
      }

      await c.env.EVENTS_DB.prepare(
        "UPDATE startathon_users SET team_id = NULL, role = NULL WHERE user_id = ?",
      )
        .bind(targetUserId)
        .run();

      console.log("Startathon member kicked:", {
        team_id: user.team_id,
        kicked_user_id: targetUserId,
        by: user.user_id,
      });

      return c.json({ success: true, message: "Member removed from team." });
    } catch (error) {
      console.error("Startathon kick member error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
