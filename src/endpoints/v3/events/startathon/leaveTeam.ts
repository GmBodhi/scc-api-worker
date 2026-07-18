import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";

/**
 * POST /api/v3/events/startathon/team/leave
 * Member: leaves the team (clears their own team_id/role).
 * Leader: deletes the team entirely, freeing every member and
 * cancelling pending invites. Locked once the team is 'confirmed'.
 */
export class StartathonLeaveTeam extends OpenAPIRoute {
  schema = {
    summary: "Leave my Startathon team",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Left the team (or, if leader, deleted it)",
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
      "404": {
        description: "Caller has no team",
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

      if (!user.team_id || !user.role) {
        return c.json(
          { success: false, error: "You don't have a team" },
          404,
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

      if (user.role === "member") {
        await c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = NULL, role = NULL WHERE user_id = ?",
        )
          .bind(user.user_id)
          .run();

        console.log("Startathon member left team:", {
          user_id: user.user_id,
          team_id: user.team_id,
        });

        return c.json({ success: true, message: "You've left the team." });
      }

      // Leader: delete the team entirely, free every member, drop invites.
      // Every startathon_invites row for this team (any status) still
      // FK-references team_id, and any team that applied this team's
      // referral_code still FK-references it via referred_by — both must
      // be cleared before the DELETE or it fails with a FOREIGN KEY
      // constraint error.
      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = NULL, role = NULL WHERE team_id = ?",
        ).bind(user.team_id),
        c.env.EVENTS_DB.prepare(
          "DELETE FROM startathon_invites WHERE team_id = ?",
        ).bind(user.team_id),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_teams SET referred_by = NULL WHERE referred_by = ?",
        ).bind(user.team_id),
        c.env.EVENTS_DB.prepare(
          "DELETE FROM startathon_teams WHERE team_id = ?",
        ).bind(user.team_id),
      ]);

      console.log("Startathon leader deleted team:", {
        user_id: user.user_id,
        team_id: user.team_id,
      });

      return c.json({
        success: true,
        message: "Team deleted. All members have been freed.",
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon leave team error:");
    }
  }
}
