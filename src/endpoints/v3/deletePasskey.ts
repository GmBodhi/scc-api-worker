import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  DeletePasskeyResponse,
} from "../../types";
import { requireAuth } from "../../middleware/auth";

/**
 * DELETE /api/v3/auth/passkeys/:credential_id
 * Delete a passkey
 */
export class DeletePasskey extends OpenAPIRoute {
  schema = {
    summary: "Delete passkey",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "credential_id",
        in: "path" as const,
        required: true,
        schema: {
          type: "string" as const,
        },
        description: "The ID of the passkey credential to delete",
      },
    ],
    responses: {
      "200": {
        description: "Passkey deleted successfully",
        content: {
          "application/json": {
            schema: DeletePasskeyResponse,
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
      "404": {
        description: "Passkey not found",
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
      // Authenticate user
      const user = await requireAuth(c);
      console.log("Authenticated user for delete passkey:", user);

      if (!user) {
        return c.json(
          { success: false, error: "Invalid or expired token" },
          401,
        );
      }

      const credentialId = c.req.param("credential_id");

      // Verify passkey belongs to user
      const passkey = await c.env.GENERAL_DB.prepare(
        "SELECT id FROM passkey_credentials WHERE id = ? AND user_id = ?",
      )
        .bind(credentialId, user.id)
        .first();

      if (!passkey) {
        return c.json({ success: false, error: "Passkey not found" }, 404);
      }

      // Delete passkey
      await c.env.GENERAL_DB.prepare(
        "DELETE FROM passkey_credentials WHERE id = ?",
      )
        .bind(credentialId)
        .run();

      return c.json({
        success: true,
        message: "Passkey deleted successfully",
      });
    } catch (error) {
      console.error("Delete passkey error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
