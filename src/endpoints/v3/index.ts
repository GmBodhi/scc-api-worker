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
import { VoteIdea } from "./ideas/voteIdea";
import { CreateIdeaComment } from "./ideas/createIdeaComment";
import { GetIdeaComments } from "./ideas/getIdeaComments";
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
openapi.post("/ideas/:id/vote", VoteIdea);
openapi.post("/ideas/:id/comments", CreateIdeaComment);
openapi.get("/ideas/:id/comments", GetIdeaComments);
openapi.delete("/ideas/:id/comments/:comment_id", DeleteIdeaComment);

export default openapi;
