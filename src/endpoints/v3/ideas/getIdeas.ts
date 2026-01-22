import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse, GetIdeasResponse } from "../../../types";
import { optionalAuth } from "../../../middleware/auth";

/**
 * GET /api/v3/ideas
 * Get list of ideas with pagination, sorted by vote count
 * Public endpoint - authentication optional
 */
export class GetIdeas extends OpenAPIRoute {
  schema = {
    summary: "Get list of event ideas",
    description:
      "Returns paginated list of ideas sorted by vote count (most voted first)",
    request: {
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
        description: "List of ideas retrieved successfully",
        content: {
          "application/json": {
            schema: GetIdeasResponse,
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

      // Get query parameters
      const page = Math.max(1, Number(c.req.query("page")) || 1);
      const limit = Math.min(
        50,
        Math.max(1, Number(c.req.query("limit")) || 20),
      );
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await c.env.GENERAL_DB.prepare(
        "SELECT COUNT(*) as total FROM ideas",
      ).first();
      const total = (countResult?.total as number) || 0;
      const totalPages = Math.ceil(total / limit);

      // Get ideas with vote counts, sorted by vote count descending
      const ideas = await c.env.GENERAL_DB.prepare(
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
         GROUP BY i.id
         ORDER BY vote_count DESC, i.created_at DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(limit, offset)
        .all();

      // If user is authenticated, check which ideas they've voted on
      let userVotes: Set<string> = new Set();
      if (user) {
        const votes = await c.env.GENERAL_DB.prepare(
          `SELECT idea_id FROM idea_votes WHERE user_id = ?`,
        )
          .bind(user.id)
          .all();
        userVotes = new Set(votes.results.map((v: any) => v.idea_id));
      }

      // Format response
      const formattedIdeas = ideas.results.map((idea: any) => ({
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
        ...(user && { has_voted: userVotes.has(idea.id) }),
      }));

      return c.json({
        success: true,
        data: {
          ideas: formattedIdeas,
          total,
          page,
          limit,
          total_pages: totalPages,
        },
      });
    } catch (error) {
      console.error("Get ideas error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
