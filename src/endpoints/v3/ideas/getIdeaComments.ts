import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  GetCommentsResponse,
} from "../../../types";

/**
 * GET /api/v3/ideas/:id/comments
 * Get comments for an idea with pagination
 * Public endpoint
 */
export class GetIdeaComments extends OpenAPIRoute {
  schema = {
    summary: "Get comments for an event idea",
    description:
      "Returns paginated list of comments sorted by creation date (newest first)",
    request: {
      params: {
        id: {
          type: "string",
          description: "Idea ID",
          required: true,
        },
      },
      query: {
        page: {
          type: "number",
          description: "Page number (starts at 1)",
          default: 1,
        },
        limit: {
          type: "number",
          description: "Number of items per page (max 50)",
          default: 20,
        },
      },
    },
    responses: {
      "200": {
        description: "Comments retrieved successfully",
        content: {
          "application/json": {
            schema: GetCommentsResponse,
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
      const data = await this.getValidatedData<typeof this.schema>();
      const ideaId = data.params.id;

      // Check if idea exists
      const idea = await c.env.GENERAL_DB.prepare(
        "SELECT id FROM ideas WHERE id = ?",
      )
        .bind(ideaId)
        .first();

      if (!idea) {
        return c.json({ success: false, error: "Idea not found" }, 404);
      }

      // Get query parameters
      const page = Math.max(1, Number(c.req.query("page")) || 1);
      const limit = Math.min(
        50,
        Math.max(1, Number(c.req.query("limit")) || 20),
      );
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await c.env.GENERAL_DB.prepare(
        "SELECT COUNT(*) as total FROM idea_comments WHERE idea_id = ?",
      )
        .bind(ideaId)
        .first();
      const total = (countResult?.total as number) || 0;
      const totalPages = Math.ceil(total / limit);

      // Get comments with author information
      const comments = await c.env.GENERAL_DB.prepare(
        `SELECT 
          c.id,
          c.idea_id,
          c.user_id,
          c.comment,
          c.created_at,
          c.updated_at,
          u.name as author_name,
          u.profile_photo_url as author_photo,
          u.is_verified as author_verified
         FROM idea_comments c
         INNER JOIN users u ON c.user_id = u.id
         WHERE c.idea_id = ?
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(ideaId, limit, offset)
        .all();

      // Format response
      const formattedComments = comments.results.map((comment: any) => ({
        id: comment.id,
        idea_id: comment.idea_id,
        user_id: comment.user_id,
        comment: comment.comment,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        author: {
          id: comment.user_id,
          name: comment.author_name,
          profile_photo_url: comment.author_photo || null,
          is_verified: Boolean(comment.author_verified),
        },
      }));

      return c.json({
        success: true,
        data: {
          comments: formattedComments,
          total,
          page,
          limit,
          total_pages: totalPages,
        },
      });
    } catch (error) {
      console.error("Get comments error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
