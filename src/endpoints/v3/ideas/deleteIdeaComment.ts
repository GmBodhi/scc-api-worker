import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  DeleteCommentResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";
import z from "zod";

/**
 * DELETE /api/v3/ideas/:id/comments/:comment_id
 * Delete own comment from an idea
 */
export class DeleteIdeaComment extends OpenAPIRoute {
  schema = {
    summary: "Delete a comment from an event idea",
    description: "Users can only delete their own comments",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
      id: z.string().describe("Idea ID"),
      comment_id: z.string().describe("Comment ID"),
      }),
    },
    responses: {
      "200": {
      description: "Comment deleted successfully",
      content: {
        "application/json": {
        schema: DeleteCommentResponse,
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
      description: "Forbidden - can only delete own comments",
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

      // Get comment
      const comment = await c.env.GENERAL_DB.prepare(
        "SELECT id, user_id, idea_id FROM idea_comments WHERE id = ? AND idea_id = ?",
      )
        .bind(commentId, ideaId)
        .first();

      if (!comment) {
        return c.json({ success: false, error: "Comment not found" }, 404);
      }

      // Check if user owns the comment
      if (comment.user_id !== user.id) {
        return c.json(
          { success: false, error: "You can only delete your own comments" },
          403,
        );
      }

      // Delete comment
      await c.env.GENERAL_DB.prepare("DELETE FROM idea_comments WHERE id = ?")
        .bind(commentId)
        .run();

      return c.json({
        success: true,
        message: "Comment deleted successfully",
      });
    } catch (error) {
      console.error("Delete comment error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
