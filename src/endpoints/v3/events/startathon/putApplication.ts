import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonApplicationRequest,
  StartathonApplicationResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";
import { applicationWindowBlock } from "../../../../utils/startathonApplicationWindow";
import {
  APPLICATION_MEMBERS_QUERY,
  mapApplicationMemberRow,
  unconfirmedTeamBlock,
} from "../../../../utils/startathonApplication";

/**
 * PUT /api/v3/events/startathon/team/application
 * Leader submits or edits the team's shortlisting application. Upserts —
 * callable repeatedly until the deadline in STARTATHON_APPLICATION_CLOSES_AT.
 *
 * Full replace: the deck and video carry the pitch, so this row is small
 * enough that "send the whole thing" beats partial-update semantics. That
 * includes domains and prior_work — omitting either stores NULL (never
 * answered) rather than silently preserving a previous declaration.
 */
export class StartathonPutApplication extends OpenAPIRoute {
  schema = {
    summary: "Submit or edit my Startathon team's application",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonApplicationRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Application updated",
        content: {
          "application/json": {
            schema: StartathonApplicationResponse,
          },
        },
      },
      "201": {
        description: "Application submitted for the first time",
        content: {
          "application/json": {
            schema: StartathonApplicationResponse,
          },
        },
      },
      "400": {
        description: "Validation error",
        content: {
          "application/json": {
            schema: ErrorResponse,
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
      "403": {
        description: "Not the team leader, or applications are closed",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Caller has no team",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Team payment is still pending",
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

      if (!user.team_id) {
        return c.json({ success: false, error: "You don't have a team yet" }, 404);
      }
      if (user.role !== "leader") {
        return c.json(
          {
            success: false,
            error: "Only the team leader can submit the application",
          },
          403,
        );
      }

      const closed = applicationWindowBlock(
        c.env.STARTATHON_APPLICATION_CLOSES_AT,
      );
      if (closed) {
        return c.json({ success: false, error: closed.error }, closed.status);
      }

      // Checked after the deadline so a closed window costs no query.
      const unconfirmed = await unconfirmedTeamBlock(
        c.env.EVENTS_DB,
        user.team_id,
      );
      if (unconfirmed) {
        return c.json(
          { success: false, error: unconfirmed.error },
          unconfirmed.status,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const {
        title,
        summary,
        problem_evidence,
        deck_url,
        video_url,
        domains,
        prior_work,
      } = data.body;

      const existing = await c.env.EVENTS_DB.prepare(
        "SELECT created_at FROM startathon_applications WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      const now = Math.floor(Date.now() / 1000);
      const domainsJson = domains ? JSON.stringify(domains) : null;
      const priorWorkJson = prior_work ? JSON.stringify(prior_work) : null;

      if (existing) {
        await c.env.EVENTS_DB.prepare(
          `UPDATE startathon_applications
           SET title = ?, summary = ?, problem_evidence = ?,
               deck_url = ?, video_url = ?, domains = ?, prior_work = ?,
               updated_at = ?
           WHERE team_id = ?`,
        )
          .bind(
            title,
            summary,
            problem_evidence,
            deck_url,
            video_url,
            domainsJson,
            priorWorkJson,
            now,
            user.team_id,
          )
          .run();
      } else {
        await c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_applications
             (team_id, title, summary, problem_evidence, deck_url, video_url,
              domains, prior_work, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            user.team_id,
            title,
            summary,
            problem_evidence,
            deck_url,
            video_url,
            domainsJson,
            priorWorkJson,
            now,
          )
          .run();
      }

      const members = await c.env.EVENTS_DB.prepare(APPLICATION_MEMBERS_QUERY)
        .bind(user.team_id)
        .all();

      console.log("Startathon application upserted:", { team_id: user.team_id });

      return c.json(
        {
          success: true,
          data: {
            team_id: user.team_id,
            title,
            summary,
            problem_evidence,
            deck_url,
            video_url,
            domains: domains ?? null,
            prior_work: prior_work ?? null,
            members: members.results.map(mapApplicationMemberRow),
            created_at: existing ? (existing.created_at as number) : now,
            updated_at: existing ? now : null,
          },
        },
        existing ? 200 : 201,
      );
    } catch (error) {
      return handleEndpointError(c, error, "Startathon put application error:");
    }
  }
}
