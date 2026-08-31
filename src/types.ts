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

export const JdkInstalledStatus = z.enum([
  "already_installed",
  "will_follow_tutorial",
]);

export const McpWorkshopSignupRequest = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  whatsapp: z
    .string()
    .min(10, "WhatsApp number must be at least 10 digits")
    .regex(/^\d+$/, "WhatsApp number must contain digits only"),
  jdkInstalled: JdkInstalledStatus,
  springTutorial: z.literal(true, {
    errorMap: () => ({
      message: "You must confirm watching the Spring Boot setup tutorial",
    }),
  }),
});

export const McpWorkshopSignupResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      registration_id: z.string(),
    })
    .optional(),
  error: z.string().optional(),
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

// Ideas (Host Your Own Events) schemas
export const CreateIdeaRequest = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

export const IdeaAuthor = z.object({
  id: z.string(),
  name: z.string(),
  profile_photo_url: z.string().nullable(),
  is_verified: z.boolean(),
});

export const Idea = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  description: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
  author: IdeaAuthor,
  vote_count: z.number(),
  comment_count: z.number(),
  has_voted: z.boolean().optional(), // Only present when user is authenticated
});

export const CreateIdeaResponse = z.object({
  success: z.boolean(),
  data: Idea.optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const GetIdeasResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      ideas: z.array(Idea),
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      total_pages: z.number(),
    })
    .optional(),
  error: z.string().optional(),
});

export const GetIdeaResponse = z.object({
  success: z.boolean(),
  data: Idea.optional(),
  error: z.string().optional(),
});

export const VoteIdeaResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      voted: z.boolean(),
      vote_count: z.number(),
    })
    .optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const CreateCommentRequest = z.object({
  comment: z.string().min(1, "Comment cannot be empty"),
});

export const IdeaComment = z.object({
  id: z.string(),
  idea_id: z.string(),
  user_id: z.string(),
  comment: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
  author: IdeaAuthor,
});

export const CreateCommentResponse = z.object({
  success: z.boolean(),
  data: IdeaComment.optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const GetCommentsResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      comments: z.array(IdeaComment),
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      total_pages: z.number(),
    })
    .optional(),
  error: z.string().optional(),
});

export const DeleteCommentResponse = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const UpdateIdeaRequest = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").optional(),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters")
      .optional(),
  })
  .refine((data) => data.title || data.description, {
    message: "At least one field (title or description) must be provided",
  });

export const UpdateIdeaResponse = z.object({
  success: z.boolean(),
  data: Idea.optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const UpdateCommentRequest = z.object({
  comment: z.string().min(1, "Comment cannot be empty"),
});

export const UpdateCommentResponse = z.object({
  success: z.boolean(),
  data: IdeaComment.optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

// Startathon Waitlist
export const StartathonWaitlistRequest = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  college: z.string().min(1, "College is required"),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .optional(),
});

export const StartathonWaitlistResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      waitlist_id: z.string(),
    })
    .optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

// Google OAuth schemas
export const GoogleOAuthInitiateResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      auth_url: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export const GoogleOAuthCallbackRequest = z.object({
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().min(1, "State is required"),
});

export const GoogleOAuthCallbackResponse = z.object({
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
        is_verified: z.boolean(),
      }),
      is_new_user: z.boolean(),
    })
    .optional(),
  error: z.string().optional(),
});

// ============================================================
// Startathon (standalone module — startathon.sctcoding.club)
// ============================================================

// Team fee: ₹100 flat, or ₹90 if the team applied a valid referral code.
export const STARTATHON_TEAM_FEE = 100;
export const STARTATHON_TEAM_REFERRAL_FEE = 90;

// Selection fee: ₹250 per head, charged once a team is shortlisted. Unlike the
// team fee this is per person, and one transfer may cover several teammates —
// so the valid amounts are 250 x 1..TEAM_CAP and nothing between.
export const STARTATHON_SELECTION_FEE = 250;
export const STARTATHON_TEAM_CAP = 4;
export const STARTATHON_SELECTION_AMOUNTS = Array.from(
  { length: STARTATHON_TEAM_CAP },
  (_, i) => STARTATHON_SELECTION_FEE * (i + 1),
);

export const StartathonParticipant = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["leader", "member"]),
  // Selection-fee state. Absent/null means nobody has filed a reference for
  // this member yet — an unpaid member, not an error.
  selection_payment_status: z.enum(["submitted", "confirmed"]).nullable(),
  selection_transaction_ref: z.string().nullable(),
  // Who filed it. Differs from user_id whenever a teammate paid in bulk, which
  // is what lets the client say "your leader paid for you".
  selection_paid_by: z.string().nullable(),
});

