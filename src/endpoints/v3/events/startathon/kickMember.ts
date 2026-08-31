import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";

/**
 * POST /api/v3/events/startathon/team/members/:user_id/kick
 * Leader removes a member from their own team. Cannot target the
 * leader themselves (use /team/leader to hand over, then /team/leave).
 *
 * Allowed at any team status. The ₹100 fee is per-team, not per-head, so
 * a roster change after payment doesn't disturb the transaction — and
 * teams need to be able to swap people out right up to the event.
 */
export class StartathonKickMember extends OpenAPIRoute {
  schema = {
    summary: "Kick a member from my Startathon team",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "user_id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "The user_id of the member to remove",
      },
    ],
    responses: {
      "200": {
        description: "Member removed",
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
      "403": {
        description: "Only the team leader can kick",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Target is not a member of caller's team",
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
        return c.json({ success: false, error: "You don't have a team" }, 404);
      }
      if (user.role !== "leader") {
        return c.json(
          { success: false, error: "Only the team leader can kick" },
          403,
        );
      }

      const targetUserId = c.req.param("user_id");

      const target = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, role FROM startathon_users WHERE user_id = ? AND team_id = ?",
      )
        .bind(targetUserId, user.team_id)
        .first();

      if (!target || target.role !== "member") {
        return c.json(
          { success: false, error: "That user is not a member of your team" },
          404,
        );
      }

      // Drop their application entry alongside the membership: an
      // application_members row keyed to a team the user is no longer on
      // is invisible to every read (the roster query joins out from
      // startathon_users) but would silently resurface if they rejoined.
      // An unconfirmed selection-fee claim on this person goes too:
      // nothing has been paid for them yet, and a stale cover row would
      // block them from ever being paid for again, here or on another
      // team. A *confirmed* cover row is left alone — real money was
      // received against that seat, and the ledger should keep saying so.
      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = NULL, role = NULL WHERE user_id = ?",
        ).bind(targetUserId),
        c.env.EVENTS_DB.prepare(
          "DELETE FROM startathon_application_members WHERE team_id = ? AND user_id = ?",
        ).bind(user.team_id, targetUserId),
        c.env.EVENTS_DB.prepare(
          `DELETE FROM startathon_selection_payment_covers
           WHERE user_id = ?
             AND payment_id IN (
             SELECT payment_id FROM startathon_selection_payments WHERE status = 'submitted'
             )`,
        ).bind(targetUserId),
      ]);

      console.log("Startathon member kicked:", {
        team_id: user.team_id,
        kicked_user_id: targetUserId,
        by: user.user_id,
      });

      return c.json({ success: true, message: "Member removed from team." });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon kick member error:");
    }
  }
}
