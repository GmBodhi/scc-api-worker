import { OpenAPIRoute } from "chanfana";
import { type AppContext } from "../types";
import { GoogleSheetsService } from "../services/googleSheetsService";
import { z } from "zod";

const RefundRequest = z.object({
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  reason: z.string().optional(),
  refundedBy: z.string().optional(),
});

const RefundResponse = z.object({
  success: z.boolean(),
  message: z.string(),
  refund: z.object({
    id: z.string(),
    studentId: z.string(),
    studentName: z.string(),
    studentEmail: z.string(),
    transactionRef: z.string().optional(),
    refundReason: z.string(),
    refundedAt: z.string(),
  }).optional(),
});

export class StudentRefund extends OpenAPIRoute {
  schema = {
    summary: "Process student refund and remove from database",
    request: {
      body: {
        content: {
          "application/json": {
            schema: RefundRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Refund processed successfully",
        content: {
          "application/json": {
            schema: RefundResponse,
          },
        },
      },
      "400": {
        description: "Bad request - student not found or already refunded",
        content: {
          "application/json": {
            schema: RefundResponse,
          },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: RefundResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { email, phoneNumber, reason, refundedBy } = data.body;

    try {
      // Check if student exists with both email and phone number
      const studentResult = await c.env.db
        .prepare("SELECT * FROM students WHERE email = ? AND phoneNumber = ?")
        .bind(email, phoneNumber)
        .first();

      if (!studentResult) {
        return c.json({
          success: false,
          message: "No student found with the provided email and phone number"
        }, 400);
      }

      const studentId = studentResult.id as string;

      // Check if refund already exists
      const existingRefund = await c.env.db
        .prepare("SELECT id FROM refunds WHERE studentId = ?")
        .bind(studentId)
        .first();

      if (existingRefund) {
        return c.json({
          success: false,
          message: "Student has already been refunded"
        }, 400);
      }

      // Get transaction details if student is paid
      let transactionResult = null;
      if (studentResult.status === 'paid' && studentResult.upiRef) {
        transactionResult = await c.env.db
          .prepare("SELECT * FROM transactions WHERE ref = ?")
          .bind(studentResult.upiRef)
          .first();
      }

      // Generate refund ID
      const refundId = `REF_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create refund record
      const refundData = {
        id: refundId,
        studentId: studentResult.id,
        studentName: studentResult.name,
        studentBatch: studentResult.batch,
        studentEmail: studentResult.email,
        studentPhoneNumber: studentResult.phoneNumber,
        transactionId: transactionResult?.id || null,
        transactionVpa: transactionResult?.vpa || null,
        transactionAmount: transactionResult?.amount || null,
        transactionDate: transactionResult?.date || null,
        transactionRef: transactionResult?.ref || null,
        refundReason: reason,
        refundedAt: new Date().toISOString(),
        refundedBy: refundedBy || null,
      };

      // Insert refund record
      await c.env.db
        .prepare(`
          INSERT INTO refunds(
            id, studentId, studentName, studentBatch, studentEmail, studentPhoneNumber,
            transactionId, transactionVpa, transactionAmount, transactionDate, transactionRef,
            refundReason, refundedAt, refundedBy
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          refundData.id,
          refundData.studentId,
          refundData.studentName,
          refundData.studentBatch,
          refundData.studentEmail,
          refundData.studentPhoneNumber,
          refundData.transactionId,
          refundData.transactionVpa,
          refundData.transactionAmount,
          refundData.transactionDate,
          refundData.transactionRef,
          refundData.refundReason,
          refundData.refundedAt,
          refundData.refundedBy
        )
        .run();

      // Mark transaction as refunded if it exists
      if (transactionResult) {
        await c.env.db
          .prepare("UPDATE transactions SET updatedAt = ? WHERE ref = ?")
          .bind(new Date().toISOString(), transactionResult.ref)
          .run();
      }

      // Delete student record
      await c.env.db
        .prepare("DELETE FROM students WHERE id = ?")
        .bind(studentId)
        .run();

      // TODO: Update Google Sheets - remove student row
      // This functionality will be added once removeStudentFromSheets method is implemented
      console.log(`Student ${studentId} refunded - Google Sheets update skipped for now`);

      console.log(`Refund processed for student ${studentId}:`, refundData);

      return c.json({
        success: true,
        message: "Refund processed successfully. Student removed from database.",
        refund: {
          id: refundData.id,
          studentId: refundData.studentId,
          studentName: refundData.studentName,
          studentEmail: refundData.studentEmail,
          transactionRef: refundData.transactionRef,
          refundReason: refundData.refundReason,
          refundedAt: refundData.refundedAt,
        }
      }, 200);

    } catch (error) {
      console.error("Error processing refund:", error);
      return c.json({
        success: false,
        message: "Internal server error"
      }, 500);
    }
  }
}
