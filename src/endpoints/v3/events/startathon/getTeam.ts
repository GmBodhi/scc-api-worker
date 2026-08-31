import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonTeamResponse,
  ErrorResponse,
  STARTATHON_TEAM_FEE,
  STARTATHON_TEAM_REFERRAL_FEE,
  STARTATHON_SELECTION_FEE,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";

/**
 * GET /api/v3/events/startathon/team
 * Get the authenticated user's team, members, and payment status.
 * 404 if the caller has no team yet.
 */
export class StartathonGetTeam extends OpenAPIRoute {
  schema = {
    summary: "Get my Startathon team",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Team details",
        content: {
          "application/json": {
            schema: StartathonTeamResponse,
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
      "404": {
        description: "Caller has no team yet",
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

      if (!user.team_id || !user.role) {
        return c.json(
          { success: false, error: "You don't have a team yet" },
          404,
        );
      }

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }

      // LEFT JOIN through the cover rows so a member nobody has paid for comes
      // back with nulls rather than being missing: absent means unpaid, which
      // is a state the client renders, not an error.
      const members = await c.env.EVENTS_DB.prepare(
        `SELECT u.user_id, u.name, u.email, u.role,
                p.status AS selection_payment_status,
                p.transaction_ref AS selection_transaction_ref,
                p.payer_user_id AS selection_paid_by
         FROM startathon_users u
         LEFT JOIN startathon_selection_payment_covers cv ON cv.user_id = u.user_id
         LEFT JOIN startathon_selection_payments p ON p.payment_id = cv.payment_id
         WHERE u.team_id = ?
         ORDER BY CASE u.role WHEN 'leader' THEN 0 ELSE 1 END, u.name`,
      )
        .bind(user.team_id)
        .all();

      const invites = await c.env.EVENTS_DB.prepare(
        "SELECT invite_id, invited_email, status, created_at FROM startathon_invites WHERE team_id = ? AND status = 'pending' ORDER BY created_at DESC",
      )
        .bind(user.team_id)
        .all();

      // The caller's own selection payments, newest first. A payer can hold
      // several — their own share and a teammate's are separate transfers — so
      // the client needs the ids to say which one an edit targets.
      const myPayments = await c.env.EVENTS_DB.prepare(
        `SELECT p.payment_id, p.transaction_ref, p.amount, p.status,
                p.submitted_at, p.confirmed_at, p.created_at, p.updated_at,
                (SELECT GROUP_CONCAT(cv.user_id)
                 FROM startathon_selection_payment_covers cv
                 WHERE cv.payment_id = p.payment_id) AS covers
         FROM startathon_selection_payments p
         WHERE p.payer_user_id = ?
         ORDER BY p.submitted_at DESC`,
      )
        .bind(user.user_id)
        .all();

      let referralCount: number | null = null;
      if (user.role === "leader") {
        const countRow = await c.env.EVENTS_DB.prepare(
          "SELECT COUNT(*) as cnt FROM startathon_teams WHERE referred_by = ? AND status = 'confirmed'",
        )
          .bind(user.team_id)
          .first();
        referralCount = (countRow?.cnt as number) ?? 0;
      }

      return c.json({
        success: true,
        data: {
          team_id: team.team_id as string,
          team_name: team.team_name as string,
          join_code: team.join_code as string,
          referral_code: team.referral_code as string,
          referred_by: (team.referred_by as string) || null,
          expected_fee: team.referred_by
            ? STARTATHON_TEAM_REFERRAL_FEE
            : STARTATHON_TEAM_FEE,
          referral_count: referralCount,
          // Shortlisting is a second axis from payment status, held in its own
          // column so the SR pool and the application gate keep reading
          // 'confirmed'. Flattened to one field here because that is all the
          // client needs: 'selected' is what unlocks the selection fee, and a
          // waitlisted team reads as an ordinary confirmed team until promoted.
          status:
            team.shortlist_status === "shortlisted"
              ? "selected"
              : (team.status as string),
          shortlist_status: (team.shortlist_status as string) || null,
          selection_fee: STARTATHON_SELECTION_FEE,
          transaction_ref: (team.transaction_ref as string) || null,
          created_at: team.created_at as number,
          your_role: user.role,
          members: members.results.map((m) => ({
            user_id: m.user_id as string,
            name: m.name as string,
            email: m.email as string,
            role: m.role as string,
            selection_payment_status:
              (m.selection_payment_status as string | null) ?? null,
            selection_transaction_ref:
              (m.selection_transaction_ref as string | null) ?? null,
            selection_paid_by: (m.selection_paid_by as string | null) ?? null,
          })),
          my_selection_payments: myPayments.results.map((p) => ({
            payment_id: p.payment_id as string,
            transaction_ref: p.transaction_ref as string,
            amount: p.amount as number,
            status: p.status as string,
            // submitted_at moves when the payer corrects the reference;
            // created_at never does. confirmed_at is null until the matcher
            // finds the transaction.
            submitted_at: p.submitted_at as number,
            confirmed_at: (p.confirmed_at as number | null) ?? null,
            created_at: (p.created_at as number | null) ?? null,
            updated_at: (p.updated_at as number | null) ?? null,
            covers: ((p.covers as string | null) ?? "")
              .split(",")
              .filter((id) => id.length > 0),
          })),
          invites: invites.results.map((i) => ({
            invite_id: i.invite_id as string,
            email: i.invited_email as string,
            status: i.status as string,
            created_at: i.created_at as number,
          })),
        },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon get team error:");
    }
  }
}
