import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  StartathonSrClaimRequest,
  StartathonSrContactsResponse,
} from "../../../../../types";
import { handleEndpointError } from "../../../../../utils/errorResponse";
import {
  SR_CLAIM_DEFAULT_COUNT,
  SR_CLAIM_MAX_COUNT,
  SR_CLAIM_TTL_MS,
  SR_NO_ANSWER_RETRY_MS,
  loadContacts,
  requireCaller,
  srAuth,
} from "../../../../../utils/startathonSr";

/**
 * POST /api/v3/events/startathon/sr/calls/claim
 * Pulls the next batch of confirmed teams for one caller to work through.
 *
 * The pool is confirmed teams that either have no call row, or have one
 * that's been sitting unclaimed-and-uncalled past the TTL — an abandoned
 * list returns to circulation on the next pull, so no cron is needed. A
 * row that already has an outcome is never re-dealt.
 */
export class StartathonSrClaimCalls extends OpenAPIRoute {
  schema = {
    summary: "Claim the next batch of teams to call",
    description: "Staff route. Requires the shared TOKEN in Authorization.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonSrClaimRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description:
          "Contacts claimed. An empty list means the pool is exhausted.",
        content: {
          "application/json": {
            schema: StartathonSrContactsResponse,
          },
        },
      },
      "403": {
        description: "Admin token can't claim — needs a personal caller token",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Missing or invalid TOKEN",
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

      const data = await this.getValidatedData<typeof this.schema>();
      const count = Math.min(
        SR_CLAIM_MAX_COUNT,
        data.body.count ?? SR_CLAIM_DEFAULT_COUNT,
      );

      const db = c.env.EVENTS_DB;
      const now = Date.now();
      const cutoff = now - SR_CLAIM_TTL_MS;
      const retryAfter = now - SR_NO_ANSWER_RETRY_MS;

      // Three ways into the pool: never touched, an abandoned claim past the
      // TTL, or a no-answer that has rested long enough to try again.
      //
      // COALESCE(called_at, 0) in the ordering is what stops a no-answer team
      // boomeranging straight back to the caller who just rang it — untried
      // teams sort as 0 and go first, retries queue behind them oldest-first.
      const candidates = await db
        .prepare(
          `SELECT t.team_id
             FROM startathon_teams t
             LEFT JOIN startathon_sr_calls c ON c.team_id = t.team_id
            WHERE t.status = 'confirmed'
              AND (c.team_id IS NULL
                   OR (c.outcome IS NULL AND c.claimed_at < ?)
                   OR (c.outcome = 'no-answer' AND c.called_at < ?))
            ORDER BY COALESCE(c.called_at, 0), t.created_at
            LIMIT ?`,
        )
        .bind(cutoff, retryAfter, count)
        .all();

      const teamIds = (
        candidates.results as unknown as Record<string, unknown>[]
      ).map((r) => r.team_id as string);

      if (teamIds.length === 0) {
        return c.json({ success: true, data: { claimed: 0, contacts: [] } });
      }

      // The conflict branch re-checks the same eligibility as the SELECT, so
      // if another caller took a team in between, their claim stands and this
      // statement silently changes nothing. That's the whole race-safety
      // story — no team can end up on two lists.
      //
      // Re-claiming clears the previous outcome and feedback (it's an open
      // claim again) but deliberately keeps `attempts` — the count of how
      // many times this team has been rung is the one thing worth carrying
      // across attempts.
      await db.batch(
        teamIds.map((teamId) =>
          db
            .prepare(
              `INSERT INTO startathon_sr_calls (team_id, caller_id, claimed_at)
               VALUES (?, ?, ?)
               ON CONFLICT(team_id) DO UPDATE SET
                 caller_id  = excluded.caller_id,
                 claimed_at = excluded.claimed_at,
                 outcome    = NULL,
                 feedback   = NULL,
                 called_at  = NULL
               WHERE (startathon_sr_calls.outcome IS NULL
                      AND startathon_sr_calls.claimed_at < ?)
                  OR (startathon_sr_calls.outcome = 'no-answer'
                      AND startathon_sr_calls.called_at < ?)`,
            )
            .bind(teamId, caller_id, now, cutoff, retryAfter),
        ),
      );

      // claimed_at = now identifies exactly the rows this request won,
      // rather than everything the caller has ever held.
      const contacts = await loadContacts(
        db,
        `WHERE c.caller_id = ? AND c.claimed_at = ?
           AND c.team_id IN (SELECT value FROM json_each(?))
         ORDER BY t.created_at`,
        [caller_id, now, JSON.stringify(teamIds)],
      );

      console.log("Startathon SR claim:", {
        caller_id,
        requested: count,
        claimed: contacts.length,
      });

      return c.json({
        success: true,
        data: { claimed: contacts.length, contacts },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon SR claim error:");
    }
  }
}
