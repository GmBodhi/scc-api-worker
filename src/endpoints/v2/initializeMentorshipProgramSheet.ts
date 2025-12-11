import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse } from "../../types";
import { GoogleSheetsService } from "../../services/googleSheetsService";
import { z } from "zod";

export class InitializeMentorshipProgramSheet extends OpenAPIRoute {
  schema = {
    summary: "Initialize Google Sheets for mentorship program registrations",
    responses: {
      "200": {
        description: "Returns success message",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
            }),
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
      const googleSheetsService = new GoogleSheetsService({
        spreadsheetId: c.env.GOOGLE_SHEETS_ID,
        serviceAccountEmail: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        privateKey: c.env.GOOGLE_PRIVATE_KEY,
      });

      const initialized = await googleSheetsService.initializeMentorshipProgramSheet();

      if (!initialized) {
        return c.json(
          { error: "Failed to initialize MentorshipProgram sheet" },
          500
        );
      }

      return c.json({
        success: true,
        message: "MentorshipProgram sheet initialized successfully",
      });
    } catch (e) {
      console.error("Error initializing sheet:", e);
      return c.json(
        { error: "Failed to initialize MentorshipProgram sheet" },
        500
      );
    }
  }
}
