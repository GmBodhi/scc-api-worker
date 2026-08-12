import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonTransferLeadershipRequest,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";

/**
 * POST /api/v3/events/startathon/team/leader
 * The leader hands the role to an existing member. Allowed at any team
 * status — it moves a role between two people who are both already on
 * the team, so nothing about the payment or the application changes.
 *
 * This is what makes a confirmed team's leader able to leave at all:
 * /team/leave deletes the team when a leader calls it, which is refused
 * once the team has paid, so the exit is hand over, then leave.
 */
export class StartathonTransferLeadership extends OpenAPIRoute {
  schema = {
    summary: "Hand Startathon team leadership to a teammate",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonTransferLeadershipRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Leadership transferred",
        content: {},
      },
      "400": {
        description: "Target is already the leader (i.e. is the caller)",
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
      "403": {
        description: "Only the team leader can transfer leadership",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Caller has no team, or target is not on that team",
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
      const user = authResult.user;

      if (!user.team_id) {
        return c.json({ success: false, error: "You don't have a team" }, 404);
      }
      if (user.role !== "leader") {
        return c.json(
          {
            success: false,
            error: "Only the team leader can transfer leadership",
          },
          403,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { new_leader_id } = data.body;

      if (new_leader_id === user.user_id) {
        return c.json(
          { success: false, error: "You are already the leader" },
          400,
        );
      }

      const target = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, name FROM startathon_users WHERE user_id = ? AND team_id = ? AND role = 'member'",
      )
        .bind(new_leader_id, user.team_id)
        .first();

      if (!target) {
        return c.json(
          { success: false, error: "That user is not a member of your team" },
          404,
        );
      }

      const now = Math.floor(Date.now() / 1000);

      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET role = 'leader' WHERE user_id = ?",
        ).bind(new_leader_id),
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_users SET role = 'member' WHERE user_id = ?",
        ).bind(user.user_id),
        // leader_id is denormalized onto the team row and nothing reads
        // it today (authorization goes through startathon_users.role),
        // but leaving it pointing at the old leader would quietly poison
        // whatever reads it next.
        c.env.EVENTS_DB.prepare(
          "UPDATE startathon_teams SET leader_id = ?, updated_at = ? WHERE team_id = ?",
        ).bind(new_leader_id, now, user.team_id),
      ]);

      console.log("Startathon leadership transferred:", {
        team_id: user.team_id,
        from: user.user_id,
        to: new_leader_id,
      });

      return c.json({
        success: true,
        // name is nullable (invite-created accounts start without one).
        message: `${(target.name as string | null) || "Your teammate"} is now the team leader.`,
      });
    } catch (error) {
      return handleEndpointError(
        c,
        error,
        "Startathon transfer leadership error:",
      );
    }
  }
}
