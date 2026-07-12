import { fromHono } from "chanfana";
import { Hono } from "hono";
// Auth
import { Signup } from "./auth/signup";
import { EtlabVerify } from "./auth/etlabVerify";
import { Login } from "./auth/login";
import { Logout } from "./auth/logout";
import { GetCurrentUser } from "./auth/getCurrentUser";
import { UpdateProfile } from "./auth/updateProfile";
import { RefreshToken } from "./auth/refreshToken";
import { PasswordResetRequest } from "./auth/passwordResetRequest";
import { PasswordResetVerify } from "./auth/passwordResetVerify";
import { PasskeyRegisterStart } from "./auth/passkeyRegisterStart";
import { PasskeyRegisterVerify } from "./auth/passkeyRegisterVerify";
import { PasskeyLoginStart } from "./auth/passkeyLoginStart";
import { PasskeyLoginVerify } from "./auth/passkeyLoginVerify";
import { GetPasskeys } from "./auth/getPasskeys";
import { DeletePasskey } from "./auth/deletePasskey";
import { GoogleOAuthInitiate } from "./auth/googleOauthInitiate";
import { GoogleOAuthCallback } from "./auth/googleOauthCallback";
import { GoogleOAuthDisconnect } from "./auth/googleOauthDisconnect";
// Events
import { EventSignup } from "./events/eventSignup";
import { LinkHackerRankPayment } from "./events/linkHackerRankPayment";
import { McpWorkshopSignup } from "./events/mcpWorkshopSignup";
import { StartathonWaitlist } from "./events/startathonWaitlist";
import { StartathonSignup } from "./events/startathon/signup";
import { StartathonLogin } from "./events/startathon/login";
import { StartathonPasswordResetRequest } from "./events/startathon/passwordResetRequest";
import { StartathonPasswordResetVerify } from "./events/startathon/passwordResetVerify";
import { StartathonCreateTeam } from "./events/startathon/createTeam";
import { StartathonGetTeam } from "./events/startathon/getTeam";
import { StartathonInviteMember } from "./events/startathon/inviteMember";
import { StartathonListInvites } from "./events/startathon/listInvites";
import { StartathonJoinTeam } from "./events/startathon/joinTeam";
import { StartathonTransactionIngest } from "./events/startathon/transactionIngest";
import { StartathonLinkPayment } from "./events/startathon/linkPayment";
import { StartathonGoogleInitiate } from "./events/startathon/googleInitiate";
import { StartathonGoogleCallback } from "./events/startathon/googleCallback";
import { EmailOpen } from "./events/emailOpen";
import { EmailClick } from "./events/emailClick";
// Notifications
import { GetNotifications } from "./notifications/getNotifications";
import { CreateNotification } from "./notifications/createNotification";
import { MarkNotificationRead } from "./notifications/markNotificationRead";
import { MarkAllNotificationsRead } from "./notifications/markAllNotificationsRead";
import { DeleteNotification } from "./notifications/deleteNotification";
// Ideas
import { CreateIdea } from "./ideas/createIdea";
import { GetIdeas } from "./ideas/getIdeas";
import { GetIdea } from "./ideas/getIdea";
import { UpdateIdea } from "./ideas/updateIdea";
import { VoteIdea } from "./ideas/voteIdea";
import { CreateIdeaComment } from "./ideas/createIdeaComment";
import { GetIdeaComments } from "./ideas/getIdeaComments";
import { UpdateIdeaComment } from "./ideas/updateIdeaComment";
import { DeleteIdeaComment } from "./ideas/deleteIdeaComment";

const app = new Hono<{ Bindings: Env }>();

const openapi = fromHono(app, {
  docs_url: "/docs",
  openapi_url: "/openapi.json",
  redoc_url: "/redoc",
  schema: {
    info: {
      title: "SCC API v3",
      version: "3.0.0",
      description:
        "Modern authentication and authorization endpoints with passkey support",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "UUID",
        },
      },
    },
  },
});

// Auth routes - Traditional
openapi.post("/auth/signup", Signup);
openapi.post("/auth/etlab/verify", EtlabVerify);
openapi.post("/auth/login", Login);
openapi.post("/auth/refresh", RefreshToken);

// Google OAuth
openapi.get("/auth/google", GoogleOAuthInitiate);
openapi.get("/auth/google/callback", GoogleOAuthCallback);
openapi.delete("/auth/google", GoogleOAuthDisconnect);

// Password Reset
openapi.post("/auth/password/reset", PasswordResetRequest);
openapi.post("/auth/password/reset/verify", PasswordResetVerify);

// Auth routes - Passkey
openapi.post("/auth/passkey/register/start", PasskeyRegisterStart);
openapi.post("/auth/passkey/register/verify", PasskeyRegisterVerify);
openapi.post("/auth/passkey/login/start", PasskeyLoginStart);
openapi.post("/auth/passkey/login/verify", PasskeyLoginVerify);

// Session management
openapi.post("/auth/logout", Logout);
openapi.get("/auth/me", GetCurrentUser);
openapi.put("/auth/profile", UpdateProfile);

// Passkey management
openapi.get("/auth/passkeys", GetPasskeys);
openapi.delete("/auth/passkeys/:credential_id", DeletePasskey);

// Events
openapi.post("/events/hackerrank_1", EventSignup);
openapi.post("/events/hackerrank_1/payment", LinkHackerRankPayment);
openapi.post("/events/mcp_workshop_1", McpWorkshopSignup);
openapi.post("/events/startathon/waitlist", StartathonWaitlist);

// Startathon (standalone module — startathon.sctcoding.club)
openapi.post("/events/startathon/auth/signup", StartathonSignup);
openapi.post("/events/startathon/team", StartathonCreateTeam);
openapi.post("/events/startathon/auth/login", StartathonLogin);
openapi.post(
  "/events/startathon/auth/password/reset",
  StartathonPasswordResetRequest,
);
openapi.post(
  "/events/startathon/auth/password/reset/verify",
  StartathonPasswordResetVerify,
);
openapi.get("/events/startathon/team", StartathonGetTeam);
openapi.post("/events/startathon/team/invite", StartathonInviteMember);
openapi.get("/events/startathon/invites", StartathonListInvites);
openapi.post("/events/startathon/team/join", StartathonJoinTeam);
openapi.post("/events/startathon/transaction", StartathonTransactionIngest);
openapi.post("/events/startathon/payment", StartathonLinkPayment);
openapi.get("/events/startathon/auth/google", StartathonGoogleInitiate);
openapi.get(
  "/events/startathon/auth/google/callback",
  StartathonGoogleCallback,
);
openapi.get("/events/email/open", EmailOpen);
openapi.get("/events/email/click", EmailClick);

// Notifications
openapi.get("/notifications", GetNotifications);
openapi.post("/notifications", CreateNotification);
openapi.put("/notifications/:id/read", MarkNotificationRead);
openapi.put("/notifications/read-all", MarkAllNotificationsRead);
openapi.delete("/notifications/:id", DeleteNotification);

// Ideas (Host Your Own Events)
openapi.post("/ideas", CreateIdea);
openapi.get("/ideas", GetIdeas);
openapi.get("/ideas/:id", GetIdea);
openapi.patch("/ideas/:id", UpdateIdea);
openapi.post("/ideas/:id/vote", VoteIdea);
openapi.post("/ideas/:id/comments", CreateIdeaComment);
openapi.get("/ideas/:id/comments", GetIdeaComments);
openapi.patch("/ideas/:id/comments/:comment_id", UpdateIdeaComment);
openapi.delete("/ideas/:id/comments/:comment_id", DeleteIdeaComment);

export default openapi;
