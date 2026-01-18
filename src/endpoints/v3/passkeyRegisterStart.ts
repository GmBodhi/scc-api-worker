import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  PasskeyRegisterStartRequest,
  PasskeyRegisterStartResponse,
} from "../../types";
import { requireAuth } from "../../middleware/auth";

/**
 * POST /api/v3/auth/passkey/register/start
 * Initiate passkey registration for authenticated user
 */
export class PasskeyRegisterStart extends OpenAPIRoute {
  schema = {
    summary: "Start passkey registration",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: PasskeyRegisterStartRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Registration challenge created successfully",
        content: {
          "application/json": {
            schema: PasskeyRegisterStartResponse,
          },
        },
      },
      "400": {
        description: "Bad request - invalid session",
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
      // Authenticate user with JWT
      const authResult = await requireAuth(c);
      if (!authResult.success) {
        return c.json({ success: false, error: authResult.error }, 401);
      }
      const user = authResult.user!;

      // Generate challenge
      const challenge = crypto.randomUUID();

      // Store challenge (KV or database)
      const challengeData = {
        user_id: user.id,
        type: "passkey_register",
        created_at: Date.now(),
      };

      if (c.env.CHALLENGES) {
        await c.env.CHALLENGES.put(
          `passkey_register:${challenge}`,
          JSON.stringify(challengeData),
          { expirationTtl: 300 }, // 5 minutes
        );
      } else {
        await c.env.GENERAL_DB.prepare(
          "INSERT INTO challenges (challenge, user_id, type, expires_at) VALUES (?, ?, ?, ?)",
        )
          .bind(
            challenge,
            user.id,
            "passkey_register",
            Math.floor(Date.now() / 1000) + 300,
          )
          .run();
      }

      // Return WebAuthn registration options
      return c.json({
        success: true,
        data: {
          challenge: challenge,
          rp: {
            name: c.env.RP_NAME || "Coding Club",
            id: c.env.RP_ID || "localhost",
          },
          user: {
            id: user.id,
            name: user.email,
            displayName: user.name,
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 }, // ES256
            { type: "public-key", alg: -257 }, // RS256
          ],
          timeout: 60000,
          attestation: "none",
        },
      });
    } catch (error) {
      console.error("Passkey register start error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
