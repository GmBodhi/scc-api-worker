import { OpenAPIRoute } from "chanfana";
import { type AppContext, StudentRegistration, StudentResponse, ErrorResponse } from "../types";
import { GoogleSheetsService } from "../services/googleSheetsService";

export class StudentCreate extends OpenAPIRoute {
  schema = {
    summary: "Create a new student registration",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StudentRegistration,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Returns the created student registration",
        content: {
          "application/json": {
            schema: StudentResponse,
          },
        },
      },
      "400": {
        description: "Bad request - validation error or capacity exceeded",
        content: {
          "application/json": {
            schema: ErrorResponse,
          }
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
      // Check current student count to enforce 100-person capacity limit
      const countResult = await c.env.db
        .prepare("SELECT COUNT(*) as count FROM students")
        .first<{ count: number }>();

      if (countResult && countResult.count >= 120) {
        return c.json({ error: "Registration capacity exceeded. Maximum 120 students allowed." }, 400);
      }

      const studentData = data.body;
      
      // Generate a unique ID (using timestamp + random string for simplicity)
      const id = `STU_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const student = {
        id,
        ...studentData,
        status: studentData?.status || 'pending',
      };
      
      const res = await c.env.db
        .prepare(
          "INSERT INTO students(id, name, batch, email, phoneNumber, status, upiRef, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          student.id,
          student.name,
          student.batch,
          student.email,
          student.phoneNumber,
          student.status,
          student.upiRef || null,
          new Date().toISOString(),
          new Date().toISOString()
        )
        .run().catch((e) => ({ error: true, details: e.message }));
      
      if ('error' in res) {
        console.error("Database error:", res);
        return c.json({ error: "The email or phone number is already in use" }, 400);
      }

      // Update Google Sheets
      try {
        const googleSheetsService = new GoogleSheetsService({
          spreadsheetId: c.env.GOOGLE_SHEETS_ID,
          serviceAccountEmail: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          privateKey: c.env.GOOGLE_PRIVATE_KEY,
        });

        const sheetsUpdated = await googleSheetsService.addStudentRegistration({
          id: student.id,
          name: student.name,
          batch: student.batch,
          email: student.email,
          phoneNumber: student.phoneNumber,
          status: student.status,
          upiRef: student.upiRef,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (!sheetsUpdated) {
          console.error(`Failed to add student ${student.id} to Google Sheets`);
        } else {
          console.log(`Student ${student.id} added to Google Sheets successfully`);
        }
      } catch (sheetsError) {
        console.error("Error updating Google Sheets:", sheetsError);
        // Don't fail the registration if Google Sheets update fails
      }
      
      console.log("Student registration:", student, res);
      return c.json(student, 201);

    } catch (e) {
      console.error("Error creating student:", e);
      return c.json({ error: "Failed to create student" }, 500);
    }
  }
}
