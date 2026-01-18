import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  PasskeyRegisterVerifyRequest,
  PasskeyRegisterVerifyResponse,
} from "../../types";
import { requireAuth } from "../../middleware/auth";

/**
 * POST /api/v3/auth/passkey/register/verify
 * Complete passkey registration
 */
export class PasskeyRegisterVerify extends OpenAPIRoute {
  schema = {
    summary: "Verify and complete passkey registration",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: PasskeyRegisterVerifyRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Passkey registered successfully",
        content: {
          "application/json": {
            schema: PasskeyRegisterVerifyResponse,
          },
        },
      },
      "400": {
        description: "Bad request - invalid challenge or credential",
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
    const { credential, device_name } = data.body;

    try {
      // Authenticate user with JWT
      const authResult = await requireAuth(c);
      if (!authResult.success) {
        return c.json({ success: false, error: authResult.error }, 401);
      }
      const user = authResult.user!;

      // Parse client data
      const clientDataJSON = JSON.parse(
        atob(credential.response.clientDataJSON),
      );
      const challenge = clientDataJSON.challenge;

      // Verify challenge
      let userId: string | null = null;

      if (c.env.CHALLENGES) {
        const challengeData = await c.env.CHALLENGES.get(
          `passkey_register:${challenge}`,
        );
        if (challengeData) {
          const parsed = JSON.parse(challengeData);
          userId = parsed.user_id;
          await c.env.CHALLENGES.delete(`passkey_register:${challenge}`);
        }
      } else {
        const challengeRecord = await c.env.GENERAL_DB.prepare(
          "SELECT user_id FROM challenges WHERE challenge = ? AND type = 'passkey_register' AND expires_at > ?",
        )
          .bind(challenge, Math.floor(Date.now() / 1000))
          .first();

        if (challengeRecord) {
          userId = challengeRecord.user_id as string;
          await c.env.GENERAL_DB.prepare(
            "DELETE FROM challenges WHERE challenge = ?",
          )
            .bind(challenge)
            .run();
        }
      }

      if (!userId || userId !== user.id) {
        return c.json(
          { success: false, error: "Invalid or expired challenge" },
          400,
        );
      }

      // Check if credential already exists
      const existingCred = await c.env.GENERAL_DB.prepare(
        "SELECT id FROM passkey_credentials WHERE credential_id = ?",
      )
        .bind(credential.id)
        .first();

      if (existingCred) {
        return c.json(
          { success: false, error: "This passkey is already registered" },
          400,
        );
      }

      // Store credential (simplified - in production, verify attestation)
      const credentialId = crypto.randomUUID();
      await c.env.GENERAL_DB.prepare(
        `INSERT INTO passkey_credentials 
         (id, user_id, credential_id, public_key, device_name, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          credentialId,
          userId,
          credential.id,
          credential.response.attestationObject, // Store attestation as public key placeholder
          device_name || null,
          Math.floor(Date.now() / 1000),
        )
        .run();

      return c.json({
        success: true,
        data: {
          credential_id: credentialId,
          message: "Passkey registered successfully",
        },
      });
    } catch (error) {
      console.error("Passkey register verify error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
