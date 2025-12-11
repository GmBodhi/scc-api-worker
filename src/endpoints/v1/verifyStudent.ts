import { OpenAPIRoute } from "chanfana";
import { type AppContext, VerifyStudentRequest, VerifyStudentResponse } from "../../types";

export class VerifyStudent extends OpenAPIRoute {
  schema = {
    summary: "Verify student with email and phone number",
    request: {
      body: {
        content: {
          "application/json": {
            schema: VerifyStudentRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Student verified successfully, details returned",
        content: {
          "application/json": {
            schema: VerifyStudentResponse,
          },
        },
      },
      "400": {
        description: "Email or phone number exists in different records",
        content: {
          "application/json": {
            schema: VerifyStudentResponse,
          },
        },
      },
      "404": {
        description: "No student found with both email and phone number",
        content: {
          "application/json": {
            schema: VerifyStudentResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { email, phoneNumber } = data.body;

    try {
      // Check if a student exists with both email and phone number
      const matchingStudentResult = await c.env.db
        .prepare("SELECT * FROM students WHERE email = ? AND phoneNumber = ?")
        .bind(email, phoneNumber)
        .first();

      if (matchingStudentResult) {
        // Found exact match - return student details
        const studentData = {
          id: matchingStudentResult.id,
          name: matchingStudentResult.name,
          batch: matchingStudentResult.batch,
          email: matchingStudentResult.email,
          phoneNumber: matchingStudentResult.phoneNumber,
          status: matchingStudentResult.status,
          upiRef: matchingStudentResult.upiRef,
        };

        if (matchingStudentResult.status === 'paid') {
          return c.json({
            success: false,
            message: "Student is already verified and paid",
            student: studentData
          }, 400);
        }

        return c.json({ 
          success: true, 
          message: "Student verified successfully",
          student: studentData
        }, 200);
      }

      // Check if email exists in any other record
      const emailExistsResult = await c.env.db
        .prepare("SELECT id FROM students WHERE email = ?")
        .bind(email)
        .first();

      if (emailExistsResult) {
        return c.json({ 
          success: false, 
          message: "Email exists but with different phone number" 
        }, 400);
      }

      // Check if phone number exists in any other record
      const phoneExistsResult = await c.env.db
        .prepare("SELECT id FROM students WHERE phoneNumber = ?")
        .bind(phoneNumber)
        .first();

      if (phoneExistsResult) {
        return c.json({ 
          success: false, 
          message: "Phone number exists but with different email" 
        }, 400);
      }

      // Neither email nor phone number found in any record
      return c.json({ 
        success: false, 
        message: "No student found with the provided email and phone number" 
      }, 404);

    } catch (error) {
      console.error("Error verifying student:", error);
      return c.json({ 
        success: false, 
        message: "Internal server error" 
      }, 500);
    }
  }
}
