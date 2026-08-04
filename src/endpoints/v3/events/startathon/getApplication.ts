import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonApplicationResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";
import {
  APPLICATION_MEMBERS_QUERY,
  mapApplicationMemberRow,
} from "../../../../utils/startathonApplication";

/**
 * GET /api/v3/events/startathon/team/application
 * Any team member reads the team's application, including the full member
 * roster. 404 if the caller has no team, or the leader hasn't submitted yet.
 */
export class StartathonGetApplication extends OpenAPIRoute {
  schema = {
    summary: "Get my Startathon team's application",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Application details",
        content: {
          "application/json": {
            schema: StartathonApplicationResponse,
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
        description: "Caller has no team, or team has no application yet",
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
        return c.json({ success: false, error: "You don't have a team yet" }, 404);
      }

      const application = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_applications WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!application) {
        return c.json(
          {
            success: false,
            error: "Your team hasn't submitted an application yet",
          },
          404,
        );
      }

      const members = await c.env.EVENTS_DB.prepare(APPLICATION_MEMBERS_QUERY)
        .bind(user.team_id)
        .all();

      return c.json({
        success: true,
        data: {
          team_id: application.team_id as string,
          title: application.title as string,
          summary: application.summary as string,
          problem_evidence: application.problem_evidence as string,
          deck_url: application.deck_url as string,
          video_url: application.video_url as string,
          prior_work: application.prior_work
            ? JSON.parse(application.prior_work as string)
            : null,
          members: members.results.map(mapApplicationMemberRow),
          created_at: application.created_at as number,
          updated_at: (application.updated_at as number) || null,
        },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon get application error:");
    }
  }
}
