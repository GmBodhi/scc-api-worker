import { OpenAPIRoute } from "chanfana";
import { type AppContext, RawTransaction } from "../../../../types";
import { parseTransactionHDFC } from "../../../../services/transaction";

const STARTATHON_FEE = 100;

/**
 * POST /api/v3/events/startathon/transaction
 * Webhook ingest for raw bank SMS. Guarded by the shared TOKEN header.
 * Accepts only ₹100 transactions (flat team fee); stores as 'unused'.
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

    if (!extracted || extracted.amount !== STARTATHON_FEE) {
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
    c.status(201);
    return c.json({ success: true, ref: extracted.upiRef });
  }
}
