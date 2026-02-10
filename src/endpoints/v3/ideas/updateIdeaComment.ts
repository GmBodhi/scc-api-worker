import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  UpdateCommentRequest,
  UpdateCommentResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";
import z from "zod";

/**
 * PATCH /api/v3/ideas/:id/comments/:comment_id
 * Update own comment on an idea
 */
export class UpdateIdeaComment extends OpenAPIRoute {
  schema = {
    summary: "Update a comment on an event idea",
    description: "Users can only update their own comments",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().describe("Idea ID"),
        comment_id: z.string().describe("Comment ID"),
      }),
      body: {
        content: {
          "application/json": {
            schema: UpdateCommentRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Comment updated successfully",
        content: {
          "application/json": {
            schema: UpdateCommentResponse,
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
      "403": {
        description: "Forbidden - can only update own comments",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Comment not found",
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
      const commentId = data.params.comment_id;
      const { comment: newComment } = data.body;

      // Get existing comment
      const existingComment = await c.env.GENERAL_DB.prepare(
        "SELECT id, user_id, idea_id, created_at FROM idea_comments WHERE id = ? AND idea_id = ?",
      )
        .bind(commentId, ideaId)
        .first();

      if (!existingComment) {
        return c.json({ success: false, error: "Comment not found" }, 404);
      }

      // Check if user owns the comment
      if (existingComment.user_id !== user.id) {
        return c.json(
          { success: false, error: "You can only update your own comments" },
          403,
        );
      }

      // Update comment
      const now = Math.floor(Date.now() / 1000);

      await c.env.GENERAL_DB.prepare(
        `UPDATE idea_comments SET comment = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(newComment, now, commentId)
        .run();

      return c.json({
        success: true,
        data: {
          id: commentId,
          idea_id: ideaId,
          user_id: user.id,
          comment: newComment,
          created_at: existingComment.created_at as number,
          updated_at: now,
          author: {
            id: user.id,
            name: user.name,
            profile_photo_url: user.profile_photo_url || null,
            is_verified: user.is_verified || false,
          },
        },
        message: "Comment updated successfully",
      });
    } catch (error) {
      console.error("Update comment error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
