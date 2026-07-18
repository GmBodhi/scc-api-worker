import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonMeResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";

/**
 * GET /api/v3/events/startathon/me
 * Return the caller's own Startathon account info.
 */
export class StartathonGetMe extends OpenAPIRoute {
  schema = {
    summary: "Get my Startathon account",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Current user",
        content: {
          "application/json": {
            schema: StartathonMeResponse,
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

      return c.json({
        success: true,
        data: {
          user_id: user.user_id,
          team_id: user.team_id,
          role: user.role,
          name: user.name,
          email: user.email,
          phone: user.phone,
          college: user.college,
          gender: user.gender,
        },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon get me error:");
    }
  }
}