export const StartathonLoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const startathonUtmFields = {
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  utm_term: z.string().max(100).optional(),
  utm_content: z.string().max(100).optional(),
};

export const StartathonGoogleCredentialRequest = z.object({
  credential: z.string().min(1, "Google credential is required"),
  ...startathonUtmFields,
});

export const StartathonAuthResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      access_token: z.string(),
      expires_in: z.number(),
      user: z.object({
        user_id: z.string(),
        team_id: z.string().nullable(),
        role: z.enum(["leader", "member"]).nullable(),
        name: z.string(),
        email: z.string(),
        phone: z.string().nullable(),
        college: z.string().nullable(),
        gender: z.enum(["male", "female", "other"]).nullable(),
      }),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonPasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const StartathonPasswordResetVerifySchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8).max(100),
  name: z.string().min(1).max(100).optional(),
});

export const StartathonTeamInvite = z.object({
  invite_id: z.string(),
  email: z.string(),
  status: z.enum(["pending", "accepted", "declined", "cancelled"]),
  created_at: z.number(),
});

export const StartathonTeamResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      team_id: z.string(),
      team_name: z.string(),
      join_code: z.string(),
      status: z.string(),
      transaction_ref: z.string().nullable(),
      created_at: z.number(),
      // Per head, in rupees. Sent whatever the team's status, so the client
      // never has to hardcode it.
      selection_fee: z.number(),
      // Raw shortlisting outcome, for anything that needs to tell a waitlisted
      // team from an unpicked one. `status` above already folds 'shortlisted'
      // into 'selected'.
      shortlist_status: z.enum(["shortlisted", "waitlisted"]).nullable(),
      your_role: z.enum(["leader", "member"]),
      members: z.array(StartathonParticipant),
      // The caller's own selection-fee payments. Their payment_ids are what a
      // client sends back to edit one, since a payer may hold more than one.
      my_selection_payments: z.array(
        z.object({
          payment_id: z.string(),
          transaction_ref: z.string(),
          amount: z.number(),
          status: z.enum(["submitted", "confirmed"]),
          submitted_at: z.number(),
          confirmed_at: z.number().nullable(),
          created_at: z.number().nullable(),
          updated_at: z.number().nullable(),
          covers: z.array(z.string()),
        }),
      ),
      invites: z.array(StartathonTeamInvite),
      referral_code: z.string(),
      referred_by: z.string().nullable(),
      expected_fee: z.number(),
      referral_count: z.number().nullable().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonMeResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      user_id: z.string(),
      team_id: z.string().nullable(),
      role: z.enum(["leader", "member"]).nullable(),
      name: z.string(),
      email: z.string(),
      phone: z.string().nullable(),
      college: z.string().nullable(),
      gender: z.enum(["male", "female", "other"]).nullable(),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonUpdateMeRequest = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
  college: z.string().min(1).max(150).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

export const StartathonPaymentRequest = z.object({
  transaction_id: z.string().min(1),
});

export const StartathonSelectionPaymentRequest = z.object({
  transaction_id: z.string().min(1),
  // Whom this transfer pays for, by user_id. Omitted means the caller alone.
  //
  // Explicit rather than inferred from the amount: ₹500 in a four-person team
  // cannot say which two it covers. The amount is then required to equal
  // ₹250 x covers.length, so the list and the money have to agree.
  covers: z.array(z.string().min(1)).min(1).max(STARTATHON_TEAM_CAP).optional(),
  // Which of the caller's own payments to rewrite. Omitted opens a new one,
  // except for the plain "I mistyped the reference" resend — see resolveTarget
  // in selectionPayment.ts. Needed because a payer can hold several payments:
  // their own share and a teammate's are separate transfers, not one edit.
  payment_id: z.string().min(1).optional(),
});

export const StartathonLogisticsMemberRequest = z.object({
  // Every field optional and nullable: this is a full replace, and clearing an
  // answer has to be expressible. Omitted and null both mean "no answer".
  food_preference: z.enum(["veg", "non-veg"]).nullable().optional(),
  dietary_notes: z.string().max(300).nullable().optional(),
  travel_mode: z
    .enum(["train", "bus", "car", "flight", "own", "other"])
    .nullable()
    .optional(),
  // Unix seconds. Paired with arrival_note because people know the day long
  // before the time.
  arrival_at: z.number().int().positive().nullable().optional(),
  arrival_note: z.string().max(200).nullable().optional(),
  needs_travel_guidance: z.boolean().optional(),
  guidance_note: z.string().max(300).nullable().optional(),
});

