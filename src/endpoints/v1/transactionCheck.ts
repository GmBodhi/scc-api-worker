import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  RawTransaction,
  TransactionCheckResponse,
  ErrorResponse,
} from "../../types";
import {
  parseTransaction,
  parseTransactionHDFC,
} from "../../services/transaction";

export class TransactionCheck extends OpenAPIRoute {
  schema = {
    summary: "Check if transaction exists, create if not found",
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
      "200": {
        description: "Transaction check result",
        content: {
          "application/json": {
            schema: TransactionCheckResponse,
          },
        },
      },
      "400": {
        description: "Bad request - invalid transaction data",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "404": {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();

    const rawTxn = data.body?.data;

    const auth = c.req.header("authorization");

    if (auth != c.env.TOKEN) {
      return c.json({ error: "Not found" }, 404);
    }

    // Try parsing with both transaction formats
    let extracted = parseTransactionHDFC(rawTxn);
    if (!extracted) {
      extracted = parseTransaction(rawTxn);
    }

    if (!extracted || extracted.amount !== 50) {
      return c.json({ error: "Invalid transaction data" }, 400);
    }

    try {
      // Check if transaction already exists by UPI reference
      const existingTransaction = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM transactions WHERE ref = ?",
      )
        .bind(extracted.upiRef)
        .first();

      if (existingTransaction) {
        return c.json({
          exists: true,
          transaction: {
            id: existingTransaction.id,
            vpa: existingTransaction.vpa,
            amount: existingTransaction.amount,
            date: existingTransaction.date,
            upiRef: existingTransaction.ref,
            status: existingTransaction.status,
          },
          message: "Transaction already exists",
        });
      }

      // Transaction doesn't exist, create it
      const transactionId = Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();

      const res = await c.env.EVENTS_DB.prepare(
        "INSERT INTO transactions(id, vpa, amount, date, ref, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          transactionId,
          extracted.vpa,
          extracted.amount,
          extracted.date,
          extracted.upiRef,
          "unused",
          new Date().toISOString(),
          new Date().toISOString(),
        )
        .run();

      console.log("Transaction created:", extracted, res);

      return c.json({
        exists: false,
        transaction: {
          id: transactionId,
          vpa: extracted.vpa,
          amount: extracted.amount,
          date: extracted.date,
          upiRef: extracted.upiRef,
          status: "unused",
        },
        message: "Transaction created successfully",
      });
    } catch (e) {
      console.error("Error checking/creating transaction:", e);
      return c.json({ error: "Failed to process transaction" }, 500);
    }
  }
}
