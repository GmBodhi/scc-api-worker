import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonLoginRequest,
  StartathonAuthResponse,
  ErrorResponse,
} from "../../../../types";
import {
  generateStartathonJWT,
  hashPassword,
} from "../../../../utils/startathonJwt";

/**
 * POST /api/v3/events/startathon/auth/login
 * Login with email and password (startathon accounts only)
 */
export class StartathonLogin extends OpenAPIRoute {
  schema = {
    summary: "Startathon login",
    description:
      "Login with email and password. Returns a 7-day startathon-scoped JWT.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonLoginRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Login successful",
        content: {
          "application/json": {
            schema: StartathonAuthResponse,
          },
        },
      },
      "401": {
        description: "Invalid credentials",
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
      const { email, password } = data.body;

      const user = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_users WHERE email = ?",
      )
        .bind(email.toLowerCase())
        .first();

      // Same error for unknown email / no password set / wrong password
      if (!user || !user.password_hash) {
        return c.json({ success: false, error: "Invalid credentials" }, 401);
      }

      const providedHash = await hashPassword(password);
      if (providedHash !== user.password_hash) {
        return c.json({ success: false, error: "Invalid credentials" }, 401);
      }

      const accessToken = await generateStartathonJWT(
        user.user_id as string,
        user.email as string,
        user.name as string,
        c.env.JWT_SECRET,
      );

      return c.json({
        success: true,
        data: {
          access_token: accessToken,
          expires_in: 7 * 24 * 60 * 60,
          user: {
            user_id: user.user_id as string,
            team_id: (user.team_id as string) || null,
            role: (user.role as string) || null,
            name: user.name as string,
            email: user.email as string,
          },
        },
      });
    } catch (error) {
      console.error("Startathon login error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
