import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  MentorshipRegistration,
  MentorshipResponse,
  ErrorResponse,
} from "../../types";
import { GoogleSheetsService } from "../../services/googleSheetsService";

export class MentorshipCreate extends OpenAPIRoute {
  schema = {
    summary: "Create a new mentorship registration",
    request: {
      body: {
        content: {
          "application/json": {
            schema: MentorshipRegistration,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Returns the created mentorship registration",
        content: {
          "application/json": {
            schema: MentorshipResponse,
          },
        },
      },
      "400": {
        description: "Bad request - validation error or capacity exceeded",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Unauthorized",
        content: {},
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();

    try {
      /*
      // Check current mentorship count to enforce 125-person capacity limit
      const countResult = await c.env.db
        .prepare("SELECT COUNT(*) as count FROM mentorships")
        .first<{ count: number }>();

      if (countResult && countResult.count >= 125) {
        return c.json({ error: "Registration capacity exceeded. Maximum 125 mentorships allowed." }, 400);
      }
      
      // if (countResult && countResult.count >= 125) {
      //   return c.json({ error: "Registration capacity exceeded. Maximum 125 mentorships allowed." }, 400);
      // }
      */

      const mentorshipData = data.body;

      // Generate a unique ID (using timestamp + random string for simplicity)
      const id = `MEN_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      const mentorship = {
        id,
        ...mentorshipData,
        technologies: JSON.stringify(mentorshipData.technologies),
      };

      const res = await c.env.db
        .prepare(
          "INSERT INTO mentorships(id, name, batch, email, phone, technologies, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          mentorship.id,
          mentorship.name,
          mentorship.batch,
          mentorship.email,
          mentorship.phone,
          mentorship.technologies,
          new Date().toISOString(),
          new Date().toISOString()
        )
        .run()
        .catch((e) => ({ error: true, details: e.message }));

      if ("error" in res) {
        console.error("Database error:", res);
        return c.json(
          { error: "The email or phone number is already in use" },
          400
        );
      }

      // Update Google Sheets
      try {
        const googleSheetsService = new GoogleSheetsService({
          spreadsheetId: c.env.GOOGLE_SHEETS_ID,
          serviceAccountEmail: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          privateKey: c.env.GOOGLE_PRIVATE_KEY,
        });

        const sheetsUpdated =
          await googleSheetsService.addMentorshipRegistration({
            id: mentorship.id,
            name: mentorship.name,
            batch: mentorship.batch,
            email: mentorship.email,
            phone: mentorship.phone,
            technologies: mentorshipData.technologies,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

        if (!sheetsUpdated) {
          console.error(
            `Failed to add mentorship ${mentorship.id} to Google Sheets`
          );
        } else {
          console.log(
            `Mentorship ${mentorship.id} added to Google Sheets successfully`
          );
        }
      } catch (sheetsError) {
        console.error("Error updating Google Sheets:", sheetsError);
        // Don't fail the registration if Google Sheets update fails
      }

      const responseData = {
        ...mentorship,
        technologies: mentorshipData.technologies,
      };

      console.log("Mentorship registration:", responseData, res);
      return c.json(responseData, 201);
    } catch (e) {
      console.error("Error creating mentorship:", e);
      return c.json({ error: "Failed to create mentorship" }, 500);
    }
  }
}
