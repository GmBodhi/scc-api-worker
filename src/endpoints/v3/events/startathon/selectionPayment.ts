import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonSelectionPaymentRequest,
  ErrorResponse,
  STARTATHON_SELECTION_FEE,
  STARTATHON_TEAM_CAP,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { tryConfirmSelectionPayment } from "../../../../services/startathonSelectionPayments";
import { syncStartathonRosterSheet } from "../../../../services/startathonRosterSheet";
import { handleEndpointError } from "../../../../utils/errorResponse";

/**
 * POST /api/v3/events/startathon/payment/selection
 * File the UPI reference for the ₹250-per-head selection fee.
 *
 * Unlike the ₹100 team fee this is not leader-only: any member of a
 * shortlisted team may file, for themselves or — in one transfer — for
 * teammates too. The reference is accepted on trust and confirmed once the
 * matching bank SMS reaches the ingest webhook, which for a payer who has
 * already transferred is usually immediate.
 */
export class StartathonSelectionPayment extends OpenAPIRoute {
  schema = {
    summary: "File the Startathon selection fee payment",
    description:
      "Any member of a shortlisted team submits the UPI reference of the ₹250-per-head selection fee. One transfer may cover several teammates via `covers`, in which case the amount must be ₹250 × the number of people covered. While the payment is still 'submitted' the payer may call again to correct the reference or change who it covers.",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonSelectionPaymentRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Reference filed (and confirmed, if its payment landed)",
        content: {},
      },
      "400": {
        description: "Reference already filed, or covers not on your team",
        content: {
          "application/json": { schema: ErrorResponse },
        },
      },
      "401": {
        description: "Unauthorized",
        content: {
          "application/json": { schema: ErrorResponse },
        },
      },
      "403": {
        description: "Team is not shortlisted",
        content: {
          "application/json": { schema: ErrorResponse },
        },
      },
      "404": {
        description: "Caller has no team",
        content: {
          "application/json": { schema: ErrorResponse },
        },
      },
      "409": {
        description:
          "Already confirmed, or a covered member is already paid for",
        content: {
          "application/json": { schema: ErrorResponse },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": { schema: ErrorResponse },
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

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT team_id, shortlist_status FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }

      if (team.shortlist_status !== "shortlisted") {
        return c.json(
          {
            success: false,
            error: "Your team isn't shortlisted, so there's nothing to pay yet",
          },
          403,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const transactionId = data.body.transaction_id.trim();

      // Deduplicated: a repeated id would make the amount disagree with the
      // number of people actually covered.
      const covers = [...new Set(data.body.covers ?? [user.user_id])];
      if (covers.length > STARTATHON_TEAM_CAP) {
        return c.json(
          {
            success: false,
            error: `A payment can cover at most ${STARTATHON_TEAM_CAP} people`,
          },
          400,
        );
      }

      const roster = await c.env.EVENTS_DB.prepare(
        "SELECT user_id, name FROM startathon_users WHERE team_id = ?",
      )
        .bind(user.team_id)
        .all();

      const names = new Map(
        roster.results.map((m) => [m.user_id as string, m.name as string]),
      );
      // The one state in which there is genuinely nothing to pay: every seat on
      // the team is settled. Checked at team level rather than per payer,
      // because whose money settled a seat is irrelevant — a leader may have
      // covered everyone in one transfer.
      //
      // Only 'confirmed' counts. A merely submitted reference is unverified,
      // and if it never matches a transaction that seat is still owed.
      const unpaid = await c.env.EVENTS_DB.prepare(
        `SELECT COUNT(*) AS n
         FROM startathon_users u
         WHERE u.team_id = ?
           AND NOT EXISTS (
             SELECT 1
             FROM startathon_selection_payment_covers cv
             JOIN startathon_selection_payments p ON p.payment_id = cv.payment_id
             WHERE cv.user_id = u.user_id AND p.status = 'confirmed'
           )`,
      )
        .bind(user.team_id)
        .first();

      if (((unpaid?.n as number) ?? 0) === 0) {
        return c.json(
          {
            success: false,
            error:
              "Everyone on your team is already paid for. There's nothing left to pay.",
          },
          409,
        );
      }

      const strangers = covers.filter((id) => !names.has(id));
      if (strangers.length > 0) {
        return c.json(
          {
            success: false,
            error: "You can only pay for people on your own team",
          },
          400,
        );
      }

      const amount = STARTATHON_SELECTION_FEE * covers.length;

      // Which payment this call writes to.
      //
      // A payer legitimately holds more than one: paying a teammate's ₹250 and
      // later your own is two transfers, not an edit of one. So a confirmed
      // payment never blocks a new call — the only things that block are a
      // reference already filed and a member already covered.
      const existing = await this.resolveTarget(
        c,
        user.user_id,
        covers,
        data.body.payment_id,
      );

      if ("error" in existing) {
        return c.json(
          { success: false, error: existing.error },
          existing.status,
        );
      }

      const paymentId =
        existing.payment?.payment_id ??
        `SP_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

      // Someone is already paying for one of these people. Checked here so the
      // answer can name them, rather than surfacing as a bare constraint
      // failure from the unique index that backs the same rule.
      const placeholders = covers.map(() => "?").join(", ");
      const taken = await c.env.EVENTS_DB.prepare(
        `SELECT cv.user_id, p.payer_user_id, p.payment_id
         FROM startathon_selection_payment_covers cv
         JOIN startathon_selection_payments p ON p.payment_id = cv.payment_id
         WHERE cv.user_id IN (${placeholders}) AND cv.payment_id != ?`,
      )
        .bind(...covers, paymentId)
        .all();

      if (taken.results.length > 0) {
        const who = taken.results
          .map((r) => names.get(r.user_id as string) ?? (r.user_id as string))
          .join(", ");

        // Distinguishing the two cases matters: told "someone else paid", a
        // payer looking at their own earlier transfer has no idea what to do
        // next. Told which payment it was, they can edit that one instead.
        const mine = taken.results.every(
          (r) => r.payer_user_id === user.user_id,
        );
        const otherId = taken.results[0].payment_id as string;

        return c.json(
          {
            success: false,
            error: mine
              ? `You already have a payment covering ${who}. Send its payment_id (${otherId}) to change it, or drop them from this one.`
              : `Already paid for by someone else: ${who}. Drop them from this payment.`,
          },
          409,
        );
      }

      const refOwner = await c.env.EVENTS_DB.prepare(
        "SELECT payment_id FROM startathon_selection_payments WHERE transaction_ref = ?",
      )
        .bind(transactionId)
        .first();

      if (refOwner && refOwner.payment_id !== paymentId) {
        return c.json(
          {
            success: false,
            error: "That transaction reference has already been submitted",
          },
          400,
        );
      }

      const now = Math.floor(Date.now() / 1000);

      // Every statement of an edit is conditioned on the payment still being
      // 'submitted', so that a confirmation landing mid-request (the matcher
      // runs from the webhook and the sweep too) makes the whole edit a no-op
      // instead of rewriting who a confirmed transfer paid for.
      const stillOpen =
        "EXISTS (SELECT 1 FROM startathon_selection_payments WHERE payment_id = ? AND status = 'submitted')";

      const statements = existing.payment
        ? [
            c.env.EVENTS_DB.prepare(
              "UPDATE startathon_selection_payments SET transaction_ref = ?, amount = ?, submitted_at = ?, updated_at = ? WHERE payment_id = ? AND status = 'submitted'",
            ).bind(transactionId, amount, now, now, paymentId),
            c.env.EVENTS_DB.prepare(
              `DELETE FROM startathon_selection_payment_covers WHERE payment_id = ? AND ${stillOpen}`,
            ).bind(paymentId, paymentId),
          ]
        : [
            c.env.EVENTS_DB.prepare(
              "INSERT INTO startathon_selection_payments (payment_id, team_id, payer_user_id, transaction_ref, amount, status, submitted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?)",
            ).bind(
              paymentId,
              user.team_id,
              user.user_id,
              transactionId,
              amount,
              now,
              now,
              now,
            ),
          ];

      for (const coveredId of covers) {
        statements.push(
          existing.payment
            ? c.env.EVENTS_DB.prepare(
                `INSERT INTO startathon_selection_payment_covers (payment_id, user_id) SELECT ?, ? WHERE ${stillOpen}`,
              ).bind(paymentId, coveredId, paymentId)
            : c.env.EVENTS_DB.prepare(
                "INSERT INTO startathon_selection_payment_covers (payment_id, user_id) VALUES (?, ?)",
              ).bind(paymentId, coveredId),
        );
      }

      let results;
      try {
        results = await c.env.EVENTS_DB.batch(statements);
      } catch (writeError) {
        // The unique indexes on transaction_ref and covers.user_id: another
        // payer filed the same reference, or claimed one of these people,
        // between the checks above and this write.
        console.error(
          "Startathon selection payment write conflict:",
          writeError,
        );
        return c.json(
          {
            success: false,
            error:
              "That reference or one of those members was just taken by another payment. Reload and try again.",
          },
          409,
        );
      }

      if (existing.payment && results[0].meta.changes !== 1) {
        // The guard above fired: confirmation beat this edit, and nothing was
        // written. Same answer as if it had been confirmed before the call.
        return c.json(
          {
            success: false,
            error:
              "Your payment was confirmed while you were editing it. Reload to see it.",
          },
          409,
        );
      }

      // The payer who transferred before filing: their SMS is already in, so
      // they get 'confirmed' now instead of waiting for the sweep.
      const confirmed = await tryConfirmSelectionPayment(c.env.EVENTS_DB, {
        payment_id: paymentId,
        transaction_ref: transactionId,
        amount,
      });

      // Push the new state to the organisers' sheet without making the payer
      // wait for Google. Confirmations that arrive later — from the webhook or
      // the sweep — are picked up by the half-hourly sync instead.
      c.executionCtx?.waitUntil(
        syncStartathonRosterSheet(c.env).catch((error) =>
          console.error("Startathon roster sheet sync error:", error),
        ),
      );

      console.log("Startathon selection payment filed:", {
        payment_id: paymentId,
        team_id: user.team_id,
        payer: user.user_id,
        ref: transactionId,
        amount,
        covers: covers.length,
        confirmed,
      });

      return c.json({
        success: true,
        data: {
          payment_id: paymentId,
          status: confirmed ? "confirmed" : "submitted",
          transaction_ref: transactionId,
          amount,
          covers,
        },
      });
    } catch (error) {
      return handleEndpointError(
        c,
        error,
        "Startathon selection payment error:",
      );
    }
  }

  /**
   * Decides whether this call edits an existing payment or opens a new one.
   *
   * `payment_id` is the explicit form and always wins. Without it, the call is
   * treated as a correction only when the caller has exactly one open payment
   * covering exactly the same people — the "I mistyped the reference" case.
   * Anything else opens a new payment, because silently rewriting an open one
   * would discard a reference the payer may well have actually paid.
   */
  private async resolveTarget(
    c: AppContext,
    userId: string,
    covers: string[],
    requestedPaymentId?: string,
  ): Promise<
    | { payment: { payment_id: string } | null }
    | { error: string; status: 404 | 409 }
  > {
    if (requestedPaymentId) {
      const row = await c.env.EVENTS_DB.prepare(
        "SELECT payment_id, status, payer_user_id FROM startathon_selection_payments WHERE payment_id = ?",
      )
        .bind(requestedPaymentId)
        .first();

      // Same answer for "no such payment" and "not yours": a payment_id is
      // guessable, and confirming that someone else's exists tells a caller
      // something they have no business knowing.
      if (!row || row.payer_user_id !== userId) {
        return { error: "You have no payment with that id", status: 404 };
      }

      if (row.status === "confirmed") {
        return {
          error:
            "That payment is already confirmed and can't be changed. Contact us if something looks wrong.",
          status: 409,
        };
      }

      return { payment: { payment_id: row.payment_id as string } };
    }

    const open = await c.env.EVENTS_DB.prepare(
      "SELECT payment_id FROM startathon_selection_payments WHERE payer_user_id = ? AND status = 'submitted'",
    )
      .bind(userId)
      .all();

    if (open.results.length !== 1) {
      return { payment: null };
    }

    const openId = open.results[0].payment_id as string;

    const covered = await c.env.EVENTS_DB.prepare(
      "SELECT user_id FROM startathon_selection_payment_covers WHERE payment_id = ?",
    )
      .bind(openId)
      .all();

    const existingCovers = covered.results.map((r) => r.user_id as string);
    const sameCovers =
      existingCovers.length === covers.length &&
      existingCovers.every((id) => covers.includes(id));

    return sameCovers ? { payment: { payment_id: openId } } : { payment: null };
  }
}
