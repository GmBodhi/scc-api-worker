import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonLogisticsMemberRequest,
  StartathonLogisticsResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";
import {
  LOGISTICS_ROSTER_QUERY,
  mapLogisticsRow,
} from "../../../../utils/startathonLogistics";
import { syncStartathonRosterSheet } from "../../../../services/startathonRosterSheet";

/**
 * PUT /api/v3/events/startathon/team/logistics/members/:user_id
 * Sets one participant's food and travel details. Callable by that person, or
 * by the leader on their behalf.
 *
 * Full replace, matching the application member endpoint: an omitted field is
 * cleared rather than preserved, so the client always sends the whole form and
 * "I no longer need travel help" is expressible.
 *
 * Writes are gated on the team being shortlisted — an unpicked team filling in
 * arrival times is answering a question nobody asked — while reads are not.
 */
export class StartathonPutLogisticsMember extends OpenAPIRoute {
  schema = {
    summary: "Set a member's Startathon food and travel details",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "user_id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description:
          "The member to write. Must be yourself unless you're the leader.",
      },
    ],
    request: {
      body: {
        content: {
          "application/json": { schema: StartathonLogisticsMemberRequest },
        },
      },
    },
    responses: {
      "200": {
        description: "Saved; returns the whole team roster",
        content: {
          "application/json": { schema: StartathonLogisticsResponse },
        },
      },
      "401": {
        description: "Unauthorized",
        content: { "application/json": { schema: ErrorResponse } },
      },
      "403": {
        description: "Not your row, or team not shortlisted",
        content: { "application/json": { schema: ErrorResponse } },
      },
      "404": {
        description: "Caller has no team, or target is not on that team",
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

      if (!user.team_id) {
        return c.json(
          { success: false, error: "You don't have a team yet" },
          404,
        );
      }

      const targetUserId = c.req.param("user_id");
      if (targetUserId !== user.user_id && user.role !== "leader") {
        return c.json(
          {
            success: false,
            error: "Only the team leader can edit another member's details",
          },
          403,
        );
      }

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT team_id, team_name, shortlist_status FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }

      if (team.shortlist_status !== "shortlisted") {
        return c.json(
          {
            success: false,
            error:
              "Only shortlisted teams fill this in. Nothing to do here yet.",
          },
          403,
        );
      }

      // The FK guarantees the user exists, not that they are on this team —
      // membership lives in startathon_users.team_id, so it is checked here.
      const target = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, name, email, phone, role FROM startathon_users WHERE user_id = ? AND team_id = ?",
      )
        .bind(targetUserId, user.team_id)
        .first();

      if (!target) {
        return c.json(
          { success: false, error: "That user is not on your team" },
          404,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const {
        food_preference,
        dietary_notes,
        travel_mode,
        arrival_at,
        arrival_note,
        needs_travel_guidance,
        guidance_note,
      } = data.body;

      const now = Math.floor(Date.now() / 1000);

      await c.env.EVENTS_DB.prepare(
        `INSERT INTO startathon_participant_logistics
           (user_id, team_id, food_preference, dietary_notes, travel_mode,
            arrival_at, arrival_note, needs_travel_guidance, guidance_note,
            updated_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
         ON CONFLICT(user_id) DO UPDATE SET
           team_id = excluded.team_id,
           food_preference = excluded.food_preference,
           dietary_notes = excluded.dietary_notes,
           travel_mode = excluded.travel_mode,
           arrival_at = excluded.arrival_at,
           arrival_note = excluded.arrival_note,
           needs_travel_guidance = excluded.needs_travel_guidance,
           guidance_note = excluded.guidance_note,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`,
      )
        .bind(
          targetUserId,
          user.team_id,
          food_preference ?? null,
          dietary_notes ?? null,
          travel_mode ?? null,
          arrival_at ?? null,
          arrival_note ?? null,
          needs_travel_guidance ? 1 : 0,
          guidance_note ?? null,
          user.user_id,
          now,
        )
        .run();

      // Mirrored to the sheet after the fact and never awaited by the caller:
      // catering reads the sheet, but a Google outage must not fail a
      // participant's form submission. The next sync — this endpoint, a
      // payment, or the half-hourly cron — repairs a failed one.
      c.executionCtx?.waitUntil(
        syncStartathonRosterSheet(c.env).catch((error) =>
          console.error("Startathon roster sheet sync error:", error),
        ),
      );

      const roster = await c.env.EVENTS_DB.prepare(LOGISTICS_ROSTER_QUERY)
        .bind(user.team_id)
        .all();

      return c.json({
        success: true,
        data: {
          team_id: team.team_id as string,
          team_name: team.team_name as string,
          your_role: user.role as "leader" | "member",
          members: roster.results.map(mapLogisticsRow),
        },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon put logistics error:");
    }
  }
}