export const StartathonLogisticsMember = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["leader", "member"]),
  food_preference: z.enum(["veg", "non-veg"]).nullable(),
  dietary_notes: z.string().nullable(),
  travel_mode: z
    .enum(["train", "bus", "car", "flight", "own", "other"])
    .nullable(),
  arrival_at: z.number().nullable(),
  arrival_note: z.string().nullable(),
  needs_travel_guidance: z.boolean(),
  guidance_note: z.string().nullable(),
  // Null for a member who has never answered — the roster still lists them,
  // which is the point: the gaps are the work.
  updated_by: z.string().nullable(),
  updated_at: z.number().nullable(),
});

export const StartathonLogisticsResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      team_id: z.string(),
      team_name: z.string(),
      your_role: z.enum(["leader", "member"]),
      members: z.array(StartathonLogisticsMember),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonSignupRequest = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  phone: z.string().min(10).max(15),
  college: z.string().min(1).max(150),
  gender: z.enum(["male", "female", "other"]),
  ...startathonUtmFields,
});

export const StartathonCreateTeamRequest = z.object({
  team_name: z.string().min(2).max(60),
});

export const StartathonCreateTeamResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      team_id: z.string(),
      team_name: z.string(),
      join_code: z.string(),
      referral_code: z.string(),
      status: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonReferralRequest = z.object({
  referral_code: z.string().min(1).max(20),
});

export const StartathonReferralResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      referred_by: z.string(),
      expected_fee: z.number(),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonInviteRequest = z.object({
  email: z.string().email(),
});

export const StartathonJoinTeamRequest = z.object({
  join_code: z.string().min(1).max(20),
});

export const StartathonTransferLeadershipRequest = z.object({
  new_leader_id: z.string().min(1),
});

export const StartathonInviteListItem = z.object({
  invite_id: z.string(),
  team_name: z.string(),
  invited_by: z.string(),
  created_at: z.number(),
});

export const StartathonInvitesResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      invites: z.array(StartathonInviteListItem),
    })
    .optional(),
  error: z.string().optional(),
});

// Startathon application (pre-event shortlisting). The deck and video
// carry the pitch itself; these fields are the metadata around them.
export const StartathonPriorWorkEntry = z.object({
  kind: z.enum([
    "repository",
    "prototype",
    "prior_version",
    "prior_competition",
    "design_file",
    "dataset_or_model",
    "reusable_component",
    "hosted_app",
    // Escape hatch — anything that doesn't fit the named categories. The
    // required description carries the detail, so an "other" entry is
    // still a real declaration rather than an empty box ticked.
    "other",
  ]),
  url: z.string().url().optional(),
  description: z.string().min(1).max(500),
});

export const StartathonApplicationRequest = z.object({
  title: z.string().min(3).max(100),
  summary: z.string().min(10).max(300),
  problem_evidence: z.string().min(10).max(1000),
  deck_url: z.string().url(),
  video_url: z.string().url(),
  // Free text, not an enum — the domain list shifts between editions, and
  // forcing an ill-fitting solution into "other" tells the panel nothing.
  domains: z.array(z.string().min(1).max(60)).max(5).optional(),
  prior_work: z.array(StartathonPriorWorkEntry).max(20).optional(),
});

// Every field optional — a member who fills in nothing simply has no row.
export const StartathonApplicationMemberRequest = z.object({
  about: z.string().max(1000).optional(),
  resume_url: z.string().url().optional(),
  github: z.string().url().optional(),
  linkedin: z.string().url().optional(),
  project_links: z.array(z.string().url()).max(5).optional(),
});

export const StartathonApplicationMember = z.object({
  user_id: z.string(),
  name: z.string(),
  role: z.enum(["leader", "member"]),
  about: z.string().nullable(),
  resume_url: z.string().nullable(),
  github: z.string().nullable(),
  linkedin: z.string().nullable(),
  project_links: z.array(z.string()).nullable(),
  // null when this member has filled nothing in — the full team roster is
  // always returned so judges can see who didn't.
  updated_at: z.number().nullable(),
});

export const StartathonApplicationMemberResponse = z.object({
  success: z.boolean(),
  data: StartathonApplicationMember.optional(),
  error: z.string().optional(),
});

// Advisory link checks. Both always answer 200 when the check itself ran —
// "this link isn't shared" is a result, not a request failure.
export const StartathonLinkCheckRequest = z.object({
  url: z.string().url(),
});

export const StartathonDriveLinkCheckResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      ok: z.boolean(),
      reason: z.enum([
        "ok",
        "unrecognized_url",
        "not_shared",
        "upstream_error",
      ]),
      message: z.string(),
      file_id: z.string().nullable(),
      name: z.string().nullable(),
      mime_type: z.string().nullable(),
      is_folder: z.boolean().nullable(),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonYoutubeLinkCheckResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      ok: z.boolean(),
      reason: z.enum([
        "ok",
        "unrecognized_url",
        "private_or_removed",
        "upstream_error",
      ]),
      message: z.string(),
      video_id: z.string().nullable(),
      title: z.string().nullable(),
      author_name: z.string().nullable(),
      thumbnail_url: z.string().nullable(),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonApplicationResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      team_id: z.string(),
      title: z.string(),
      summary: z.string(),
      problem_evidence: z.string(),
      deck_url: z.string(),
      video_url: z.string(),
      // Both null = never answered, [] = explicitly declared nothing.
      domains: z.array(z.string()).nullable(),
      prior_work: z.array(StartathonPriorWorkEntry).nullable(),
      members: z.array(StartathonApplicationMember),
      created_at: z.number(),
      updated_at: z.number().nullable(),
    })
    .optional(),
  error: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Student-relations calling (TOKEN-guarded staff routes)
// ---------------------------------------------------------------------------

export const StartathonSrCallOutcome = z.enum([
  "reached",
  "no-answer",
  "wrong-number",
  "call-back-later",
]);

// Free-form on purpose: the SR script changes between weeks, and only the
// structure is validated so reshaping the form needs no migration and no
// deploy. Nothing inside is SQL-queryable — `outcome` stays a real column
// so progress tracking never depends on parsing this.
export const StartathonSrFeedbackEntry = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().max(2000),
});

export const StartathonSrCallerRequest = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
});

// No caller_id in any of these: the token identifies the caller, so accepting
// one from the client would just reopen the impersonation hole it closes.
export const StartathonSrClaimRequest = z.object({
  count: z.number().int().min(1).max(25).optional(),
});

export const StartathonSrFeedbackRequest = z.object({
  outcome: StartathonSrCallOutcome,
  feedback: z.array(StartathonSrFeedbackEntry).max(30).default([]),
});

export const StartathonSrUpdateCallerRequest = z.object({
  /** Deactivate someone who's dropped out; their token stops working. */
  active: z.boolean().optional(),
  /** Mint a new token, invalidating the old one. For a lost or shared phone. */
  rotate: z.boolean().optional(),
});

export const StartathonSrMeResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      caller_id: z.string(),
      name: z.string(),
      email: z.string().nullable(),
    })
    .optional(),
  error: z.string().optional(),
});

const StartathonSrContactPerson = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  college: z.string().nullable(),
  role: z.enum(["leader", "member"]),
});

export const StartathonSrContact = z.object({
  team_id: z.string(),
  team_name: z.string(),
  status: z.string(),
  transaction_ref: z.string().nullable(),
  leader: StartathonSrContactPerson.nullable(),
  members: z.array(StartathonSrContactPerson),
  has_application: z.boolean(),
  caller_id: z.string(),
  caller_name: z.string(),
  claimed_at: z.number(),
  outcome: StartathonSrCallOutcome.nullable(),
  feedback: z.array(StartathonSrFeedbackEntry).nullable(),
  called_at: z.number().nullable(),
  updated_at: z.number().nullable(),
  // How many times this team has been rung. Survives re-claiming, so a
  // no-answer team that comes back round carries its history.
  attempts: z.number(),
});

export const StartathonSrContactsResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      claimed: z.number(),
      contacts: z.array(StartathonSrContact),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonSrCallerResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      caller_id: z.string(),
      name: z.string(),
      email: z.string().nullable(),
      created_at: z.number(),
      // Returned ONLY here, at creation and rotation. Never listed, never
      // readable again — if it's lost, rotate rather than look it up.
      token: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export const StartathonSrCallersResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      // Pool-wide totals, so an organiser can see at a glance whether the
      // division is even and how much of the list is still untouched.
      totals: z.object({
        confirmed_teams: z.number(),
        claimed: z.number(),
        called: z.number(),
        unclaimed: z.number(),
      }),
      callers: z.array(
        z.object({
          caller_id: z.string(),
          name: z.string(),
          email: z.string().nullable(),
          active: z.boolean(),
          claimed: z.number(),
          called: z.number(),
          pending: z.number(),
          by_outcome: z.record(z.number()),
          created_at: z.number(),
        }),
      ),
    })
    .optional(),
  error: z.string().optional(),
});
