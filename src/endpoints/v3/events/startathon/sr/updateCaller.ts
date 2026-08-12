import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  StartathonSrCallerResponse,
  StartathonSrUpdateCallerRequest,
} from "../../../../../types";
import { handleEndpointError } from "../../../../../utils/errorResponse";
import { newCallerToken, srAuth } from "../../../../../utils/startathonSr";

/**
 * PATCH /api/v3/events/startathon/sr/callers/:caller_id
 * Deactivate a caller, or rotate their token. Admin (SR_TOKEN) only.
 *
 * Deactivating stops their token working immediately but leaves their filed
 * calls and stats intact — the record of who called whom should outlive the
 * volunteer's involvement. Their open claims are untouched and simply expire
 * back to the pool.
 *
 * A rotated token is returned once, same as at creation.
 */
export class StartathonSrUpdateCaller extends OpenAPIRoute {
  schema = {
    summary: "Deactivate a caller or rotate their token",
    description: "Admin route. Requires SR_TOKEN in Authorization.",
    parameters: [
      {
        name: "caller_id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The caller to update",
      },
    ],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonSrUpdateCallerRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Caller updated; token present only if rotated",
        content: {
          "application/json": {
            schema: StartathonSrCallerResponse,
          },
        },
      },
      "403": {
        description: "Caller tokens can't manage callers",
        content: {
          "application/json": { schema: ErrorResponse },
        },
      },
      "404": {
        description: "Missing or invalid token, or no such caller",
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
      if (auth.identity.kind !== "admin") {
        return c.json(
          { success: false, error: "Only an organiser can manage callers." },
          403,
        );
      }

      const callerId = c.req.param("caller_id");
      const data = await this.getValidatedData<typeof this.schema>();
      const { active, rotate } = data.body;

      const db = c.env.EVENTS_DB;
      const existing = await db
        .prepare(
          "SELECT caller_id, name, email, created_at FROM startathon_sr_callers WHERE caller_id = ?",
        )
        .bind(callerId)
        .first();

      if (!existing) {
        return c.json({ success: false, error: "Caller not found" }, 404);
      }

      const token = rotate ? newCallerToken() : null;

      // COALESCE so an omitted field leaves the column alone — a request that
      // only rotates shouldn't silently reactivate someone who was disabled.
      await db
        .prepare(
          `UPDATE startathon_sr_callers
              SET active = COALESCE(?, active),
                  token  = COALESCE(?, token)
            WHERE caller_id = ?`,
        )
        .bind(active === undefined ? null : active ? 1 : 0, token, callerId)
        .run();

      console.log("Startathon SR caller updated:", {
        caller_id: callerId,
        active,
        rotated: Boolean(rotate),
      });

      return c.json({
        success: true,
        data: {
          caller_id: existing.caller_id as string,
          name: existing.name as string,
          email: (existing.email as string | null) ?? null,
          created_at: existing.created_at as number,
          ...(token ? { token } : {}),
        },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon SR update caller error:");
    }
  }
}
