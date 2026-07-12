import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * POST /api/v3/events/startathon/invites/:id/decline
 * Decline a pending invite addressed to the caller's email.
 */
export class StartathonDeclineInvite extends OpenAPIRoute {
  schema = {
    summary: "Decline a Startathon team invite",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The invite ID to decline",
      },
    ],
    responses: {
      "200": {
        description: "Invite declined",
        content: {},
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
        description: "Invite no longer pending",
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

      const inviteId = c.req.param("id");

      const invite = await c.env.EVENTS_DB.prepare(
        "SELECT invite_id, status FROM startathon_invites WHERE invite_id = ? AND invited_email = ?",
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

      const now = Math.floor(Date.now() / 1000);
      await c.env.EVENTS_DB.prepare(
        "UPDATE startathon_invites SET status = 'declined', responded_at = ? WHERE invite_id = ?",
      )
        .bind(now, inviteId)
        .run();

      console.log("Startathon invite declined:", { invite_id: inviteId, user_id: user.user_id });

      return c.json({ success: true, message: "Invite declined." });
    } catch (error) {
      console.error("Startathon decline invite error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
