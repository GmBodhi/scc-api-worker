import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonPaymentRequest,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { EmailService } from "../../../../services/emailService";

/**
 * POST /api/v3/events/startathon/payment
 * Leader links the team's ₹100 UPI payment. Confirms the team and
 * emails every member.
 */
export class StartathonLinkPayment extends OpenAPIRoute {
  schema = {
    summary: "Link payment to Startathon team",
    description:
      "Team leader submits the UPI reference of the ₹100 team fee. On success the team status becomes 'confirmed'.",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonPaymentRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Payment linked, team confirmed",
        content: {},
      },
      "400": {
        description: "Transaction not found/used, or team not payment-pending",
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
        description: "Only the team leader can link payment",
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

      if (user.role !== "leader") {
        return c.json(
          { success: false, error: "Only the team leader can link payment" },
          403,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { transaction_id } = data.body;

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }

      if (team.status !== "payment-pending") {
        return c.json(
          { success: false, error: "Team payment is already completed" },
          400,
        );
      }

      const expectedAmount = team.referred_by ? 90 : 100;

      const transaction = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_transactions WHERE ref = ? AND status = 'unused' AND amount = ?",
      )
        .bind(transaction_id, expectedAmount)
        .first();

      if (!transaction) {
        return c.json(
          { success: false, error: "Transaction not found or already used" },
          400,
        );
      }

      const now = Math.floor(Date.now() / 1000);

      // Guard against a concurrent request racing us for the same
      // transaction ref: only flip status if it's still 'unused', and
      // verify exactly one row was actually changed before touching the
      // team. This closes the TOCTOU window between the SELECT above and
      // this UPDATE.
      const claimResult = await c.env.EVENTS_DB.prepare(
        "UPDATE startathon_transactions SET status = 'used', updatedAt = ? WHERE ref = ? AND status = 'unused'",
      )
        .bind(new Date().toISOString(), transaction_id)
        .run();

      if (claimResult.meta.changes !== 1) {
        return c.json(
          { success: false, error: "Transaction not found or already used" },
          400,
        );
      }

      await c.env.EVENTS_DB.prepare(
        "UPDATE startathon_teams SET status = 'confirmed', transaction_ref = ?, updated_at = ? WHERE team_id = ?",
      )
        .bind(transaction_id, now, user.team_id)
        .run();

      // Confirmation email to every member (non-fatal)
      try {
        const members = await c.env.EVENTS_DB.prepare(
          "SELECT name, email FROM startathon_users WHERE team_id = ?",
        )
          .bind(user.team_id)
          .all();

        const emailService = new EmailService(c.env.BREVO_API_KEY);
        for (const m of members.results) {
          const sent = await emailService.sendStartathonPaymentConfirmationEmail(
            m.name as string,
            m.email as string,
            team.team_name as string,
            user.team_id,
            transaction_id,
          );
          if (!sent) {
            console.error(`Failed to send payment email to ${m.email}`);
          }
        }
      } catch (emailError) {
        console.error("Startathon payment email error:", emailError);
      }

      console.log("Startathon payment linked:", {
        team_id: user.team_id,
        ref: transaction_id,
      });

      return c.json({
        success: true,
        message: "Payment linked. Team confirmed — see you at Startathon!",
      });
    } catch (error) {
      console.error("Startathon link payment error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
