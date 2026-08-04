import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonLinkCheckRequest,
  StartathonYoutubeLinkCheckResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";
import { verifyYoutubeLink } from "../../../../services/linkVerifier";

/**
 * POST /api/v3/events/startathon/links/verify/youtube
 * Tells the caller whether a YouTube link is playable from the link.
 *
 * Advisory only — nothing is stored. Cannot distinguish public from
 * unlisted; both are playable and both come back ok.
 */
export class StartathonVerifyYoutubeLink extends OpenAPIRoute {
  schema = {
    summary: "Check whether a YouTube link is playable",
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
          "Check ran. `data.ok` says whether the video is playable; `data.reason` says why not.",
        content: {
          "application/json": {
            schema: StartathonYoutubeLinkCheckResponse,
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
      const result = await verifyYoutubeLink(data.body.url);

      return c.json({ success: true, data: result });
    } catch (error) {
      return handleEndpointError(
        c,
        error,
        "Startathon verify youtube link error:",
      );
    }
  }
}
