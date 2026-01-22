import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  EventSignupRequest,
  EventSignupResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";

/**
 * POST /api/v3/events/hackerrank_1
 * Register for HackerRank Event (requires authentication)
 */
export class EventSignup extends OpenAPIRoute {
  schema = {
    summary: "Sign up for HackerRank Event",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: EventSignupRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Successfully registered for HackerRank event",
        content: {
          "application/json": {
            schema: EventSignupResponse,
          },
        },
      },
      "400": {
        description: "Bad request - invalid data or already registered",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized - invalid or missing token",
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
      const AuthContext = await requireAuth(c);
      const user = AuthContext?.user;

      if (!user) {
        return c.json(
          { success: false, error: "Invalid or expired token" },
          401,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { name, email, phone, batch } = data.body;

      // Hardcoded event ID for HackerRank event
      const eventId = "hackerrank_1";

      // Check if user is already registered for this event
      const existingRegistration = await c.env.EVENTS_DB.prepare(
        "SELECT registration_id FROM hackerrank_registrations WHERE event_id = ? AND user_id = ?",
      )
        .bind(eventId, user.id)
        .first();

      if (existingRegistration) {
        return c.json(
          { success: false, error: "Already registered for this event" },
          400,
        );
      }

      // Generate a unique ID with HR1_ prefix (HackerRank 1)
      const registrationId = `HR1_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      const now = Math.floor(Date.now() / 1000);

      // Insert into database
      const res = await c.env.EVENTS_DB.prepare(
        `INSERT INTO hackerrank_registrations 
         (registration_id, event_id, user_id, name, email, phone, batch, registered_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          registrationId,
          eventId,
          user.id,
          name,
          email,
          phone,
          batch,
          now,
          "payment-pending",
        )
        .run()
        .catch((e) => ({ error: true, details: e.message }));

      if ("error" in res) {
        console.error("Database error:", res);
        return c.json(
          {
            success: false,
            error: "The email or phone number is already in use for this event",
          },
          400,
        );
      }

      console.log("HackerRank event registration:", {
        id: registrationId,
        event_id: eventId,
        user_id: user.id,
      });

      return c.json(
        {
          success: true,
          data: {
            registration_id: registrationId,
            event_id: eventId,
            name,
            email,
            phone,
            batch,
            registered_at: now,
            status: "payment-pending",
          },
          message:
            "Registration successful. Please complete payment to confirm.",
        },
        201,
      );
    } catch (error) {
      console.error("Event signup error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
