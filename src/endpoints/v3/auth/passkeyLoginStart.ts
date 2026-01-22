import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  PasskeyLoginStartRequest,
  PasskeyLoginStartResponse,
} from "../../../types";

/**
 * POST /api/v3/auth/passkey/login/start
 * Initiate passkey authentication
 */
export class PasskeyLoginStart extends OpenAPIRoute {
  schema = {
    summary: "Start passkey login",
    request: {
      body: {
        content: {
          "application/json": {
            schema: PasskeyLoginStartRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Login challenge created successfully",
        content: {
          "application/json": {
            schema: PasskeyLoginStartResponse,
          },
        },
      },
      "400": {
        description: "Bad request - user not found or no passkeys",
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
    const { email } = data.body;

    try {
      // Find user
      const user = await c.env.GENERAL_DB.prepare(
        "SELECT id FROM users WHERE email = ?",
      )
        .bind(email)
        .first();

      if (!user) {
        return c.json({ success: false, error: "User not found" }, 400);
      }

      // Get user's passkeys
      const passkeys = await c.env.GENERAL_DB.prepare(
        "SELECT credential_id, transports FROM passkey_credentials WHERE user_id = ?",
      )
        .bind(user.id as string)
        .all();

      if (!passkeys.results || passkeys.results.length === 0) {
        return c.json(
          { success: false, error: "No passkeys registered for this user" },
          400,
        );
      }

      // Generate challenge
      const challenge = crypto.randomUUID();

      // Store challenge
      const challengeData = {
        user_id: user.id,
        email: email,
        type: "passkey_login",
        created_at: Date.now(),
      };

      if (c.env.CHALLENGES) {
        await c.env.CHALLENGES.put(
          `passkey_login:${challenge}`,
          JSON.stringify(challengeData),
          { expirationTtl: 300 }, // 5 minutes
        );
      } else {
        await c.env.GENERAL_DB.prepare(
          "INSERT INTO challenges (challenge, user_id, type, expires_at) VALUES (?, ?, ?, ?)",
        )
          .bind(
            challenge,
            user.id as string,
            "passkey_login",
            Math.floor(Date.now() / 1000) + 300,
          )
          .run();
      }

      // Build allowCredentials
      const allowCredentials = passkeys.results.map((pk: any) => ({
        type: "public-key" as const,
        id: pk.credential_id,
        transports: pk.transports ? JSON.parse(pk.transports) : undefined,
      }));

      return c.json({
        success: true,
        data: {
          challenge: challenge,
          timeout: 60000,
          rpId: c.env.RP_ID || "localhost",
          allowCredentials: allowCredentials,
        },
      });
    } catch (error) {
      console.error("Passkey login start error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
