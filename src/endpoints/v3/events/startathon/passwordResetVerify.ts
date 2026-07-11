import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonPasswordResetVerifySchema,
  ErrorResponse,
} from "../../../../types";
import { hashPassword } from "../../../../utils/startathonJwt";

/**
 * POST /api/v3/events/startathon/auth/password/reset/verify
 * Set a new password using a token from the setup or reset email.
 * Tokens are single-use: deleted after a successful reset.
 */
export class StartathonPasswordResetVerify extends OpenAPIRoute {
  schema = {
    summary: "Complete Startathon password reset",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonPasswordResetVerifySchema,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Password set successfully",
        content: {},
      },
      "400": {
        description: "Invalid or expired token",
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
      const { token, new_password } = data.body;

      const resetToken = await c.env.EVENTS_DB.prepare(
        "SELECT token, user_id, expires_at FROM startathon_reset_tokens WHERE token = ?",
      )
        .bind(token)
        .first();

      if (!resetToken) {
        return c.json({ success: false, error: "Invalid reset token" }, 400);
      }

      const now = Math.floor(Date.now() / 1000);
      if ((resetToken.expires_at as number) < now) {
        return c.json(
          { success: false, error: "Reset token has expired" },
          400,
        );
      }

      const passwordHash = await hashPassword(new_password);

      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET password_hash = ? WHERE user_id = ?",
        ).bind(passwordHash, resetToken.user_id),
        c.env.EVENTS_DB.prepare(
          "DELETE FROM startathon_reset_tokens WHERE token = ?",
        ).bind(token),
      ]);

      console.log(
        "Startathon password set for user:",
        resetToken.user_id,
      );

      return c.json({
        success: true,
        message: "Password set successfully. You can now log in.",
      });
    } catch (error) {
      console.error("Startathon password reset verify error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
