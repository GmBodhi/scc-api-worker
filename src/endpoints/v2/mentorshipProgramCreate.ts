import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  MentorshipProgramRegistration,
  MentorshipProgramResponse,
  ErrorResponse,
} from "../../types";
import { GoogleSheetsService } from "../../services/googleSheetsService";
import { EmailService } from "../../services/emailService";

export class MentorshipProgramCreate extends OpenAPIRoute {
  schema = {
    summary: "Create a new mentorship program registration (v2)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: MentorshipProgramRegistration,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Returns the created mentorship program registration",
        content: {
          "application/json": {
            schema: MentorshipProgramResponse,
          },
        },
      },
      "400": {
        description: "Bad request - validation error",
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

    try {
      const registrationData = data.body;

      // Generate a unique ID with MP_ prefix (MentorshipProgram)
      const id = `MP_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      const registration = {
        id,
        ...registrationData,
        status: "registered" as const,
      };

      // Insert into database
      const res = await c.env.EVENTS_DB.prepare(
        "INSERT INTO mentorship_program(id, name, batch, email, phone, experienceLevel, projectIdea, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          registration.id,
          registration.name,
          registration.batch,
          registration.email,
          registration.phone,
          registration.experienceLevel,
          registration.projectIdea,
          registration.status,
          new Date().toISOString(),
          new Date().toISOString(),
        )
        .run()
        .catch((e) => ({ error: true, details: e.message }));

      if ("error" in res) {
        console.error("Database error:", res);
        return c.json(
          { error: "The email or phone number is already in use" },
          400,
        );
      }

      // Send confirmation email (non-blocking failure)
      try {
        const emailService = new EmailService(c.env.BREVO_API_KEY);
        const emailSent =
          await emailService.sendMentorshipProgramConfirmationEmail(
            registration.name,
            registration.email,
            registration.id,
            registration.experienceLevel,
          );

        if (!emailSent) {
          console.error(
            `Failed to send confirmation email to ${registration.email}`,
          );
        } else {
          console.log(`Confirmation email sent to ${registration.email}`);
        }
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
        // Don't fail the registration if email fails
      }

      // Update Google Sheets (non-blocking failure)
      try {
        const googleSheetsService = new GoogleSheetsService({
          spreadsheetId: c.env.GOOGLE_SHEETS_ID,
          serviceAccountEmail: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          privateKey: c.env.GOOGLE_PRIVATE_KEY,
        });

        const sheetsUpdated =
          await googleSheetsService.addMentorshipProgramRegistration({
            id: registration.id,
            name: registration.name,
            batch: registration.batch,
            email: registration.email,
            phone: registration.phone,
            experienceLevel: registration.experienceLevel,
            projectIdea: registration.projectIdea,
            status: registration.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

        if (!sheetsUpdated) {
          console.error(
            `Failed to add registration ${registration.id} to Google Sheets`,
          );
        } else {
          console.log(
            `Registration ${registration.id} added to Google Sheets successfully`,
          );
        }
      } catch (sheetsError) {
        console.error("Error updating Google Sheets:", sheetsError);
        // Don't fail the registration if Google Sheets update fails
      }

      console.log("Mentorship program registration:", registration, res);
      return c.json(registration, 201);
    } catch (e) {
      console.error("Error creating mentorship program registration:", e);
      return c.json({ error: "Failed to create registration" }, 500);
    }
  }
}
