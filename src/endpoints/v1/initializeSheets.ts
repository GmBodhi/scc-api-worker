import { OpenAPIRoute } from "chanfana";
import { type AppContext } from "../types";
import { GoogleSheetsService } from "../services/googleSheetsService";
import { z } from "zod";

const InitializeResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

export class InitializeSheets extends OpenAPIRoute {
  schema = {
    summary: "Initialize Google Sheets with headers",
    responses: {
      "200": {
        description: "Google Sheets initialized successfully",
        content: {
          "application/json": {
            schema: InitializeResponse,
          },
        },
      },
      "500": {
        description: "Failed to initialize Google Sheets",
        content: {
          "application/json": {
            schema: InitializeResponse,
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

      const initialized = await googleSheetsService.initializeSheet();

      if (initialized) {
        return c.json({
          success: true,
          message: "Google Sheets initialized successfully with headers",
        }, 200);
      } else {
        return c.json({
          success: false,
          message: "Failed to initialize Google Sheets",
        }, 500);
      }
    } catch (error) {
      console.error("Error initializing Google Sheets:", error);
      return c.json({
        success: false,
        message: "Internal server error",
      }, 500);
    }
  }
}