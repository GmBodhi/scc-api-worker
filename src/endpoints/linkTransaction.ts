import { OpenAPIRoute } from "chanfana";
import { type AppContext, LinkTransactionRequest, LinkTransactionResponse } from "../types";
import { EmailService } from "../services/emailService";
import { GoogleSheetsService } from "../services/googleSheetsService";

export class LinkTransaction extends OpenAPIRoute {
  schema = {
    summary: "Link a transaction to a student",
    request: {
      body: {
        content: {
          "application/json": {
            schema: LinkTransactionRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Transaction linked successfully",
        content: {
          "application/json": {
            schema: LinkTransactionResponse,
          },
        },
      },
      "400": {
        description: "Bad request - validation error or business logic failure",
        content: {
          "application/json": {
            schema: LinkTransactionResponse,
          },
        },
      },
      "404": {
        description: "Unauthorized or resource not found",
        content: {
          "application/json": {
            schema: LinkTransactionResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();

    const { refId, studentId } = data.body;

    try {
      // Check if transaction exists and is unused
      const transactionResult = await c.env.db
        .prepare("SELECT * FROM transactions WHERE ref = ? AND status = 'unused'")
        .bind(refId)
        .first();

      if (!transactionResult) {
        return c.json({ 
          success: false, 
          message: "Transaction not found or already used" 
        }, 400);
      }

      // Check if student exists and has pending status
      const studentResult = await c.env.db
        .prepare("SELECT * FROM students WHERE id = ? AND status = 'pending'")
        .bind(studentId)
        .first();

      if (!studentResult) {
        return c.json({ 
          success: false, 
          message: "Student not found or not in pending status" 
        }, 400);
      }

      // Update transaction status to 'used'
      await c.env.db
        .prepare("UPDATE transactions SET status = 'used', updatedAt = ? WHERE ref = ?")
        .bind(new Date().toISOString(), refId)
        .run();

      // Update student with upiRef and change status to 'paid'
      await c.env.db
        .prepare("UPDATE students SET upiRef = ?, status = 'paid', updatedAt = ? WHERE id = ?")
        .bind(refId, new Date().toISOString(), studentId)
        .run();

      // Send payment confirmation email
      try {
        const emailService = new EmailService(c.env.BREVO_API_KEY);
        const emailSent = await emailService.sendPaymentConfirmationEmail(
          studentResult.name as string,
          studentResult.email as string,
          studentId,
          refId
        );

        if (!emailSent) {
          console.error(`Failed to send payment confirmation email to student ${studentId}`);
        } else {
          console.log(`Payment confirmation email sent to student ${studentId} (${studentResult.email})`);
        }
      } catch (emailError) {
        console.error("Error sending payment confirmation email:", emailError);
        // Don't fail the transaction linking if email fails
      }

      // Update Google Sheets with payment status
      try {
        const googleSheetsService = new GoogleSheetsService({
          spreadsheetId: c.env.GOOGLE_SHEETS_ID,
          serviceAccountEmail: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          privateKey: c.env.GOOGLE_PRIVATE_KEY,
        });

        const sheetsUpdated = await googleSheetsService.updateStudentStatus(studentId, 'paid', refId);

        if (!sheetsUpdated) {
          console.error(`Failed to update student ${studentId} status in Google Sheets`);
        } else {
          console.log(`Student ${studentId} status updated to 'paid' in Google Sheets`);
        }
      } catch (sheetsError) {
        console.error("Error updating Google Sheets:", sheetsError);
        // Don't fail the transaction linking if Google Sheets update fails
      }

      return c.json({ 
        success: true, 
        message: "Transaction linked successfully to student. Confirmation email sent." 
      }, 200);

    } catch (error) {
      console.error("Error linking transaction:", error);
      return c.json({ 
        success: false, 
        message: "Internal server error" 
      }, 500);
    }
  }
}
