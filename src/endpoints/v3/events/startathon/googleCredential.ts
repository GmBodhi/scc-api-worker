import { jwtVerify, createRemoteJWKSet } from "jose";
import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonGoogleCredentialRequest,
  StartathonAuthResponse,
  ErrorResponse,
} from "../../../../types";
import { generateStartathonJWT } from "../../../../utils/startathonJwt";
import { findOrCreateStartathonGoogleUser } from "../../../../utils/startathonGoogleUser";
import { handleEndpointError } from "../../../../utils/errorResponse";

// Created once per isolate — jose caches the fetched key set internally.
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

interface GoogleIdTokenPayload {
  sub: string;
  email: string;
  name: string;
}

/**
 * POST /api/v3/events/startathon/auth/google/credential
 * Verify a Google Identity Services ID token (One Tap / rendered
 * "Sign in with Google" button) and sign-up-or-login — same matching
 * rules as the redirect-flow callback, without leaving the page.
 */
export class StartathonGoogleCredential extends OpenAPIRoute {
  schema = {
    summary: "Sign in with a Google Identity Services credential",
    description:
      "Verifies a Google ID token (from GIS One Tap or the rendered Sign In button) and signs up or logs in, identical semantics to the redirect-flow Google callback.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonGoogleCredentialRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Logged in or signed up",
        content: {
          "application/json": {
            schema: StartathonAuthResponse,
          },
        },
      },
      "400": {
        description: "Invalid or expired credential",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    try {
      const data = await this.getValidatedData<typeof this.schema>();
      const {
        credential,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
      } = data.body;

      const { GOOGLE_CLIENT_ID } = c.env;
      if (!GOOGLE_CLIENT_ID) {
        return c.json(
          { success: false, error: "Google OAuth not configured" },
          500,
        );
      }

      let payload: GoogleIdTokenPayload;
      try {
        const verified = await jwtVerify(credential, GOOGLE_JWKS, {
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          audience: GOOGLE_CLIENT_ID,
        });
        payload = verified.payload as unknown as GoogleIdTokenPayload;
      } catch (error) {
        console.error(
          "Startathon Google credential verification error:",
          error,
        );
        return c.json(
          { success: false, error: "Invalid or expired Google credential" },
          400,
        );
      }

      if (!payload.email) {
        return c.json(
          { success: false, error: "Google account has no email" },
          400,
        );
      }

      const user = await findOrCreateStartathonGoogleUser(
        c.env.EVENTS_DB,
        {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name ?? payload.email,
        },
        { utm_source, utm_medium, utm_campaign, utm_term, utm_content },
      );

      if (!user) {
        return c.json(
          { success: false, error: "Failed to create or retrieve account" },
          500,
        );
      }

      const accessToken = await generateStartathonJWT(
        user.user_id as string,
        user.email as string,
        user.name as string,
        c.env.JWT_SECRET,
      );

      return c.json({
        success: true,
        data: {
          access_token: accessToken,
          expires_in: 7 * 24 * 60 * 60,
          user: {
            user_id: user.user_id as string,
            team_id: (user.team_id as string) || null,
            role: (user.role as string) || null,
            name: user.name as string,
            email: user.email as string,
            phone: (user.phone as string) || null,
            college: (user.college as string) || null,
            gender: (user.gender as string) || null,
          },
        },
      });
    } catch (error) {
      return handleEndpointError(
        c,
        error,
        "Startathon Google credential error:",
      );
    }
  }
}
