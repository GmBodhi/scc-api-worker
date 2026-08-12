import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  StartathonSrMeResponse,
} from "../../../../../types";
import { handleEndpointError } from "../../../../../utils/errorResponse";
import { requireCaller, srAuth } from "../../../../../utils/startathonSr";

/**
 * GET /api/v3/events/startathon/sr/me
 * Resolves a personal token to the caller behind it.
 *
 * This is what makes the sign-in one step: paste your token and the app knows
 * who you are, instead of picking your own name off a shared list.
 */
export class StartathonSrGetMe extends OpenAPIRoute {
  schema = {
    summary: "Who does this caller token belong to?",
    description: "Requires a personal caller token in Authorization.",
    responses: {
      "200": {
        description: "The caller",
        content: {
          "application/json": { schema: StartathonSrMeResponse },
        },
      },
      "403": {
        description: "Admin token has no caller identity",
        content: {
          "application/json": { schema: ErrorResponse },
        },
      },
      "404": {
        description: "Missing or invalid token",
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

      return c.json({
        success: true,
        data: {
          caller_id: me.caller.caller_id,
          name: me.caller.name,
          email: me.caller.email,
        },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon SR me error:");
    }
  }
}
