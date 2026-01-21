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
  projectIdea: z
    .string()
    .min(10, "Project idea must be at least 10 characters"),
});

export const MentorshipProgramResponse = MentorshipProgramRegistration.extend({
  id: z.string(),
  status: z.literal("registered"),
});

export const LinkTransactionRequest = z.object({
  refId: z.string().min(1, "Reference ID is required"),
});

export const LinkHackerRankPaymentRequest = z.object({
  transaction_id: z.string().min(1, "Transaction reference ID is required"),
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

// V3 Auth schemas
export const SignupRequest = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .optional(),
  profile_photo: z.string().optional(), // base64 data or URL
  profile_photo_filename: z.string().optional(),
});

export const SignupResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      access_token: z.string(),
      refresh_token: z.string(),
      expires_in: z.number(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        phone: z.string().nullable(),
        profile_photo_url: z.string().nullable(),
        is_verified: z.boolean(),
      }),
    })
    .optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const EtlabVerifyRequest = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const EtlabVerifyResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      user_id: z.string(),
      name: z.string().nullable(),
      email: z.string().nullable(),
      etlab_username: z.string(),
      admission_no: z.string().nullable(),
      batch: z.string().nullable(),
      phone: z.string().nullable(),
      register_no: z.string().nullable(),
      profile_photo_url: z.string().nullable(),
      is_verified: z.boolean(),
    })
    .optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const LoginRequest = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const LoginResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      access_token: z.string(),
      refresh_token: z.string(),
      expires_in: z.number(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        profile_photo_url: z.string().nullable(),
      }),
    })
    .optional(),
  error: z.string().optional(),
});

// Passkey schemas
export const PasskeyRegisterStartRequest = z.object({
  session_id: z.string().min(1, "Session ID is required"),
  device_name: z.string().optional(),
});

export const PasskeyRegisterStartResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      challenge: z.string(),
      rp: z.object({
        name: z.string(),
        id: z.string(),
      }),
      user: z.object({
        id: z.string(),
        name: z.string(),
        displayName: z.string(),
      }),
      pubKeyCredParams: z.array(
        z.object({
          type: z.literal("public-key"),
          alg: z.number(),
        }),
      ),
      timeout: z.number(),
      attestation: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export const PasskeyRegisterVerifyRequest = z.object({
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    type: z.literal("public-key"),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
    }),
  }),
  device_name: z.string().optional(),
});

export const PasskeyRegisterVerifyResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      credential_id: z.string(),
      message: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export const PasskeyLoginStartRequest = z.object({
  email: z.string().email("Valid email is required"),
});

export const PasskeyLoginStartResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      challenge: z.string(),
      timeout: z.number(),
      rpId: z.string(),
      allowCredentials: z.array(
        z.object({
          type: z.literal("public-key"),
          id: z.string(),
          transports: z.array(z.string()).optional(),
        }),
      ),
    })
    .optional(),
  error: z.string().optional(),
});

export const PasskeyLoginVerifyRequest = z.object({
  email: z.string().email("Valid email is required"),
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    type: z.literal("public-key"),
    response: z.object({
      clientDataJSON: z.string(),
      authenticatorData: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
  }),
});

export const PasskeyLoginVerifyResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      session_id: z.string(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        profile_photo_url: z.string().nullable(),
      }),
    })
    .optional(),
  error: z.string().optional(),
});

export const GetCurrentUserResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      etlab_username: z.string().nullable(),
      profile_photo_url: z.string().nullable(),
      created_at: z.number(),
      is_verified: z.boolean(),
    })
    .optional(),
  error: z.string().optional(),
});

export const UpdateProfileRequest = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  email: z.string().email("Valid email is required").optional(),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .optional(),
  profile_photo: z.string().nullable().optional(), // base64 data, URL, or null to remove
  profile_photo_filename: z.string().optional(), // filename for custom uploads
});

export const UpdateProfileResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      phone: z.string().nullable(),
      etlab_username: z.string().nullable(),
      profile_photo_url: z.string().nullable(),
      created_at: z.number(),
      is_verified: z.boolean(),
    })
    .optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const LogoutResponse = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const GetPasskeysResponse = z.object({
  success: z.boolean(),
  data: z
    .array(
      z.object({
        id: z.string(),
        credential_id: z.string(),
        device_name: z.string().nullable(),
        created_at: z.number(),
        last_used_at: z.number().nullable(),
      }),
    )
    .optional(),
  error: z.string().optional(),
});

export const DeletePasskeyResponse = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const EventSignupRequest = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  batch: z.string().min(1, "Batch is required"),
});

export const EventSignupResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      registration_id: z.string(),
      event_id: z.string(),
      name: z.string(),
      email: z.string(),
      phone: z.string(),
      batch: z.string(),
      registered_at: z.number(),
      status: z.string(),
    })
    .optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

// Password Reset
export const PasswordResetRequestSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const PasswordResetRequestResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const PasswordResetVerifySchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  new_password: z.string().min(8, "Password must be at least 8 characters"),
});

export const PasswordResetVerifyResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Notifications
export const NotificationType = z.enum([
  "info",
  "success",
  "warning",
  "error",
  "event",
]);

export const CreateNotificationRequest = z.object({
  user_id: z.string().min(1, "User ID is required"),
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  type: NotificationType.optional().default("info"),
  link: z.string().url().optional(),
});

export const Notification = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  message: z.string(),
  type: z.string(),
  read: z.number(),
  link: z.string().nullable(),
  created_at: z.number(),
  read_at: z.number().nullable(),
});

export const GetNotificationsResponse = z.object({
  success: z.boolean(),
  data: z.array(Notification).optional(),
  unread_count: z.number().optional(),
  error: z.string().optional(),
});

export const NotificationResponse = z.object({
  success: z.boolean(),
  data: Notification.optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const MarkNotificationReadResponse = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});
