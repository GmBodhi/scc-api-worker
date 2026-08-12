import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  StartathonSrContactsResponse,
  StartathonSrFeedbackRequest,
} from "../../../../../types";
import { handleEndpointError } from "../../../../../utils/errorResponse";
import {
  loadContacts,
  requireCaller,
  srAuth,
} from "../../../../../utils/startathonSr";

/**
 * PUT /api/v3/events/startathon/sr/calls/:team_id/feedback
 * Records the after-call feedback for one team. Full replace.
 *
 * Upserts rather than requiring a prior claim, so an organiser who rings a
 * specific team off-queue can still file the result. The one thing it
 * won't do is walk over somebody else's *open* claim (409) — a row that
 * already has an outcome is fair game, and a later call simply replaces
 * the record and takes ownership.
 */
export class StartathonSrPutCallFeedback extends OpenAPIRoute {
  schema = {
    summary: "Record after-call feedback for a team",
    description: "Staff route. Requires the shared TOKEN in Authorization.",
    parameters: [
      {
        name: "team_id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The team that was called",
      },
    ],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonSrFeedbackRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Feedback saved",
        content: {
          "application/json": {
            schema: StartathonSrContactsResponse,
          },
        },
      },
      "403": {
        description: "Admin token can't file calls — needs a caller token",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Missing or invalid TOKEN, or no such team",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Team is another caller's open claim",
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
      const me = requireCaller(c, auth.identity);
      if ("response" in me) return me.response;
      const caller_id = me.caller.caller_id;

      const teamId = c.req.param("team_id");
      const data = await this.getValidatedData<typeof this.schema>();
      const { outcome, feedback } = data.body;

      const db = c.env.EVENTS_DB;
      const team = await db
        .prepare("SELECT team_id FROM startathon_teams WHERE team_id = ?")
        .bind(teamId)
        .first();
      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 404);
      }

      const existing = await db
        .prepare(
          `SELECT c.caller_id, c.outcome, r.name AS caller_name
             FROM startathon_sr_calls c
             JOIN startathon_sr_callers r ON r.caller_id = c.caller_id
            WHERE c.team_id = ?`,
        )
        .bind(teamId)
        .first();

      if (
        existing &&
        existing.caller_id !== caller_id &&
        existing.outcome === null
      ) {
        return c.json(
          {
            success: false,
            error: `This team is currently claimed by ${existing.caller_name}. Ask them to release it first.`,
          },
          409,
        );
      }

      const now = Date.now();
      await db
        .prepare(
          // attempts counts filed calls, so it climbs on every re-file. An
          // edit to already-filed feedback therefore reads as another
          // attempt — acceptable, since correcting a record is rare and
          // under-counting missed calls would be the worse error.
          `INSERT INTO startathon_sr_calls
             (team_id, caller_id, claimed_at, outcome, feedback, called_at, updated_at, attempts)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT(team_id) DO UPDATE SET
             caller_id  = excluded.caller_id,
             outcome    = excluded.outcome,
             feedback   = excluded.feedback,
             called_at  = excluded.called_at,
             updated_at = excluded.updated_at,
             attempts   = startathon_sr_calls.attempts + 1`,
        )
        .bind(
          teamId,
          caller_id,
          now,
          outcome,
          JSON.stringify(feedback),
          now,
          now,
        )
        .run();

      console.log("Startathon SR feedback:", { team_id: teamId, caller_id, outcome });

      const contacts = await loadContacts(db, "WHERE c.team_id = ?", [teamId]);

      return c.json({
        success: true,
        data: { claimed: contacts.length, contacts },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon SR feedback error:");
    }
  }
}
