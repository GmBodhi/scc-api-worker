import { OpenAPIRoute } from "chanfana";
import z from "zod";
import {
  type AppContext,
  ErrorResponse,
  StartathonSrContactsResponse,
} from "../../../../../types";
import { handleEndpointError } from "../../../../../utils/errorResponse";
import { loadContacts, srAuth } from "../../../../../utils/startathonSr";

/**
 * GET /api/v3/events/startathon/sr/calls
 * A caller's working list, or — for the admin token — the whole campaign.
 *
 * `state=open` is the list still to call, `state=done` the ones with
 * feedback in. Contacts carry their feedback, so this is also how you read
 * back what a team said.
 */
export class StartathonSrListCalls extends OpenAPIRoute {
  schema = {
    summary: "List claimed contacts and their feedback",
    description:
      "A caller token returns only that caller's list; the admin token can filter with ?caller_id= or omit it for the whole campaign.",
    request: {
      query: z.object({
        caller_id: z.string().optional(),
        state: z.enum(["open", "done", "all"]).optional(),
      }),
    },
    responses: {
      "200": {
        description: "Contacts",
        content: {
          "application/json": {
            schema: StartathonSrContactsResponse,
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

      const data = await this.getValidatedData<typeof this.schema>();
      const state = data.query.state ?? "all";

      // A caller only ever sees their own list — the ?caller_id= filter is
      // honoured for the admin key alone, so one volunteer can't read another's
      // working list by guessing an id.
      const caller_id =
        auth.identity.kind === "caller"
          ? auth.identity.caller.caller_id
          : data.query.caller_id;

      const clauses: string[] = [];
      const bindings: unknown[] = [];

      if (caller_id) {
        clauses.push("c.caller_id = ?");
        bindings.push(caller_id);
      }
      if (state === "open") clauses.push("c.outcome IS NULL");
      if (state === "done") clauses.push("c.outcome IS NOT NULL");

      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

      const contacts = await loadContacts(
        c.env.EVENTS_DB,
        `${where} ORDER BY c.claimed_at`,
        bindings,
      );

      return c.json({
        success: true,
        data: { claimed: contacts.length, contacts },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon SR list calls error:");
    }
  }
}
