import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonInviteRequest,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { EmailService } from "../../../../services/emailService";

const TEAM_CAP = 4;

/**
 * POST /api/v3/events/startathon/team/invite
 * Leader invites someone by email. If no account exists for that
 * email, one is created (still teamless — not a member until they
 * accept). Either way, a pending invite is created and an email sent.
 */
export class StartathonInviteMember extends OpenAPIRoute {
  schema = {
    summary: "Invite someone to my Startathon team",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonInviteRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Invite created",
        content: {},
      },
      "400": {
        description: "Team full, or name missing for a new invitee",
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
        description: "Only the team leader can invite",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "You don't have a team yet",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Invitee already on a team or already invited",
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
        return c.json(
          { success: false, error: "You don't have a team yet" },
          404,
        );
      }
      if (user.role !== "leader") {
        return c.json(
          { success: false, error: "Only the team leader can invite" },
          403,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { email, name } = data.body;
      const normalizedEmail = email.toLowerCase();

      const countResult = await c.env.EVENTS_DB.prepare(
        "SELECT COUNT(*) as cnt FROM startathon_users WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();
      if ((countResult?.cnt as number) >= TEAM_CAP) {
        return c.json({ success: false, error: "Team is full" }, 400);
      }

      let invitee = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_users WHERE email = ?",
      )
        .bind(normalizedEmail)
        .first();

      const now = Math.floor(Date.now() / 1000);
      let isNewAccount = false;

      if (!invitee) {
        if (!name) {
          return c.json(
            { success: false, error: "name required for new invitee" },
            400,
          );
        }
        isNewAccount = true;
        const newUserId = `STU_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

        await c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_users (user_id, name, email, created_at)
           VALUES (?, ?, ?, ?)`,
        )
          .bind(newUserId, name, normalizedEmail, now)
          .run();

        invitee = await c.env.EVENTS_DB.prepare(
          "SELECT * FROM startathon_users WHERE user_id = ?",
        )
          .bind(newUserId)
          .first();
      } else if (invitee.team_id) {
        return c.json(
          { success: false, error: "This person is already on a team" },
          409,
        );
      } else {
        const existingInvite = await c.env.EVENTS_DB.prepare(
          "SELECT invite_id FROM startathon_invites WHERE team_id = ? AND invited_email = ? AND status = 'pending'",
        )
          .bind(user.team_id, normalizedEmail)
          .first();
        if (existingInvite) {
          return c.json(
            { success: false, error: "This person is already invited" },
            409,
          );
        }
      }

      if (!invitee) {
        return c.json(
          { success: false, error: "Internal server error" },
          500,
        );
      }

      const inviteId = `INV_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      await c.env.EVENTS_DB.prepare(
        `INSERT INTO startathon_invites (invite_id, team_id, invited_email, invited_by, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      )
        .bind(inviteId, user.team_id, normalizedEmail, user.user_id, now)
        .run();

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT team_name FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();
      const teamName = (team?.team_name as string) || "";

      try {
        const emailService = new EmailService(c.env.BREVO_API_KEY);
        if (isNewAccount) {
          const resetToken = crypto.randomUUID();
          await c.env.EVENTS_DB.prepare(
            `INSERT INTO startathon_reset_tokens (token, user_id, expires_at, created_at)
             VALUES (?, ?, ?, ?)`,
          )
            .bind(resetToken, invitee.user_id, now + 7 * 24 * 60 * 60, now)
            .run();

          await emailService.sendStartathonAccountSetupInviteEmail(
            invitee.name as string,
            invitee.email as string,
            teamName,
            user.name,
            resetToken,
          );
        } else {
          await emailService.sendStartathonInviteReceivedEmail(
            invitee.name as string,
            invitee.email as string,
            teamName,
            user.name,
          );
        }
      } catch (emailError) {
        console.error("Startathon invite email error:", emailError);
      }

      console.log("Startathon invite created:", {
        invite_id: inviteId,
        team_id: user.team_id,
        invited_email: normalizedEmail,
      });

      return c.json(
        {
          success: true,
          data: { invite_id: inviteId },
          message: "Invite sent.",
        },
        201,
      );
    } catch (error) {
      console.error("Startathon invite error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
