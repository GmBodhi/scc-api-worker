import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonPasswordResetRequestSchema,
  ErrorResponse,
} from "../../../../types";
import { EmailService } from "../../../../services/emailService";

/**
 * POST /api/v3/events/startathon/auth/password/reset
 * Request a password reset email (always returns success — no enumeration)
 */
export class StartathonPasswordResetRequest extends OpenAPIRoute {
  schema = {
    summary: "Request Startathon password reset",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonPasswordResetRequestSchema,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Reset email sent if the account exists",
        content: {},
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
      const data = await this.getValidatedData<typeof this.schema>();
      const { email } = data.body;

      const user = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, name, email FROM startathon_users WHERE email = ?",
      )
        .bind(email.toLowerCase())
        .first();

      if (user) {
        const resetToken = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        await c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_reset_tokens (token, user_id, expires_at, created_at)
           VALUES (?, ?, ?, ?)`,
        )
          .bind(resetToken, user.user_id, now + 900, now) // 15 minutes
          .run();

        try {
          const emailService = new EmailService(c.env.BREVO_API_KEY);
          await emailService.sendStartathonPasswordResetEmail(
            user.name as string,
            user.email as string,
            resetToken,
          );
        } catch (emailError) {
          console.error("Startathon reset email error:", emailError);
        }
      } else {
        console.log(
          "Startathon password reset for non-existent email:",
          email,
        );
      }

      return c.json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      console.error("Startathon password reset request error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
