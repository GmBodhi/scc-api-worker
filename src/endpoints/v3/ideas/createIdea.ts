import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  CreateIdeaRequest,
  CreateIdeaResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";

/**
 * POST /api/v3/ideas
 * Create a new event idea
 */
export class CreateIdea extends OpenAPIRoute {
  schema = {
    summary: "Create a new event idea",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateIdeaRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Idea created successfully",
        content: {
          "application/json": {
            schema: CreateIdeaResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized - authentication required",
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
      // Authenticate user
      const authContext = await requireAuth(c);
      const user = authContext?.user;

      if (!user) {
        return c.json(
          { success: false, error: "Authentication required" },
          401,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { title, description } = data.body;

      // Create idea
      const ideaId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      await c.env.GENERAL_DB.prepare(
        `INSERT INTO ideas (id, user_id, title, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(ideaId, user.id, title, description, now, now)
        .run();

      // Return created idea with author info
      return c.json({
        success: true,
        data: {
          id: ideaId,
          user_id: user.id,
          title,
          description,
          created_at: now,
          updated_at: now,
          author: {
            id: user.id,
            name: user.name,
            profile_photo_url: user.profile_photo_url || null,
            is_verified: user.is_verified || false,
          },
          vote_count: 0,
          comment_count: 0,
          has_voted: false,
        },
        message: "Idea created successfully",
      });
    } catch (error) {
      console.error("Create idea error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
