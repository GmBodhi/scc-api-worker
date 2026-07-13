import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonSignupRequest,
  StartathonAuthResponse,
  ErrorResponse,
} from "../../../../types";
import {
  generateStartathonJWT,
  hashPassword,
} from "../../../../utils/startathonJwt";

/**
 * POST /api/v3/events/startathon/auth/signup
 * Create a Startathon account (public, no auth). No team yet — the
 * account is created teamless; the user creates or joins a team
 * afterward. No email verification.
 */
export class StartathonSignup extends OpenAPIRoute {
  schema = {
    summary: "Sign up for Startathon",
    description:
      "Create an account with email + password. Returns a 7-day JWT immediately. No team is assigned — create or join one afterward.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonSignupRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Account created",
        content: {
          "application/json": {
            schema: StartathonAuthResponse,
          },
        },
      },
      "409": {
        description: "Email already registered",
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
      const { name, email, password, phone, college } = data.body;
      const normalizedEmail = email.toLowerCase();

      const existing = await c.env.EVENTS_DB.prepare(
        "SELECT user_id FROM startathon_users WHERE email = ?",
      )
        .bind(normalizedEmail)
        .first();

      if (existing) {
        return c.json(
          { success: false, error: "This email is already registered" },
          409,
        );
      }

      const userId = `STU_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;
      const passwordHash = await hashPassword(password);
      const now = Math.floor(Date.now() / 1000);

      await c.env.EVENTS_DB.prepare(
        `INSERT INTO startathon_users (user_id, name, email, phone, college, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(userId, name, normalizedEmail, phone, college, passwordHash, now)
        .run();

      const accessToken = await generateStartathonJWT(
        userId,
        normalizedEmail,
        name,
        c.env.JWT_SECRET,
      );

      console.log("Startathon signup:", { user_id: userId, email: normalizedEmail });

      return c.json(
        {
          success: true,
          data: {
            access_token: accessToken,
            expires_in: 7 * 24 * 60 * 60,
            user: {
              user_id: userId,
              team_id: null,
              role: null,
              name,
              email: normalizedEmail,
              phone: phone || null,
              college: college || null,
            },
          },
        },
        201,
      );
    } catch (error) {
      console.error("Startathon signup error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
