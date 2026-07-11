import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonRegisterRequest,
  StartathonRegisterResponse,
  ErrorResponse,
} from "../../../../types";
import { EmailService } from "../../../../services/emailService";

/**
 * POST /api/v3/events/startathon/register
 * Register a Startathon team: 1 leader + 2-3 members (public, no auth).
 * Creates startathon accounts for every participant and emails each a
 * set-password link. Team starts as 'payment-pending'.
 */
export class StartathonRegister extends OpenAPIRoute {
  schema = {
    summary: "Register a Startathon team",
    description:
      "Register a team of 1 leader + 2-3 members. Every participant gets a Startathon account and a set-password email. Team fee is ₹100, payable by the leader after registration.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonRegisterRequest,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Team registered",
        content: {
          "application/json": {
            schema: StartathonRegisterResponse,
          },
        },
      },
      "400": {
        description: "Validation error (member count, duplicate emails in payload)",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "409": {
        description: "Team name taken or email already on a team",
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
      const { team_name, leader, members } = data.body;

      const emails = [leader.email, ...members.map((m) => m.email)].map((e) =>
        e.toLowerCase(),
      );
      if (new Set(emails).size !== emails.length) {
        return c.json(
          { success: false, error: "Duplicate emails in the team" },
          400,
        );
      }

      const existingTeam = await c.env.EVENTS_DB.prepare(
        "SELECT team_id FROM startathon_teams WHERE team_name = ?",
      )
        .bind(team_name)
        .first();
      if (existingTeam) {
        return c.json(
          { success: false, error: "Team name is already taken" },
          409,
        );
      }

      const placeholders = emails.map(() => "?").join(", ");
      const existingUser = await c.env.EVENTS_DB.prepare(
        `SELECT email FROM startathon_users WHERE email IN (${placeholders})`,
      )
        .bind(...emails)
        .first();
      if (existingUser) {
        return c.json(
          {
            success: false,
            error: `${existingUser.email} is already registered on a team`,
          },
          409,
        );
      }

      const now = Math.floor(Date.now() / 1000);
      const rand = () =>
        Math.random().toString(36).substring(2, 8).toUpperCase();
      const teamId = `ST_${Date.now()}_${rand()}`;

      const participants = [
        { ...leader, role: "leader" as const },
        ...members.map((m) => ({ ...m, role: "member" as const })),
      ].map((p) => ({
        ...p,
        user_id: `STU_${Date.now()}_${rand()}`,
        email: p.email.toLowerCase(),
      }));

      const leaderId = participants[0].user_id;

      // Team + all users in one atomic batch — no partial teams
      await c.env.EVENTS_DB.batch([
        c.env.EVENTS_DB.prepare(
          `INSERT INTO startathon_teams (team_id, team_name, leader_id, status, created_at)
           VALUES (?, ?, ?, 'payment-pending', ?)`,
        ).bind(teamId, team_name, leaderId, now),
        ...participants.map((p) =>
          c.env.EVENTS_DB.prepare(
            `INSERT INTO startathon_users (user_id, team_id, role, name, email, phone, college, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            p.user_id,
            teamId,
            p.role,
            p.name,
            p.email,
            p.phone ?? null,
            p.college ?? null,
            now,
          ),
        ),
      ]);

      // Account-setup emails (non-fatal, token valid 7 days)
      const emailService = new EmailService(c.env.BREVO_API_KEY);
      for (const p of participants) {
        try {
          const token = crypto.randomUUID();
          await c.env.EVENTS_DB.prepare(
            `INSERT INTO startathon_reset_tokens (token, user_id, expires_at, created_at)
             VALUES (?, ?, ?, ?)`,
          )
            .bind(token, p.user_id, now + 7 * 24 * 60 * 60, now)
            .run();

          const sent = await emailService.sendStartathonAccountSetupEmail(
            p.name,
            p.email,
            team_name,
            teamId,
            p.role,
            token,
          );
          if (!sent) {
            console.error(`Failed to send setup email to ${p.email}`);
          }
        } catch (emailError) {
          console.error("Startathon setup email error:", emailError);
        }
      }

      console.log("Startathon team registered:", {
        team_id: teamId,
        team_name,
        size: participants.length,
      });

      return c.json(
        {
          success: true,
          data: {
            team_id: teamId,
            team_name,
            status: "payment-pending",
            participants: participants.map((p) => ({
              user_id: p.user_id,
              name: p.name,
              email: p.email,
              role: p.role,
            })),
          },
          message:
            "Team registered. Check your inboxes to set passwords, then complete the ₹100 payment to confirm.",
        },
        201,
      );
    } catch (error) {
      console.error("Startathon register error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
