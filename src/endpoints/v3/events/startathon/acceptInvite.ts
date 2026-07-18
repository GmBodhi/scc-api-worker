import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";

const TEAM_CAP = 4;

/**
 * POST /api/v3/events/startathon/invites/:id/accept
 * Accept a pending invite addressed to the caller's email. Joins the
 * team and auto-cancels the caller's other pending invites.
 */
export class StartathonAcceptInvite extends OpenAPIRoute {
  schema = {
    summary: "Accept a Startathon team invite",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The invite ID to accept",
      },
    ],
    responses: {
      "200": {
        description: "Joined the team",
        content: {},
      },
      "400": {
        description: "Team is full",
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
      "404": {
        description: "Invite not found or not addressed to caller",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Already on a team, or invite no longer pending",
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

      if (user.team_id) {
        return c.json(
          { success: false, error: "You already have a team" },
          409,
        );
      }

      const inviteId = c.req.param("id");

      const invite = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_invites WHERE invite_id = ? AND invited_email = ?",
      )
        .bind(inviteId, user.email)
        .first();

      if (!invite) {
        return c.json({ success: false, error: "Invite not found" }, 404);
      }
      if (invite.status !== "pending") {
        return c.json(
          { success: false, error: "This invite is no longer pending" },
          409,
        );
      }

      const countResult = await c.env.EVENTS_DB.prepare(
        "SELECT COUNT(*) as cnt FROM startathon_users WHERE team_id = ?",
      )
        .bind(invite.team_id)
        .first();
      if ((countResult?.cnt as number) >= TEAM_CAP) {
        return c.json({ success: false, error: "Team is full" }, 400);
      }

      const now = Math.floor(Date.now() / 1000);

      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = ?, role = 'member' WHERE user_id = ?",
        ).bind(invite.team_id, user.user_id),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_invites SET status = 'accepted', responded_at = ? WHERE invite_id = ?",
        ).bind(now, inviteId),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_invites SET status = 'cancelled', responded_at = ? WHERE invited_email = ? AND status = 'pending' AND invite_id != ?",
        ).bind(now, user.email, inviteId),
      ]);

      console.log("Startathon invite accepted:", {
        invite_id: inviteId,
        user_id: user.user_id,
        team_id: invite.team_id,
      });

      return c.json({
        success: true,
        message: "Invite accepted. You've joined the team.",
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon accept invite error:");
    }
  }
}
