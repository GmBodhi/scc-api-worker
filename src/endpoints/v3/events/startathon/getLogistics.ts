import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonLogisticsResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";
import {
  LOGISTICS_ROSTER_QUERY,
  mapLogisticsRow,
} from "../../../../utils/startathonLogistics";

/**
 * GET /api/v3/events/startathon/team/logistics
 * The team roster with each member's food and travel answers.
 *
 * Reads are open to any member of any team, unlike writes: a team that is not
 * shortlisted can still look at an empty form, and seeing it is how they learn
 * what will be asked. The gaps are the useful part of this response — a member
 * who has answered nothing comes back as nulls with updated_at: null rather
 * than being absent.
 */
export class StartathonGetLogistics extends OpenAPIRoute {
  schema = {
    summary: "Get my Startathon team's food and travel details",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Roster with each member's logistics",
        content: {
          "application/json": { schema: StartathonLogisticsResponse },
        },
      },
      "401": {
        description: "Unauthorized",
        content: { "application/json": { schema: ErrorResponse } },
      },
      "404": {
        description: "Caller has no team",
        content: { "application/json": { schema: ErrorResponse } },
      },
      "500": {
        description: "Internal server error",
        content: { "application/json": { schema: ErrorResponse } },
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
        "SELECT team_id, team_name FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }

      const roster = await c.env.EVENTS_DB.prepare(LOGISTICS_ROSTER_QUERY)
        .bind(user.team_id)
        .all();

      return c.json({
        success: true,
        data: {
          team_id: team.team_id as string,
          team_name: team.team_name as string,
          your_role: user.role,
          members: roster.results.map(mapLogisticsRow),
        },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon get logistics error:");
    }
  }
}
