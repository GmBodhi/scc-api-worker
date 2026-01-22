import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  PasswordResetRequestSchema,
  PasswordResetRequestResponse,
  ErrorResponse,
} from "../../../types";
import { EmailService } from "../../../services/emailService";

/**
 * POST /api/v3/auth/password/reset
 * Request password reset - sends email with reset token
 */
export class PasswordResetRequest extends OpenAPIRoute {
  schema = {
    summary: "Request password reset",
    description: "Send a password reset email to the user",
    request: {
      body: {
        content: {
          "application/json": {
            schema: PasswordResetRequestSchema,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Reset email sent successfully",
        content: {
          "application/json": {
            schema: PasswordResetRequestResponse,
          },
        },
      },
      "404": {
        description: "User not found",
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
      const data = await this.getValidatedData<typeof this.schema>();
      const { email } = data.body;

      // Find user by email - also check if they have a password
      const user = await c.env.GENERAL_DB.prepare(
        "SELECT id, name, email, password_hash FROM users WHERE email = ?",
      )
        .bind(email)
        .first();

      // Always return success to prevent email enumeration
      // But only send email if user exists
      if (user) {
        // Generate reset token (UUID-like)
        const resetToken = crypto.randomUUID();
        const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 minutes

        // Store reset token in database
        await c.env.GENERAL_DB.prepare(
          `INSERT INTO password_reset_tokens (token, user_id, expires_at, created_at)
           VALUES (?, ?, ?, ?)`,
        )
          .bind(resetToken, user.id, expiresAt, Math.floor(Date.now() / 1000))
          .run();

        // Detect if this is first-time password setup (for users who verified EtLab but never completed signup)
        const isFirstTimeSetup = !user.password_hash;

        // Send password reset email
        const emailService = new EmailService(c.env.BREVO_API_KEY);
        await emailService.sendPasswordResetEmail(
          user.name as string,
          user.email as string,
          resetToken,
          "15 minutes",
          isFirstTimeSetup, // Pass flag to customize email message
        );

        console.log(
          isFirstTimeSetup
            ? "First-time password setup requested for:"
            : "Password reset requested for:",
          email,
        );
      } else {
        console.log("Password reset attempted for non-existent email:", email);
      }

      // Always return success message
      return c.json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      console.error("Password reset request error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
