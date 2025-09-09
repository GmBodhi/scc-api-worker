import { OpenAPIRoute } from "chanfana";
import { type AppContext, RawTransaction } from "../types";
import { parseTransaction } from "../services/transaction";

export class TransactionCreate extends OpenAPIRoute {
  schema = {
    summary: "Create a new transaction",
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
        description: "Returns the created task",
        content: {},
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();

    const rawTxn = data.body?.data;

    const auth = c.req.header("authorization");

    if (auth != c.env.TOKEN) return c.status(404);

    const extracted = parseTransaction(rawTxn);

    if (!extracted || extracted.amount !== 50) return c.status(400);

    const res = await c.env.db
      .prepare(
        "INSERT INTO transactions(id, vpa, amount, date, ref, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        Math.random().toString(36).substring(2, 10).toUpperCase(),
        extracted.vpa,
        extracted.amount,
        extracted.date,
        extracted.upiRef,
        "unused",
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();

    console.log(extracted, res);

    return extracted;
  }
}
