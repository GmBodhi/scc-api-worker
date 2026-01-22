import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  PasswordResetVerifySchema,
  PasswordResetVerifyResponse,
  ErrorResponse,
} from "../../../types";

/**
 * POST /api/v3/auth/password/reset/verify
 * Complete password reset with token
 */
export class PasswordResetVerify extends OpenAPIRoute {
  schema = {
    summary: "Complete password reset",
    description: "Reset password using the token from email",
    request: {
      body: {
        content: {
          "application/json": {
            schema: PasswordResetVerifySchema,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Password reset successful",
        content: {
          "application/json": {
            schema: PasswordResetVerifyResponse,
          },
        },
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

      const now = Math.floor(Date.now() / 1000);

      // Find and validate reset token
      const resetToken = await c.env.GENERAL_DB.prepare(
        `SELECT token, user_id, expires_at, used 
         FROM password_reset_tokens 
         WHERE token = ?`,
      )
        .bind(token)
        .first();

      if (!resetToken) {
        return c.json({ success: false, error: "Invalid reset token" }, 400);
      }

      // Check if token is expired
      if ((resetToken.expires_at as number) < now) {
        return c.json(
          { success: false, error: "Reset token has expired" },
          400,
        );
      }

      // Check if token already used
      if (resetToken.used) {
        return c.json(
          { success: false, error: "Reset token has already been used" },
          400,
        );
      }

      // Hash the new password
      const passwordHash = await this.hashPassword(new_password);

      // Update user's password
      // Note: This also works for first-time password setup for users who
      // verified EtLab but never completed the signup process (no password_hash exists)
      await c.env.GENERAL_DB.prepare(
        "UPDATE users SET password_hash = ? WHERE id = ?",
      )
        .bind(passwordHash, resetToken.user_id)
        .run();

      // Mark token as used
      await c.env.GENERAL_DB.prepare(
        "UPDATE password_reset_tokens SET used = 1 WHERE token = ?",
      )
        .bind(token)
        .run();

      // Invalidate all existing sessions for this user (security measure)
      await c.env.GENERAL_DB.prepare(
        "DELETE FROM refresh_tokens WHERE user_id = ?",
      )
        .bind(resetToken.user_id)
        .run();

      console.log("Password reset completed for user:", resetToken.user_id);

      return c.json({
        success: true,
        message:
          "Password has been reset successfully. Please login with your new password.",
      });
    } catch (error) {
      console.error("Password reset verify error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}
