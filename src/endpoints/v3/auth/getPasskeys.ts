import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  GetPasskeysResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";

/**
 * GET /api/v3/auth/passkeys
 * Get user's registered passkeys
 */
export class GetPasskeys extends OpenAPIRoute {
  schema = {
    summary: "Get user passkeys",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Passkeys retrieved successfully",
        content: {
          "application/json": {
            schema: GetPasskeysResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized - invalid or missing session",
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

      // Get user's passkeys
      const passkeys = await c.env.GENERAL_DB.prepare(
        "SELECT id, credential_id, device_name, created_at, last_used_at FROM passkey_credentials WHERE user_id = ? ORDER BY created_at DESC",
      )
        .bind(user.id)
        .all();

      const passkeyList = passkeys.results.map((pk: any) => ({
        id: pk.id,
        credential_id: pk.credential_id,
        device_name: pk.device_name,
        created_at: pk.created_at,
        last_used_at: pk.last_used_at,
      }));

      return c.json({
        success: true,
        data: passkeyList,
      });
    } catch (error) {
      console.error("Get passkeys error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
