import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonApplicationMemberRequest,
  StartathonApplicationMemberResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";
import { applicationWindowBlock } from "../../../../utils/startathonApplicationWindow";
import {
  mapApplicationMemberRow,
  unconfirmedTeamBlock,
} from "../../../../utils/startathonApplication";

/**
 * PUT /api/v3/events/startathon/team/application/members/:user_id
 * Sets one member's own details on the team's application. Callable by
 * that member, or by the leader on their behalf.
 *
 * Full replace: an omitted field is cleared, not preserved. Each member
 * owns their own row, so two members writing at once can't clobber each
 * other the way a shared JSON blob would.
 *
 * Deliberately independent of the application row — a member can fill
 * their details in before the leader has submitted anything.
 */
export class StartathonPutApplicationMember extends OpenAPIRoute {
  schema = {
    summary: "Set a member's details on my Startathon team's application",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "user_id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The member to write. Must be yourself unless you're the leader.",
      },
    ],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonApplicationMemberRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Member details saved",
        content: {
          "application/json": {
            schema: StartathonApplicationMemberResponse,
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
        description:
          "Writing another member's details without being the leader, or applications are closed",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Caller has no team, or target is not on that team",
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

      const closed = applicationWindowBlock(
        c.env.STARTATHON_APPLICATION_CLOSES_AT,
      );
      if (closed) {
        return c.json({ success: false, error: closed.error }, closed.status);
      }

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

      // The FK guarantees the user exists, not that they're on this team —
      // membership lives in startathon_users.team_id, so check it here.
      const target = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, name, role FROM startathon_users WHERE user_id = ? AND team_id = ?",
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
      const { about, resume_url, github, linkedin, project_links } = data.body;

      const now = Math.floor(Date.now() / 1000);
      const projectLinksJson = project_links
        ? JSON.stringify(project_links)
        : null;

      await c.env.EVENTS_DB.prepare(
        `INSERT INTO startathon_application_members
           (team_id, user_id, about, resume_url, github, linkedin,
            project_links, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(team_id, user_id) DO UPDATE SET
           about = excluded.about,
           resume_url = excluded.resume_url,
           github = excluded.github,
           linkedin = excluded.linkedin,
           project_links = excluded.project_links,
           updated_at = excluded.updated_at`,
      )
        .bind(
          user.team_id,
          targetUserId,
          about ?? null,
          resume_url ?? null,
          github ?? null,
          linkedin ?? null,
          projectLinksJson,
          now,
        )
        .run();

      console.log("Startathon application member updated:", {
        team_id: user.team_id,
        user_id: targetUserId,
        by: user.user_id,
      });

      return c.json({
        success: true,
        data: mapApplicationMemberRow({
          user_id: targetUserId,
          name: target.name,
          role: target.role,
          about: about ?? null,
          resume_url: resume_url ?? null,
          github: github ?? null,
          linkedin: linkedin ?? null,
          project_links: projectLinksJson,
          updated_at: now,
        }),
      });
    } catch (error) {
      return handleEndpointError(
        c,
        error,
        "Startathon put application member error:",
      );
    }
  }
}
