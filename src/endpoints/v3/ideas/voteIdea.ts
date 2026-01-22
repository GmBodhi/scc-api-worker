import { OpenAPIRoute } from "chanfana";
import { type AppContext, ErrorResponse, VoteIdeaResponse } from "../../../types";
import { requireAuth } from "../../../middleware/auth";

/**
 * POST /api/v3/ideas/:id/vote
 * Toggle vote on an idea (add if not voted, remove if already voted)
 * Only EtLab verified users can vote
 */
export class VoteIdea extends OpenAPIRoute {
  schema = {
    summary: "Vote on an event idea",
    description:
      "Toggle vote - adds vote if not voted, removes if already voted. Only EtLab verified users can vote.",
    security: [{ bearerAuth: [] }],
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
        description: "Vote toggled successfully",
        content: {
          "application/json": {
            schema: VoteIdeaResponse,
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
        description: "Forbidden - only verified users can vote",
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

      // Check if user is verified
      if (!user.is_verified) {
        return c.json(
          {
            success: false,
            error: "Only EtLab verified users can vote on ideas",
          },
          403,
        );
      }

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

      // Check if user has already voted
      const existingVote = await c.env.GENERAL_DB.prepare(
        "SELECT id FROM idea_votes WHERE idea_id = ? AND user_id = ?",
      )
        .bind(ideaId, user.id)
        .first();

      let voted = false;

      if (existingVote) {
        // Remove vote
        await c.env.GENERAL_DB.prepare("DELETE FROM idea_votes WHERE id = ?")
          .bind(existingVote.id)
          .run();
        voted = false;
      } else {
        // Add vote
        await c.env.GENERAL_DB.prepare(
          `INSERT INTO idea_votes (id, idea_id, user_id, created_at)
           VALUES (?, ?, ?, ?)`,
        )
          .bind(
            crypto.randomUUID(),
            ideaId,
            user.id,
            Math.floor(Date.now() / 1000),
          )
          .run();
        voted = true;
      }

      // Get updated vote count
      const voteCountResult = await c.env.GENERAL_DB.prepare(
        "SELECT COUNT(*) as count FROM idea_votes WHERE idea_id = ?",
      )
        .bind(ideaId)
        .first();

      const voteCount = (voteCountResult?.count as number) || 0;

      return c.json({
        success: true,
        data: {
          voted,
          vote_count: voteCount,
        },
        message: voted
          ? "Vote added successfully"
          : "Vote removed successfully",
      });
    } catch (error) {
      console.error("Vote idea error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
