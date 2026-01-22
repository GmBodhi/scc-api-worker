import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse, GetIdeaResponse } from "../../../types";
import { optionalAuth } from "../../../middleware/auth";

/**
 * GET /api/v3/ideas/:id
 * Get single idea by ID
 * Public endpoint - authentication optional
 */
export class GetIdea extends OpenAPIRoute {
  schema = {
    summary: "Get a single event idea by ID",
    request: {
      params: {
        id: {
          type: "string",
          description: "Idea ID",
          required: true,
        },
      },
    },
    responses: {
      "200": {
        description: "Idea retrieved successfully",
        content: {
          "application/json": {
            schema: GetIdeaResponse,
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
      // Optional authentication - to show if user has voted
      const user = await optionalAuth(c);

      const data = await this.getValidatedData<typeof this.schema>();
      const ideaId = data.params.id;

      // Get idea with vote and comment counts
      const idea = await c.env.GENERAL_DB.prepare(
        `SELECT 
          i.id,
          i.user_id,
          i.title,
          i.description,
          i.created_at,
          i.updated_at,
          u.name as author_name,
          u.profile_photo_url as author_photo,
          u.is_verified as author_verified,
          COUNT(DISTINCT v.id) as vote_count,
          COUNT(DISTINCT c.id) as comment_count
         FROM ideas i
         INNER JOIN users u ON i.user_id = u.id
         LEFT JOIN idea_votes v ON i.id = v.idea_id
         LEFT JOIN idea_comments c ON i.id = c.idea_id
         WHERE i.id = ?
         GROUP BY i.id`,
      )
        .bind(ideaId)
        .first();

      if (!idea) {
        return c.json({ success: false, error: "Idea not found" }, 404);
      }

      // Check if user has voted
      let hasVoted = false;
      if (user) {
        const vote = await c.env.GENERAL_DB.prepare(
          "SELECT id FROM idea_votes WHERE idea_id = ? AND user_id = ?",
        )
          .bind(ideaId, user.id)
          .first();
        hasVoted = !!vote;
      }

      return c.json({
        success: true,
        data: {
          id: idea.id,
          user_id: idea.user_id,
          title: idea.title,
          description: idea.description,
          created_at: idea.created_at,
          updated_at: idea.updated_at,
          author: {
            id: idea.user_id,
            name: idea.author_name,
            profile_photo_url: idea.author_photo || null,
            is_verified: Boolean(idea.author_verified),
          },
          vote_count: idea.vote_count || 0,
          comment_count: idea.comment_count || 0,
          ...(user && { has_voted: hasVoted }),
        },
      });
    } catch (error) {
      console.error("Get idea error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
