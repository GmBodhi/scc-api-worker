import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  CreateCommentRequest,
  CreateCommentResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";

/**
 * POST /api/v3/ideas/:id/comments
 * Add a comment to an idea
 */
export class CreateIdeaComment extends OpenAPIRoute {
  schema = {
    summary: "Add a comment to an event idea",
    security: [{ bearerAuth: [] }],
    request: {
      params: {
        id: {
          type: "string",
          description: "Idea ID",
          required: true,
        },
      },
      body: {
        content: {
          "application/json": {
            schema: CreateCommentRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Comment added successfully",
        content: {
          "application/json": {
            schema: CreateCommentResponse,
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
      "404": {
        description: "Idea not found",
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
      const ideaId = data.params.id;
      const { comment } = data.body;

      // Check if idea exists
      const idea = await c.env.GENERAL_DB.prepare(
        "SELECT id FROM ideas WHERE id = ?",
      )
        .bind(ideaId)
        .first();

      if (!idea) {
        return c.json({ success: false, error: "Idea not found" }, 404);
      }

      // Create comment
      const commentId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      await c.env.GENERAL_DB.prepare(
        `INSERT INTO idea_comments (id, idea_id, user_id, comment, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(commentId, ideaId, user.id, comment, now, now)
        .run();

      return c.json({
        success: true,
        data: {
          id: commentId,
          idea_id: ideaId,
          user_id: user.id,
          comment,
          created_at: now,
          updated_at: now,
          author: {
            id: user.id,
            name: user.name,
            profile_photo_url: user.profile_photo_url || null,
            is_verified: user.is_verified || false,
          },
        },
        message: "Comment added successfully",
      });
    } catch (error) {
      console.error("Create comment error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
