import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonCreateTeamRequest,
  StartathonCreateTeamResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * POST /api/v3/events/startathon/team
 * Create a team. Caller becomes the leader. Caller must not already
 * be on a team.
 */
export class StartathonCreateTeam extends OpenAPIRoute {
  schema = {
    summary: "Create a Startathon team",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonCreateTeamRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Team created",
        content: {
          "application/json": {
            schema: StartathonCreateTeamResponse,
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
      "409": {
        description: "Already on a team, or team name taken",
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
      const { team_name } = data.body;

      const existingTeam = await c.env.EVENTS_DB.prepare(
        "SELECT team_id FROM startathon_teams WHERE team_name = ?",
      )
        .bind(team_name)
        .first();
      if (existingTeam) {
        return c.json(
          { success: false, error: "Team name is already taken" },
          409,
        );
      }

      const rand = () =>
        Math.random().toString(36).substring(2, 8).toUpperCase();
      const teamId = `ST_${Date.now()}_${rand()}`;
      const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const now = Math.floor(Date.now() / 1000);

      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_teams (team_id, team_name, leader_id, join_code, referral_code, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'payment-pending', ?)`,
        ).bind(teamId, team_name, user.user_id, joinCode, referralCode, now),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = ?, role = 'leader' WHERE user_id = ?",
        ).bind(teamId, user.user_id),
      ]);

      console.log("Startathon team created:", { team_id: teamId, leader: user.user_id });

      return c.json(
        {
          success: true,
          data: {
            team_id: teamId,
            team_name,
            join_code: joinCode,
            referral_code: referralCode,
            status: "payment-pending",
          },
        },
        201,
      );
    } catch (error) {
      console.error("Startathon create team error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
