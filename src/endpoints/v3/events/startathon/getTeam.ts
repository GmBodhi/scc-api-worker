import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonTeamResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * GET /api/v3/events/startathon/team
 * Get the authenticated user's team, members, and payment status.
 * 404 if the caller has no team yet.
 */
export class StartathonGetTeam extends OpenAPIRoute {
  schema = {
    summary: "Get my Startathon team",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Team details",
        content: {
          "application/json": {
            schema: StartathonTeamResponse,
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
        description: "Caller has no team yet",
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
          { success: false, error: "You don't have a team yet" },
          404,
        );
      }

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }

      const members = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, name, email, role FROM startathon_users WHERE team_id = ? ORDER BY CASE role WHEN 'leader' THEN 0 ELSE 1 END, name",
      )
        .bind(user.team_id)
        .all();

      let referralCount: number | null = null;
      if (user.role === "leader") {
        const countRow = await c.env.EVENTS_DB.prepare(
          "SELECT COUNT(*) as cnt FROM startathon_teams WHERE referred_by = ? AND status = 'confirmed'",
        )
          .bind(user.team_id)
          .first();
        referralCount = (countRow?.cnt as number) ?? 0;
      }

      return c.json({
        success: true,
        data: {
          team_id: team.team_id as string,
          team_name: team.team_name as string,
          join_code: team.join_code as string,
          referral_code: team.referral_code as string,
          referred_by: (team.referred_by as string) || null,
          expected_fee: team.referred_by ? 90 : 100,
          referral_count: referralCount,
          status: team.status as string,
          transaction_ref: (team.transaction_ref as string) || null,
          created_at: team.created_at as number,
          your_role: user.role,
          members: members.results.map((m) => ({
            user_id: m.user_id as string,
            name: m.name as string,
            email: m.email as string,
            role: m.role as string,
          })),
        },
      });
    } catch (error) {
      console.error("Startathon get team error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
