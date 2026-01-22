import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../../types";
import { z } from "zod";
import {
  generateJWT,
  verifyRefreshToken,
  hashRefreshToken,
} from "../../../utils/jwt";

const RefreshRequest = z.object({
  refresh_token: z.string().min(1),
});

const RefreshResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      access_token: z.string(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        profile_photo_url: z.string().nullable(),
      }),
    })
    .optional(),
  error: z.string().optional(),
});

/**
 * POST /api/v3/auth/refresh
 * Refresh access token using refresh token
 */
export class RefreshToken extends OpenAPIRoute {
  schema = {
    summary: "Refresh access token",
    request: {
      body: {
        content: {
          "application/json": {
            schema: RefreshRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Token refreshed successfully",
        content: {
          "application/json": {
            schema: RefreshResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized - invalid or expired refresh token",
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
    const data = await this.getValidatedData<typeof this.schema>();
    const { refresh_token } = data.body;

    try {
      // Verify refresh token
      const userId = await verifyRefreshToken(refresh_token, c.env.JWT_SECRET);
      if (!userId) {
        return c.json(
          { success: false, error: "Invalid or expired refresh token" },
          401,
        );
      }

      // Hash the refresh token to look it up in database
      const tokenHash = await hashRefreshToken(refresh_token);

      // Check if refresh token exists and is valid in database
      const refreshTokenRecord = await c.env.GENERAL_DB.prepare(
        "SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ? AND user_id = ?",
      )
        .bind(tokenHash, userId)
        .first();

      if (!refreshTokenRecord) {
        return c.json(
          { success: false, error: "Refresh token not found" },
          401,
        );
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if ((refreshTokenRecord.expires_at as number) < now) {
        // Delete expired token
        await c.env.GENERAL_DB.prepare("DELETE FROM refresh_tokens WHERE id = ?")
          .bind(refreshTokenRecord.id)
          .run();
        return c.json({ success: false, error: "Refresh token expired" }, 401);
      }

      // Update last_used_at timestamp
      await c.env.GENERAL_DB.prepare(
        "UPDATE refresh_tokens SET last_used_at = ? WHERE id = ?",
      )
        .bind(now, refreshTokenRecord.id)
        .run();

      // Get user data
      const user = await c.env.GENERAL_DB.prepare(
        "SELECT id, email, name, profile_photo_url FROM users WHERE id = ?",
      )
        .bind(userId)
        .first();

      if (!user) {
        return c.json({ success: false, error: "User not found" }, 401);
      }

      // Generate new access token
      const accessToken = await generateJWT(
        user.id as string,
        user.email as string,
        user.phone as string | null,
        user.name as string,
        c.env.JWT_SECRET,
        15 * 60, // 15 minutes
      );

      return c.json({
        success: true,
        data: {
          access_token: accessToken,
          user: {
            id: user.id as string,
            email: user.email as string,
            name: user.name as string,
            profile_photo_url: user.profile_photo_url as string | null,
          },
        },
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
