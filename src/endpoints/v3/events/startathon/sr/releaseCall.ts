import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../../types";
import { handleEndpointError } from "../../../../../utils/errorResponse";
import { requireCaller, srAuth } from "../../../../../utils/startathonSr";

/**
 * POST /api/v3/events/startathon/sr/calls/:team_id/release
 * Hands an uncalled claim back to the pool without waiting out the TTL.
 *
 * Only the holder can release, and only before feedback exists — dropping a
 * called team would delete the record of the call.
 */
export class StartathonSrReleaseCall extends OpenAPIRoute {
  schema = {
    summary: "Release an uncalled claim back to the pool",
    description: "Requires a personal caller token in Authorization.",
    parameters: [
      {
        name: "team_id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The claimed team to release",
      },
    ],
    responses: {
      "200": {
        description: "Claim released",
        content: {},
      },
      "403": {
        description: "Admin token holds no claims",
        content: {
          "application/json": { schema: ErrorResponse },
        },
      },
      "404": {
        description: "Missing or invalid token, or no open claim to release",
        content: {
          "application/json": { schema: ErrorResponse },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": { schema: ErrorResponse },
        },
      },
    },
  };

  async handle(c: AppContext) {
    try {
      const auth = await srAuth(c);
      if ("response" in auth) return auth.response;
      const me = requireCaller(c, auth.identity);
      if ("response" in me) return me.response;

      const teamId = c.req.param("team_id");

      const result = await c.env.EVENTS_DB.prepare(
        `DELETE FROM startathon_sr_calls
          WHERE team_id = ? AND caller_id = ? AND outcome IS NULL`,
      )
        .bind(teamId, me.caller.caller_id)
        .run();

      if (!result.meta.changes) {
        return c.json(
          {
            success: false,
            error:
              "No open claim on this team — it may already be called, or held by someone else.",
          },
          404,
        );
      }

      return c.json({ success: true });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon SR release error:");
    }
  }
}
