import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  SignupRequest,
  SignupResponse,
} from "../../types";
import {
  generateJWT,
  generateRefreshToken,
  hashRefreshToken,
} from "../../utils/jwt";
import { EmailService } from "../../services/emailService";

/**
 * POST /api/v3/auth/signup
 * Complete signup with email, name, and password in one step
 */
export class Signup extends OpenAPIRoute {
  schema = {
    summary: "Create a new account with email, name, and password",
    request: {
      body: {
        content: {
          "application/json": {
            schema: SignupRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Account created successfully",
        content: {
          "application/json": {
            schema: SignupResponse,
          },
        },
      },
      "400": {
        description: "Bad request - email already exists",
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
      email,
      name,
      password,
      phone,
      profile_photo,
      profile_photo_filename,
    } = data.body;

    try {
      // Check if user already exists with this email
      const existingUser = await c.env.GENERAL_DB.prepare(
        "SELECT id FROM users WHERE email = ?",
      )
        .bind(email)
        .first();

      if (existingUser) {
        return c.json(
          { success: false, error: "Email already registered" },
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

      // Handle profile photo upload if provided
      let photoUrl: string | null = null;
      if (profile_photo) {
        if (profile_photo.startsWith("data:image/")) {
          // Upload to R2
          if (c.env.PROFILE_PHOTOS) {
            try {
              const matches = profile_photo.match(
                /^data:image\/(\w+);base64,(.+)$/,
              );
              if (matches) {
                const [, imageType, base64Data] = matches;
                const imageBuffer = Uint8Array.from(atob(base64Data), (c) =>
                  c.charCodeAt(0),
                );

                const userId = crypto.randomUUID();
                const extension = imageType.toLowerCase();
                const filename = profile_photo_filename
                  ? `${userId}-${Date.now()}-${profile_photo_filename}`
                  : `${userId}-${Date.now()}.${extension}`;
                const key = `profiles/${filename}`;

                await c.env.PROFILE_PHOTOS.put(key, imageBuffer, {
                  httpMetadata: {
                    contentType: `image/${imageType}`,
                  },
                });

                photoUrl = `https://profile-photos.sctcoding.club/${key}`;
              }
            } catch (uploadError) {
              console.error("R2 upload error:", uploadError);
              // Continue without profile photo if upload fails
            }
          }
        } else if (
          profile_photo.startsWith("http://") ||
          profile_photo.startsWith("https://")
        ) {
          // External URL
          photoUrl = profile_photo;
        }
      }

      // Create new user (unverified by default)
      const userId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      await c.env.GENERAL_DB.prepare(
        `INSERT INTO users (id, email, name, password_hash, phone, profile_photo_url, is_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
        .bind(
          userId,
          email,
          name,
          passwordHash,
          phone || null,
          photoUrl,
          now,
          now,
        )
        .run();

      // Send welcome email
      try {
        const emailService = new EmailService(c.env.BREVO_API_KEY);
        await emailService.sendWelcomeEmail(name, email);
        console.log("Welcome email sent to:", email);
      } catch (emailError) {
        // Don't fail signup if email fails
        console.error("Failed to send welcome email:", emailError);
      }

      // Generate access token (15 minutes)
      const accessToken = await generateJWT(
        userId,
        email,
        phone || null,
        name,
        c.env.JWT_SECRET,
        15 * 60, // 15 minutes
      );

      // Generate refresh token (30 days)
      const refreshToken = await generateRefreshToken(
        userId,
        c.env.JWT_SECRET,
        30 * 24 * 60 * 60, // 30 days
      );

      // Store refresh token in database
      const tokenHash = await hashRefreshToken(refreshToken);
      const expiresAt = now + 30 * 24 * 60 * 60;

      await c.env.GENERAL_DB.prepare(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          crypto.randomUUID(),
          userId,
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
            id: userId,
            email,
            name,
            phone: phone || null,
            profile_photo_url: photoUrl,
            is_verified: false,
          },
        },
        message: "Account created successfully",
      });
    } catch (error) {
      console.error("Signup error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
