import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  UpdateIdeaRequest,
  UpdateIdeaResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";
import z from "zod";

/**
 * PATCH /api/v3/ideas/:id
 * Update own idea (title and/or description)
 */
export class UpdateIdea extends OpenAPIRoute {
  schema = {
    summary: "Update an event idea",
    description: "Users can only update their own ideas. Partial updates supported.",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().min(1, "Idea ID is required"),
      }),
      body: {
        content: {
          "application/json": {
            schema: UpdateIdeaRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Idea updated successfully",
        content: {
          "application/json": {
            schema: UpdateIdeaResponse,
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
        description: "Forbidden - can only update own ideas",
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
      const { title, description } = data.body;

      // Get existing idea
      const existingIdea = await c.env.GENERAL_DB.prepare(
        "SELECT id, user_id, title, description, created_at FROM ideas WHERE id = ?",
      )
        .bind(ideaId)
        .first();

      if (!existingIdea) {
        return c.json({ success: false, error: "Idea not found" }, 404);
      }

      // Check if user owns the idea
      if (existingIdea.user_id !== user.id) {
        return c.json(
          { success: false, error: "You can only update your own ideas" },
          403,
        );
      }

      // Build update query
      const now = Math.floor(Date.now() / 1000);
      const newTitle = title ?? existingIdea.title;
      const newDescription = description ?? existingIdea.description;

      await c.env.GENERAL_DB.prepare(
        `UPDATE ideas SET title = ?, description = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(newTitle, newDescription, now, ideaId)
        .run();

      // Get vote and comment counts
      const countsResult = await c.env.GENERAL_DB.prepare(
        `SELECT
          (SELECT COUNT(*) FROM idea_votes WHERE idea_id = ?) as vote_count,
          (SELECT COUNT(*) FROM idea_comments WHERE idea_id = ?) as comment_count`,
      )
        .bind(ideaId, ideaId)
        .first();

      return c.json({
        success: true,
        data: {
          id: ideaId,
          user_id: user.id,
          title: newTitle,
          description: newDescription,
          created_at: existingIdea.created_at as number,
          updated_at: now,
          author: {
            id: user.id,
            name: user.name,
            profile_photo_url: user.profile_photo_url || null,
            is_verified: user.is_verified || false,
          },
          vote_count: (countsResult?.vote_count as number) || 0,
          comment_count: (countsResult?.comment_count as number) || 0,
          has_voted: false, // User's own idea
        },
        message: "Idea updated successfully",
      });
    } catch (error) {
      console.error("Update idea error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
