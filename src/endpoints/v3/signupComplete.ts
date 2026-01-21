import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  SignupCompleteRequest,
  SignupCompleteResponse,
} from "../../types";
import {
  generateJWT,
  generateRefreshToken,
  hashRefreshToken,
} from "../../utils/jwt";
import { EmailService } from "../../services/emailService";

/**
 * POST /api/v3/auth/signup/complete
 * Complete account setup with password after EtLab verification
 */
export class SignupComplete extends OpenAPIRoute {
  schema = {
    summary: "Complete account setup with password and profile",
    request: {
      body: {
        content: {
          "application/json": {
            schema: SignupCompleteRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Account setup completed successfully",
        content: {
          "application/json": {
            schema: SignupCompleteResponse,
          },
        },
      },
      "400": {
        description: "Bad request - invalid or expired token",
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
    const {
      signup_token,
      password,
      phone,
      profile_photo,
      profile_photo_filename,
    } = data.body;

    try {
      // Verify signup token
      let userId: string | null = null;

      // Try KV first
      if (c.env.CHALLENGES) {
        const tokenData = await c.env.CHALLENGES.get(`signup:${signup_token}`);
        if (tokenData) {
          const parsed = JSON.parse(tokenData);
          userId = parsed.user_id;
          // Delete the token after use
          await c.env.CHALLENGES.delete(`signup:${signup_token}`);
        }
      }

      // Fallback to database
      if (!userId) {
        const tokenRecord = await c.env.GENERAL_DB.prepare(
          `SELECT user_id FROM challenges 
           WHERE challenge = ? AND type = 'signup' AND expires_at > ?`,
        )
          .bind(signup_token, Math.floor(Date.now() / 1000))
          .first();

        if (tokenRecord) {
          userId = tokenRecord.user_id as string;
          // Delete the token after use
          await c.env.GENERAL_DB.prepare(
            "DELETE FROM challenges WHERE challenge = ?",
          )
            .bind(signup_token)
            .run();
        }
      }

      if (!userId) {
        return c.json(
          { success: false, error: "Invalid or expired signup token" },
          400,
        );
      }

      // Get user details
      const user = await c.env.GENERAL_DB.prepare(
        "SELECT * FROM users WHERE id = ?",
      )
        .bind(userId)
        .first();

      if (!user) {
        return c.json({ success: false, error: "User not found" }, 400);
      }

      // Check if user already has a password
      if (user.password_hash) {
        return c.json(
          { success: false, error: "Account already completed" },
          400,
        );
      }

      // Hash password using Web Crypto API
      const encoder = new TextEncoder();
      const passwordData = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", passwordData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Handle profile photo
      let photoUrl: string | null = null;
      if (profile_photo) {
        // Check if it's a base64 encoded image (custom upload)
        if (profile_photo.startsWith("data:image/")) {
          // Upload to R2
          if (c.env.PROFILE_PHOTOS) {
            try {
              // Extract base64 data and mime type
              const matches = profile_photo.match(
                /^data:image\/(\w+);base64,(.+)$/,
              );
              if (matches) {
                const [, imageType, base64Data] = matches;
                const imageBuffer = Uint8Array.from(atob(base64Data), (c) =>
                  c.charCodeAt(0),
                );

                // Generate unique filename
                const extension = imageType.toLowerCase();
                const filename = profile_photo_filename
                  ? `${userId}-${Date.now()}-${profile_photo_filename}`
                  : `${userId}-${Date.now()}.${extension}`;
                const key = `profiles/${filename}`;

                // Upload to R2
                await c.env.PROFILE_PHOTOS.put(key, imageBuffer, {
                  httpMetadata: {
                    contentType: `image/${imageType}`,
                  },
                });

                // Construct public URL (adjust domain as needed)
                photoUrl = `https://profile-photos.sctcoding.club/${key}`;
              }
            } catch (uploadError) {
              console.error("R2 upload error:", uploadError);
              // Continue without profile photo if upload fails
            }
          }
        } else {
          // It's a URL (from EtLab or external), store as-is
          photoUrl = profile_photo;
        }
      }

      // Update user with password and profile photo
      await c.env.GENERAL_DB.prepare(
        `UPDATE users 
         SET password_hash = ?, phone = ?, profile_photo_url = COALESCE(?, profile_photo_url), updated_at = ?
         WHERE id = ?`,
      )
        .bind(
          passwordHash,
          phone || null,
          photoUrl,
          Math.floor(Date.now() / 1000),
          userId,
        )
        .run();

      // Send welcome email
      try {
        const emailService = new EmailService(c.env.BREVO_API_KEY);
        await emailService.sendWelcomeEmail(
          user.name as string,
          user.email as string,
        );
        console.log("Welcome email sent to:", user.email);
      } catch (emailError) {
        // Don't fail signup if email fails
        console.error("Failed to send welcome email:", emailError);
      }

      // Generate access token (15 minutes)
      const accessToken = await generateJWT(
        user.id as string,
        user.email as string,
        phone as string | null,
        user.name as string,
        c.env.JWT_SECRET,
        15 * 60, // 15 minutes
      );

      // Generate refresh token (30 days)
      const refreshToken = await generateRefreshToken(
        user.id as string,
        c.env.JWT_SECRET,
        30 * 24 * 60 * 60, // 30 days
      );

      // Store refresh token in database
      const tokenHash = await hashRefreshToken(refreshToken);
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 30 * 24 * 60 * 60;

      await c.env.GENERAL_DB.prepare(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          crypto.randomUUID(),
          user.id,
          tokenHash,
          expiresAt,
          now,
          c.req.header("cf-connecting-ip") || null,
          c.req.header("user-agent") || null,
        )
        .run();

      return c.json({
        success: true,
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 900, // 15 minutes in seconds
          user: {
            id: user.id as string,
            email: user.email as string,
            phone: phone || null,
            name: user.name as string,
            profile_photo_url: photoUrl,
          },
          message: "Account setup completed successfully",
        },
      });
    } catch (error) {
      console.error("Signup complete error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
