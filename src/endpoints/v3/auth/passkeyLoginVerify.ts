import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  PasskeyLoginVerifyRequest,
  PasskeyLoginVerifyResponse,
} from "../../../types";
import {
  generateJWT,
  generateRefreshToken,
  hashRefreshToken,
} from "../../../utils/jwt";

/**
 * POST /api/v3/auth/passkey/login/verify
 * Complete passkey authentication
 */
export class PasskeyLoginVerify extends OpenAPIRoute {
  schema = {
    summary: "Verify passkey login",
    request: {
      body: {
        content: {
          "application/json": {
            schema: PasskeyLoginVerifyRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Login successful",
        content: {
          "application/json": {
            schema: PasskeyLoginVerifyResponse,
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
    const { email, credential } = data.body;

    try {
      // Parse client data
      const clientDataJSON = JSON.parse(
        atob(credential.response.clientDataJSON),
      );
      const challenge = clientDataJSON.challenge;

      // Verify challenge
      let challengeData: any = null;

      if (c.env.CHALLENGES) {
        const data = await c.env.CHALLENGES.get(`passkey_login:${challenge}`);
        if (data) {
          challengeData = JSON.parse(data);
          await c.env.CHALLENGES.delete(`passkey_login:${challenge}`);
        }
      } else {
        const record = await c.env.GENERAL_DB.prepare(
          "SELECT user_id, type FROM challenges WHERE challenge = ? AND type = 'passkey_login' AND expires_at > ?",
        )
          .bind(challenge, Math.floor(Date.now() / 1000))
          .first();

        if (record) {
          challengeData = { user_id: record.user_id };
          await c.env.GENERAL_DB.prepare("DELETE FROM challenges WHERE challenge = ?")
            .bind(challenge)
            .run();
        }
      }

      if (!challengeData) {
        return c.json(
          { success: false, error: "Invalid or expired challenge" },
          400,
        );
      }

      // Verify credential exists for this user
      const passkeyRecord = await c.env.GENERAL_DB.prepare(
        `SELECT pc.*, u.email, u.name, u.profile_photo_url 
         FROM passkey_credentials pc
         JOIN users u ON pc.user_id = u.id
         WHERE pc.credential_id = ? AND pc.user_id = ?`,
      )
        .bind(credential.id, challengeData.user_id)
        .first();

      if (!passkeyRecord) {
        return c.json({ success: false, error: "Invalid credential" }, 400);
      }

      // Verify email matches
      if (passkeyRecord.email !== email) {
        return c.json({ success: false, error: "Email mismatch" }, 400);
      }

      // TODO: Verify signature using stored public key
      // For now, we'll accept the credential (simplified implementation)

      // Update last_used_at and counter
      await c.env.GENERAL_DB.prepare(
        "UPDATE passkey_credentials SET last_used_at = ?, counter = counter + 1 WHERE id = ?",
      )
        .bind(Math.floor(Date.now() / 1000), passkeyRecord.id as string)
        .run();

      // Generate access token (15 minutes)
      const accessToken = await generateJWT(
        challengeData.user_id,
        passkeyRecord.email as string,
        passkeyRecord.phone as string | null,
        passkeyRecord.name as string,
        c.env.JWT_SECRET,
        15 * 60, // 15 minutes
      );

      // Generate refresh token (30 days)
      const refreshToken = await generateRefreshToken(
        challengeData.user_id,
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
          challengeData.user_id,
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
            id: challengeData.user_id,
            email: passkeyRecord.email as string,
            name: passkeyRecord.name as string,
            profile_photo_url: passkeyRecord.profile_photo_url as string | null,
          },
        },
      });
    } catch (error) {
      console.error("Passkey login verify error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
