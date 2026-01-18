import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  LoginRequest,
  LoginResponse,
} from "../../types";
import {
  generateJWT,
  generateRefreshToken,
  hashRefreshToken,
} from "../../utils/jwt";

/**
 * POST /api/v3/auth/login
 * Login with email and password
 */
export class Login extends OpenAPIRoute {
  schema = {
    summary: "Login with email and password",
    request: {
      body: {
        content: {
          "application/json": {
            schema: LoginRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Login successful",
        content: {
          "application/json": {
            schema: LoginResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized - invalid credentials",
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
    const { email, password } = data.body;

    try {
      // Get user
      const user = await c.env.GENERAL_DB.prepare("SELECT * FROM users WHERE email = ?")
        .bind(email)
        .first();

      if (!user) {
        return c.json({ success: false, error: "Invalid credentials" }, 401);
      }

      // Hash provided password and compare
      const encoder = new TextEncoder();
      const passwordData = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", passwordData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (passwordHash !== user.password_hash) {
        return c.json({ success: false, error: "Invalid credentials" }, 401);
      }

      // Generate access token (15 minutes)
      const accessToken = await generateJWT(
        user.id as string,
        user.email as string,
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
            id: user.id,
            email: user.email,
            name: user.name,
            profile_photo_url: user.profile_photo_url,
          },
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
