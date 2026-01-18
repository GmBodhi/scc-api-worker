import { fromHono } from "chanfana";
import { Hono } from "hono";
import { EtlabVerify } from "./etlabVerify";
import { SignupComplete } from "./signupComplete";
import { Login } from "./login";
import { PasskeyRegisterStart } from "./passkeyRegisterStart";
import { PasskeyRegisterVerify } from "./passkeyRegisterVerify";
import { PasskeyLoginStart } from "./passkeyLoginStart";
import { PasskeyLoginVerify } from "./passkeyLoginVerify";
import { GetCurrentUser } from "./getCurrentUser";
import { Logout } from "./logout";
import { GetPasskeys } from "./getPasskeys";
import { DeletePasskey } from "./deletePasskey";
import { RefreshToken } from "./refreshToken";

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
openapi.post("/auth/etlab/verify", EtlabVerify);
openapi.post("/auth/signup/complete", SignupComplete);
openapi.post("/auth/login", Login);
openapi.post("/auth/refresh", RefreshToken);

// Auth routes - Passkey
openapi.post("/auth/passkey/register/start", PasskeyRegisterStart);
openapi.post("/auth/passkey/register/verify", PasskeyRegisterVerify);
openapi.post("/auth/passkey/login/start", PasskeyLoginStart);
openapi.post("/auth/passkey/login/verify", PasskeyLoginVerify);

// Session management
openapi.post("/auth/logout", Logout);
openapi.get("/auth/me", GetCurrentUser);

// Passkey management
openapi.get("/auth/passkeys", GetPasskeys);
openapi.delete("/auth/passkeys/:credential_id", DeletePasskey);

export default openapi;
