import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonLinkCheckRequest,
  StartathonDriveLinkCheckResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";
import { verifyDriveLink } from "../../../../services/linkVerifier";

/**
 * POST /api/v3/events/startathon/links/verify/drive
 * Tells the caller whether a Drive link is readable by an outsider.
 *
 * Advisory only — nothing is stored and no other endpoint consults the
 * result. Meant to be called as the team edits the form so they can fix
 * sharing before submitting, not as a gate on submission.
 */
export class StartathonVerifyDriveLink extends OpenAPIRoute {
  schema = {
    summary: "Check whether a Google Drive link is shared",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonLinkCheckRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description:
          "Check ran. `data.ok` says whether the link is readable; `data.reason` says why not.",
        content: {
          "application/json": {
            schema: StartathonDriveLinkCheckResponse,
          },
        },
      },
      "400": {
        description: "Body is missing or `url` is not a URL",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "500": {
        description: "Internal server error",
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
      const authResult = await requireStartathonAuth(c);
      if (!authResult.success || !authResult.user) {
        return c.json(
          { success: false, error: authResult.error || "Unauthorized" },
          401,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const result = await verifyDriveLink(data.body.url, c.env);

      return c.json({ success: true, data: result });
    } catch (error) {
      return handleEndpointError(
        c,
        error,
        "Startathon verify drive link error:",
      );
    }
  }
}
