import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";

/**
 * POST /api/v3/events/startathon/team/leave
 * Member: leaves the team (clears their own team_id/role). Allowed at
 * any status — the ₹100 fee is per-team, so the roster stays editable.
 *
 * Leader: there is no "leave" for a leader, only deleting the team
 * outright, so this is gated on the team being unpaid. A leader of a
 * confirmed team hands over via POST /team/leader first and then leaves
 * as an ordinary member; that keeps the payment and the application
 * attached to a team that still exists.
 */
export class StartathonLeaveTeam extends OpenAPIRoute {
  schema = {
    summary: "Leave my Startathon team",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Left the team (or, if leader, deleted it)",
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
        description: "Caller has no team",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description:
          "Leader of a confirmed team — hand over leadership before leaving",
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

      if (!user.team_id || !user.role) {
        return c.json({ success: false, error: "You don't have a team" }, 404);
      }

      if (user.role === "member") {
        // Mirrors kickMember: the membership and the member's application
        // entry go together, so a stale row can't resurface on rejoin.
        // An unconfirmed selection-fee claim on this person goes too:
        // nothing has been paid for them yet, and a stale cover row would
        // block them from ever being paid for again, here or on another
        // team. A *confirmed* cover row is left alone — real money was
        // received against that seat, and the ledger should keep saying so.
        await c.env.EVENTS_DB.batch([
          c.env.EVENTS_DB.prepare(
            "UPDATE startathon_users SET team_id = NULL, role = NULL WHERE user_id = ?",
          ).bind(user.user_id),
          c.env.EVENTS_DB.prepare(
            "DELETE FROM startathon_application_members WHERE team_id = ? AND user_id = ?",
          ).bind(user.team_id, user.user_id),
          c.env.EVENTS_DB.prepare(
            `DELETE FROM startathon_selection_payment_covers
             WHERE user_id = ?
               AND payment_id IN (
                 SELECT payment_id FROM startathon_selection_payments WHERE status = 'submitted'
               )`,
          ).bind(user.user_id),
        ]);

        console.log("Startathon member left team:", {
          user_id: user.user_id,
          team_id: user.team_id,
        });

        return c.json({ success: true, message: "You've left the team." });
      }

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT status FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }
      if (team.status !== "payment-pending") {
        return c.json(
          {
            success: false,
            error:
              "Your team has already paid, so it can't be deleted. Hand leadership to a teammate first, then leave.",
          },
          409,
        );
      }

      // Leader: delete the team entirely, free every member, drop invites.
      // Every startathon_invites row for this team (any status) still
      // FK-references team_id, and any team that applied this team's
      // referral_code still FK-references it via referred_by — both must
      // be cleared before the DELETE or it fails with a FOREIGN KEY
      // constraint error. The application tables FK-reference team_id
      // too; an unpaid team can't have written one (those endpoints
      // require 'confirmed'), but they're cleared here so the batch
      // stands on its own rather than on that invariant holding forever.
      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET team_id = NULL, role = NULL WHERE team_id = ?",
        ).bind(user.team_id),
        c.env.EVENTS_DB.prepare(
          "DELETE FROM startathon_invites WHERE team_id = ?",
        ).bind(user.team_id),
        c.env.EVENTS_DB.prepare(
          "DELETE FROM startathon_application_members WHERE team_id = ?",
        ).bind(user.team_id),
        c.env.EVENTS_DB.prepare(
          "DELETE FROM startathon_applications WHERE team_id = ?",
        ).bind(user.team_id),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_teams SET referred_by = NULL WHERE referred_by = ?",
        ).bind(user.team_id),
        c.env.EVENTS_DB.prepare(
          "DELETE FROM startathon_teams WHERE team_id = ?",
        ).bind(user.team_id),
      ]);

      console.log("Startathon leader deleted team:", {
        user_id: user.user_id,
        team_id: user.team_id,
      });

      return c.json({
        success: true,
        message: "Team deleted. All members have been freed.",
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon leave team error:");
    }
  }
}
