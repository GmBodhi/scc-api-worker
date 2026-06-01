import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonWaitlistRequest,
  StartathonWaitlistResponse,
  ErrorResponse,
} from "../../../types";
import { EmailService } from "../../../services/emailService";

/**
 * POST /api/v3/events/startathon/waitlist
 * Join the Startathon waitlist (public, no auth required)
 */
export class StartathonWaitlist extends OpenAPIRoute {
  schema = {
    summary: "Join Startathon waitlist",
    description:
      "Add your name and email to the Startathon waitlist. You will be notified if a spot becomes available.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonWaitlistRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Successfully added to waitlist",
        content: {
          "application/json": {
            schema: StartathonWaitlistResponse,
          },
        },
      },
      "409": {
        description: "Email already on the waitlist",
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
      const { name, email, college, phone } = data.body;

      // Duplicate check
      const existing = await c.env.EVENTS_DB.prepare(
        "SELECT waitlist_id FROM startathon_wl WHERE email = ?",
      )
        .bind(email)
        .first();

      if (existing) {
        return c.json(
          { error: "This email is already on the waitlist." },
          409,
        );
      }

      const waitlistId = `STWL_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      const now = Math.floor(Date.now() / 1000);

      const res = await c.env.EVENTS_DB.prepare(
        `INSERT INTO startathon_wl (waitlist_id, name, email, college, phone, registered_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(waitlistId, name, email, college, phone ?? null, now, "waitlisted")
        .run()
        .catch((e: Error) => ({ error: true, details: e.message }));

      if ("error" in res) {
        console.error("Startathon waitlist DB error:", res);
        return c.json({ error: "Failed to join waitlist. Please try again." }, 500);
      }

      // Send confirmation email (non-fatal)
      try {
        const emailService = new EmailService(c.env.BREVO_API_KEY);
        const sent = await emailService.sendStartathonWaitlistEmail(name, email, waitlistId);
        if (!sent) {
          console.error(`Failed to send Startathon waitlist email for ${waitlistId}`);
        }
      } catch (emailError) {
        console.error("Startathon waitlist email error:", emailError);
      }

      console.log("Startathon waitlist signup:", { waitlist_id: waitlistId, email });

      return c.json(
        {
          success: true,
          data: { waitlist_id: waitlistId },
          message: "You've been added to the waitlist. We'll be in touch!",
        },
        201,
      );
    } catch (error) {
      console.error("Startathon waitlist error:", error);
      return c.json({ error: "Internal server error." }, 500);
    }
  }
}
