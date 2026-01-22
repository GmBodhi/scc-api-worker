import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  LinkHackerRankPaymentRequest,
  LinkTransactionResponse,
  ErrorResponse,
} from "../../../types";
import { EmailService } from "../../../services/emailService";
import { requireAuth } from "../../../middleware/auth";

/**
 * POST /api/v3/events/hackerrank_1/payment
 * Link a payment transaction to HackerRank event registration
 */
export class LinkHackerRankPayment extends OpenAPIRoute {
  schema = {
    summary: "Link payment to HackerRank registration",
    description:
      "Link a payment transaction to your HackerRank event registration. Requires authentication.",
    security: [
      {
        bearerAuth: [],
      },
    ],
    request: {
      body: {
        content: {
          "application/json": {
            schema: LinkHackerRankPaymentRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Payment linked successfully",
        content: {
          "application/json": {
            schema: LinkTransactionResponse,
          },
        },
      },
      "400": {
        description: "Bad request - validation error or business logic failure",
        content: {
          "application/json": {
            schema: LinkTransactionResponse,
          },
        },
      },
      "404": {
        description: "Transaction or registration not found",
        content: {
          "application/json": {
            schema: LinkTransactionResponse,
          },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: LinkTransactionResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    // Require authentication
    const authResult = await requireAuth(c);
    if (!authResult.success || !authResult.user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const data = await this.getValidatedData<typeof this.schema>();
    const { transaction_id } = data.body;
    const userId = authResult.user.id;

    try {
      // Check if transaction exists and is unused
      const transactionResult = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM transactions WHERE ref = ? AND status = 'unused'",
      )
        .bind(transaction_id)
        .first();

      if (!transactionResult) {
        return c.json(
          {
            success: false,
            message: "Transaction not found or already used",
          },
          400,
        );
      }

      // Find user's registration that is payment-pending
      const registrationResult = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM hackerrank_registrations WHERE user_id = ? AND status = 'payment-pending'",
      )
        .bind(userId)
        .first();

      if (!registrationResult) {
        return c.json(
          {
            success: false,
            message:
              "No pending registration found for your account. Please register first or payment may already be completed.",
          },
          400,
        );
      }

      const registrationId = registrationResult.registration_id as string;

      // Update transaction status to 'used'
      await c.env.EVENTS_DB.prepare(
        "UPDATE transactions SET status = 'used', updatedAt = ? WHERE ref = ?",
      )
        .bind(new Date().toISOString(), transaction_id)
        .run();

      // Update registration status to 'confirmed' and link transaction
      await c.env.EVENTS_DB.prepare(
        "UPDATE hackerrank_registrations SET status = 'confirmed', updated_at = ? WHERE registration_id = ?",
      )
        .bind(Math.floor(Date.now() / 1000), registrationId)
        .run();

      // Send payment confirmation email
      try {
        const emailService = new EmailService(c.env.BREVO_API_KEY);
        const emailSent =
          await emailService.sendHackerRankPaymentConfirmationEmail(
            registrationResult.name as string,
            registrationResult.email as string,
            registrationId,
            transaction_id,
          );

        if (!emailSent) {
          console.error(
            `Failed to send payment confirmation email for registration ${registrationId}`,
          );
        } else {
          console.log(
            `Payment confirmation email sent for registration ${registrationId} (${registrationResult.email})`,
          );
        }
      } catch (emailError) {
        console.error("Error sending payment confirmation email:", emailError);
        // Don't fail the payment linking if email fails
      }

      console.log("Payment linked successfully:", {
        user_id: userId,
        registration_id: registrationId,
        transaction_ref: transaction_id,
      });

      return c.json(
        {
          success: true,
          message:
            "Payment linked successfully. Registration confirmed. Confirmation email sent.",
        },
        200,
      );
    } catch (error) {
      console.error("Error linking payment:", error);
      return c.json(
        {
          success: false,
          message: "Internal server error",
        },
        500,
      );
    }
  }
}
