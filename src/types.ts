import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const RawTransaction = z.object({
  data: z.string(),
});

export const StudentStatus = z.enum(["paid", "pending"]);

export const StudentRegistration = z.object({
  name: z.string().min(1, "Name is required"),
  batch: z.string().min(1, "Batch is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  status: StudentStatus.optional().default("pending"),
  upiRef: z.string().optional(),
});

export const StudentResponse = StudentRegistration.extend({
  id: z.string(),
});

export const MentorshipRegistration = z.object({
  name: z.string().min(1, "Name is required"),
  batch: z.string().min(1, "Batch is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  technologies: z
    .array(z.string())
    .min(1, "At least one technology is required"),
});

export const MentorshipResponse = MentorshipRegistration.extend({
  id: z.string(),
});

export const ExperienceLevel = z.enum(["Beginner", "Intermediate", "Advanced"]);

export const MentorshipProgramRegistration = z.object({
  name: z.string().min(1, "Name is required"),
  batch: z.string().min(1, "Batch is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  experienceLevel: ExperienceLevel,
  projectIdea: z.string().min(10, "Project idea must be at least 10 characters"),
});

export const MentorshipProgramResponse = MentorshipProgramRegistration.extend({
  id: z.string(),
  status: z.literal("registered"),
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

export const TransactionCheckResponse = z.object({
  exists: z.boolean(),
  transaction: z
    .object({
      id: z.string(),
      vpa: z.string(),
      amount: z.number(),
      date: z.string(),
      upiRef: z.string(),
      status: z.string(),
    })
    .optional(),
  message: z.string(),
});
