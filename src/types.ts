import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const RawTransaction = z.object({
  data: z.string(),
});

export const StudentStatus = z.enum(['paid', 'pending']);

export const StudentRegistration = z.object({
  name: z.string().min(1, "Name is required"),
  batch: z.string().min(1, "Batch is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  status: StudentStatus.optional().default('pending'),
  upiRef: z.string().optional(),
});

export const StudentResponse = StudentRegistration.extend({
  id: z.string(),
});

export const LinkTransactionRequest = z.object({
  refId: z.string().min(1, "Reference ID is required"),
  studentId: z.string().min(1, "Student ID is required"),
});

export const LinkTransactionResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const TicketVerificationResponse = z.object({
  success: z.boolean(),
  name: z.string().optional(),
  message: z.string(),
});

export const VerifyStudentRequest = z.object({
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
});

export const VerifyStudentResponse = z.object({
  success: z.boolean(),
  message: z.string(),
  student: StudentResponse.optional(),
});

export const ErrorResponse = z.object({
  error: z.string(),
});
