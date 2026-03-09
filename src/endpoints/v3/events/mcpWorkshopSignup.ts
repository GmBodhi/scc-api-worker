import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  McpWorkshopSignupRequest,
  McpWorkshopSignupResponse,
  ErrorResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";
import { EmailService } from "../../../services/emailService";

/**
 * POST /api/v3/events/mcp_workshop_1
 * Register for MCP Workshop (requires authentication)
 */
export class McpWorkshopSignup extends OpenAPIRoute {
  schema = {
    summary: "Sign up for MCP Workshop",
    description:
      "Register for the MCP Workshop — March 14, 2026, Deep Learning LAB. Requires authentication.",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: McpWorkshopSignupRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Successfully registered for MCP Workshop",
        content: {
          "application/json": {
            schema: McpWorkshopSignupResponse,
          },
        },
      },
      "400": {
        description: "Bad request — validation error",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized — invalid or missing token",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Conflict — user already registered for this event",
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
      const authResult = await requireAuth(c);
      if (!authResult?.user) {
        return c.json({ success: false, error: "Invalid or expired token." }, 401);
      }

      const user = authResult.user;
      const data = await this.getValidatedData<typeof this.schema>();
      const { name, email, whatsapp, jdkInstalled, springTutorial } = data.body;

      const eventId = "mcp_workshop_1";

      // Check if user is already registered for this event
      const existing = await c.env.EVENTS_DB.prepare(
        "SELECT registration_id FROM mcp_workshop_registrations WHERE user_id = ? AND event_id = ?",
      )
        .bind(user.id, eventId)
        .first();

      if (existing) {
        return c.json(
          { success: false, error: "User already registered for this event." },
          409,
        );
      }

      const registrationId = `MCP_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      const now = Math.floor(Date.now() / 1000);

      const res = await c.env.EVENTS_DB.prepare(
        `INSERT INTO mcp_workshop_registrations
         (registration_id, user_id, event_id, name, email, whatsapp, jdk_installed, spring_tutorial, registered_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          registrationId,
          user.id,
          eventId,
          name,
          email,
          whatsapp,
          jdkInstalled,
          springTutorial ? 1 : 0,
          now,
          "registered",
        )
        .run()
        .catch((e: Error) => ({ error: true, details: e.message }));

      if ("error" in res) {
        console.error("MCP Workshop registration DB error:", res);
        return c.json(
          { success: false, error: "Registration failed. Please try again." },
          500,
        );
      }

      // Send confirmation email (non-fatal)
      try {
        const emailService = new EmailService(c.env.BREVO_API_KEY);
        const sent = await emailService.sendMcpWorkshopConfirmationEmail(
          name,
          email,
          registrationId,
        );
        if (!sent) {
          console.error(
            `Failed to send MCP Workshop confirmation email for ${registrationId}`,
          );
        }
      } catch (emailError) {
        console.error("MCP Workshop email error:", emailError);
      }

      console.log("MCP Workshop registration:", {
        registration_id: registrationId,
        user_id: user.id,
        event_id: eventId,
      });

      return c.json(
        {
          success: true,
          data: { registration_id: registrationId },
        },
        200,
      );
    } catch (error) {
      console.error("MCP Workshop signup error:", error);
      return c.json({ success: false, error: "Internal server error." }, 500);
    }
  }
}
