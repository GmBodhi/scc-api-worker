import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonJoinTeamRequest,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";

const TEAM_CAP = 4;

/**
 * POST /api/v3/events/startathon/team/join
 * Join a team using its join_code. Immediate — no accept step, since
 * entering the code is itself the consent action.
 */
export class StartathonJoinTeam extends OpenAPIRoute {
  schema = {
    summary: "Join a Startathon team by code",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonJoinTeamRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Joined the team",
        content: {},
      },
      "400": {
        description: "Team is full",
        content: {
          "application/json": {
            schema: ErrorResponse,
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
        description: "Invalid join code",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Already on a team",
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

      if (user.team_id) {
        return c.json(
          { success: false, error: "You already have a team" },
          409,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { join_code } = data.body;

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT team_id, team_name FROM startathon_teams WHERE join_code = ?",
      )
        .bind(join_code)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Invalid join code" }, 404);
      }

      const countResult = await c.env.EVENTS_DB.prepare(
        "SELECT COUNT(*) as cnt FROM startathon_users WHERE team_id = ?",
      )
        .bind(team.team_id)
        .first();
      if ((countResult?.cnt as number) >= TEAM_CAP) {
        return c.json({ success: false, error: "Team is full" }, 400);
      }

      const now = Math.floor(Date.now() / 1000);

      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = ?, role = 'member' WHERE user_id = ?",
        ).bind(team.team_id, user.user_id),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_invites SET status = 'cancelled', responded_at = ? WHERE invited_email = ? AND status = 'pending'",
        ).bind(now, user.email),
      ]);

      console.log("Startathon joined team:", {
        user_id: user.user_id,
        team_id: team.team_id,
      });

      return c.json({
        success: true,
        message: `Joined team "${team.team_name as string}".`,
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon join team error:");
    }
  }
}
