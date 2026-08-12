import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  StartathonSrCallerRequest,
  StartathonSrCallerResponse,
} from "../../../../../types";
import { handleEndpointError } from "../../../../../utils/errorResponse";
import { newCallerToken, srAuth } from "../../../../../utils/startathonSr";

/**
 * POST /api/v3/events/startathon/sr/callers
 * Registers a caller and mints their personal token. Admin (SR_TOKEN) only.
 *
 * The token is returned here and nowhere else — it isn't listed by any read
 * route and can't be looked up later. If a volunteer loses it, rotate it via
 * PATCH rather than trying to recover the old one.
 */
export class StartathonSrCreateCaller extends OpenAPIRoute {
  schema = {
    summary: "Register a student-relations caller",
    description:
      "Admin route. Requires SR_TOKEN in Authorization. Returns the caller's personal token once.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonSrCallerRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Caller registered; token returned once",
        content: {
          "application/json": {
            schema: StartathonSrCallerResponse,
          },
        },
      },
      "403": {
        description: "Caller tokens can't register other callers",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Missing or invalid token",
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
      const auth = await srAuth(c);
      if ("response" in auth) return auth.response;
      if (auth.identity.kind !== "admin") {
        return c.json(
          { success: false, error: "Only an organiser can register callers." },
          403,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { name, email } = data.body;

      const callerId = `SRC_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;
      const token = newCallerToken();
      const now = Date.now();

      await c.env.EVENTS_DB.prepare(
        `INSERT INTO startathon_sr_callers (caller_id, name, email, active, created_at, token)
         VALUES (?, ?, ?, 1, ?, ?)`,
      )
        .bind(callerId, name, email ?? null, now, token)
        .run();

      return c.json(
        {
          success: true,
          data: {
            caller_id: callerId,
            name,
            email: email ?? null,
            created_at: now,
            token,
          },
        },
        201,
      );
    } catch (error) {
      return handleEndpointError(c, error, "Startathon SR create caller error:");
    }
  }
}
