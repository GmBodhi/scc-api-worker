import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  StartathonSrCallersResponse,
} from "../../../../../types";
import { handleEndpointError } from "../../../../../utils/errorResponse";
import { srAuth } from "../../../../../utils/startathonSr";

/**
 * GET /api/v3/events/startathon/sr/callers
 * The caller roster with per-person progress, plus pool-wide totals.
 *
 * This doubles as the stats endpoint — checking that the work is divided
 * evenly and checking who has called whom are the same question, and both
 * come out of the same two aggregates.
 */
export class StartathonSrListCallers extends OpenAPIRoute {
  schema = {
    summary: "List student-relations callers with their progress",
    description:
      "Readable by any caller token or the admin token. Personal tokens are never included.",
    responses: {
      "200": {
        description: "Callers and progress",
        content: {
          "application/json": {
            schema: StartathonSrCallersResponse,
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

      const db = c.env.EVENTS_DB;
      const [callers, counts, confirmed] = await db.batch([
        db.prepare(
          "SELECT caller_id, name, email, active, created_at FROM startathon_sr_callers ORDER BY created_at",
        ),
        // One row per (caller, outcome); NULL outcome is a claim not yet
        // called. Grouping this way gives both the per-caller totals and
        // the outcome breakdown without a second pass over the table.
        db.prepare(
          "SELECT caller_id, outcome, COUNT(*) AS n FROM startathon_sr_calls GROUP BY caller_id, outcome",
        ),
        db.prepare(
          "SELECT COUNT(*) AS n FROM startathon_teams WHERE status = 'confirmed'",
        ),
      ]);

      const stats = new Map<
        string,
        { claimed: number; called: number; by_outcome: Record<string, number> }
      >();
      for (const raw of counts.results as unknown as Record<string, unknown>[]) {
        const callerId = raw.caller_id as string;
        const outcome = raw.outcome as string | null;
        const n = raw.n as number;

        let entry = stats.get(callerId);
        if (!entry) {
          entry = { claimed: 0, called: 0, by_outcome: {} };
          stats.set(callerId, entry);
        }
        entry.claimed += n;
        if (outcome) {
          entry.called += n;
          entry.by_outcome[outcome] = (entry.by_outcome[outcome] ?? 0) + n;
        }
      }

      let totalClaimed = 0;
      let totalCalled = 0;
      for (const entry of stats.values()) {
        totalClaimed += entry.claimed;
        totalCalled += entry.called;
      }

      const confirmedTeams =
        ((confirmed.results[0] as Record<string, unknown>)?.n as number) ?? 0;

      return c.json({
        success: true,
        data: {
          totals: {
            confirmed_teams: confirmedTeams,
            claimed: totalClaimed,
            called: totalCalled,
            // Floored at zero: a team that was confirmed when claimed and
            // has since changed status would otherwise read as negative.
            unclaimed: Math.max(0, confirmedTeams - totalClaimed),
          },
          callers: (callers.results as unknown as Record<string, unknown>[]).map(
            (row) => {
              const entry = stats.get(row.caller_id as string);
              return {
                caller_id: row.caller_id as string,
                name: row.name as string,
                email: (row.email as string | null) ?? null,
                active: Boolean(row.active),
                claimed: entry?.claimed ?? 0,
                called: entry?.called ?? 0,
                pending: (entry?.claimed ?? 0) - (entry?.called ?? 0),
                by_outcome: entry?.by_outcome ?? {},
                created_at: row.created_at as number,
              };
            },
          ),
        },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon SR list callers error:");
    }
  }
}
