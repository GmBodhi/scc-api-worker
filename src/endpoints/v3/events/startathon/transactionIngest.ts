import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  RawTransaction,
  STARTATHON_SELECTION_AMOUNTS,
  STARTATHON_TEAM_FEE,
  STARTATHON_TEAM_REFERRAL_FEE,
} from "../../../../types";
import { parseTransactionHDFC } from "../../../../services/transaction";
import { confirmSelectionPaymentForRef } from "../../../../services/startathonSelectionPayments";

/**
 * POST /api/v3/events/startathon/transaction
 * Webhook ingest for raw bank SMS. Guarded by the shared TOKEN header.
 *
 * Accepts the ₹100 flat team fee, the ₹90 referral price, and the selection
 * fee at ₹250 per head up to a full team of four. The two fee scales never
 * collide, so a reference stored here can only ever be spent as the kind of
 * payment its amount says it is.
 *
 * Stored as 'unused', then claimed by whichever endpoint links it. For a
 * selection payment the link usually already exists — the participant files
 * their reference the moment they pay, and the SMS follows — so this handler
 * confirms it on the spot rather than leaving it to the sweep.
 */
export class StartathonTransactionIngest extends OpenAPIRoute {
  schema = {
    summary: "Ingest a Startathon payment transaction (webhook)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: RawTransaction,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Transaction stored",
        content: {},
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const rawTxn = data.body?.data;

    const auth = c.req.header("Authorization");
    if (auth != c.env.TOKEN) {
      c.status(404);
      return c.json({ error: "Not found" });
    }

    const extracted = parseTransactionHDFC(rawTxn);

    const acceptedAmounts = [
      1,
      STARTATHON_TEAM_REFERRAL_FEE,
      STARTATHON_TEAM_FEE,
      ...STARTATHON_SELECTION_AMOUNTS,
    ];

    if (!extracted || !acceptedAmounts.includes(extracted.amount)) {
      c.status(400);
      return c.json({ error: "Invalid transaction data" });
    }

    const res = await c.env.EVENTS_DB.prepare(
      "INSERT INTO startathon_transactions (id, vpa, amount, date, ref, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        Math.random().toString(36).substring(2, 10).toUpperCase(),
        extracted.vpa,
        extracted.amount,
        extracted.date,
        extracted.upiRef,
        "unused",
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run()
      .catch((e: Error) => ({ error: true, details: e.message }));

    if ("error" in res) {
      // Most likely the UNIQUE(ref) constraint — duplicate SMS delivery
      console.error("Startathon transaction insert error:", res);
      c.status(400);
      return c.json({ error: "Duplicate or invalid transaction" });
    }

    console.log("Startathon transaction stored:", extracted);

    // Non-fatal: the five-minute sweep picks up anything this misses, and a
    // failure here must not make the webhook retry a transaction already
    // stored.
    if (STARTATHON_SELECTION_AMOUNTS.includes(extracted.amount)) {
      try {
        await confirmSelectionPaymentForRef(c.env.EVENTS_DB, extracted.upiRef);
      } catch (matchError) {
        console.error("Startathon selection match error:", matchError);
      }
    }

    c.status(201);
    return c.json({ success: true, ref: extracted.upiRef });
  }
}
