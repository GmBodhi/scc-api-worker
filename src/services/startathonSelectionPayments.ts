import { STARTATHON_SELECTION_FEE } from "../types";

/**
 * Matching of filed selection-fee references against ingested bank SMS.
 *
 * A payment is filed by a participant (POST /payment/selection) and confirmed
 * by this module when a transaction with the same reference and the same
 * amount turns up in startathon_transactions. Three things call in:
 *
 *   1. the submit endpoint, for the participant who pays before filing;
 *   2. the ingest webhook, for the far commoner order — file, then the SMS
 *      lands seconds later;
 *   3. the five-minute sweep, which is the safety net for everything else
 *      (an SMS that arrived while the endpoint was erroring, a reference
 *      edited after its transaction was already stored, a lost webhook).
 *
 * All three converge on tryConfirmSelectionPayment, and the single-row claim
 * inside it is what keeps them from double-confirming.
 */

export interface PendingSelectionPayment {
  payment_id: string;
  transaction_ref: string;
  amount: number;
}

/**
 * Confirms one filed payment if its transaction is present and unclaimed.
 * Returns whether this call is the one that confirmed it.
 *
 * The transaction claim is the arbiter: `WHERE status = 'unused'` with a
 * one-row change check means that of any number of concurrent callers holding
 * the same reference, exactly one proceeds. Everyone else sees changes === 0
 * and stops, so the payment cannot be confirmed twice and the transaction
 * cannot be spent twice.
 */
export async function tryConfirmSelectionPayment(
  db: D1Database,
  payment: PendingSelectionPayment,
): Promise<boolean> {
  const txn = await db
    .prepare(
      "SELECT ref FROM startathon_transactions WHERE ref = ? AND amount = ? AND status = 'unused'",
    )
    .bind(payment.transaction_ref, payment.amount)
    .first();

  if (!txn) {
    return false;
  }

  const nowIso = new Date().toISOString();
  const claim = await db
    .prepare(
      "UPDATE startathon_transactions SET status = 'used', updatedAt = ? WHERE ref = ? AND status = 'unused'",
    )
    .bind(nowIso, payment.transaction_ref)
    .run();

  if (claim.meta.changes !== 1) {
    return false;
  }

  // Guarded on the reference as well as the id: a payer may edit an open
  // payment's reference at any moment, including between the SELECT above and
  // here. If they did, this claim belongs to a reference the payment no longer
  // carries and confirming it would credit money against the wrong transfer.
  const confirmed = await db
    .prepare(
      "UPDATE startathon_selection_payments SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE payment_id = ? AND transaction_ref = ? AND status = 'submitted'",
    )
    .bind(
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000),
      payment.payment_id,
      payment.transaction_ref,
    )
    .run();

  if (confirmed.meta.changes !== 1) {
    // Hand the transaction back rather than leaving it marked spent against
    // nothing — otherwise the payer's corrected reference could never match it.
    await db
      .prepare(
        "UPDATE startathon_transactions SET status = 'unused', updatedAt = ? WHERE ref = ? AND status = 'used'",
      )
      .bind(new Date().toISOString(), payment.transaction_ref)
      .run();
    return false;
  }

  console.log("Startathon selection payment confirmed:", {
    payment_id: payment.payment_id,
    ref: payment.transaction_ref,
    amount: payment.amount,
  });
  return true;
}

/**
 * Called from the ingest webhook once a selection-sized transaction is stored.
 * A reference is unique in both tables, so this can match at most one payment.
 */
export async function confirmSelectionPaymentForRef(
  db: D1Database,
  ref: string,
): Promise<void> {
  const payment = await db
    .prepare(
      "SELECT payment_id, transaction_ref, amount FROM startathon_selection_payments WHERE transaction_ref = ? AND status = 'submitted'",
    )
    .bind(ref)
    .first();

  if (!payment) {
    return;
  }

  await tryConfirmSelectionPayment(db, {
    payment_id: payment.payment_id as string,
    transaction_ref: payment.transaction_ref as string,
    amount: payment.amount as number,
  });
}

/** Most payments examined per sweep. Well above any plausible backlog. */
const SWEEP_BATCH = 200;

/**
 * The five-minute job. Walks open payments oldest-first and confirms the ones
 * whose money has arrived.
 *
 * Payments whose reference exists but at the wrong amount are logged, not
 * flipped: they are a person who paid ₹250 while claiming to cover four, and
 * the fix is a conversation, not a status. Logging them is what makes that
 * conversation possible — otherwise they are indistinguishable from a payment
 * whose SMS simply has not arrived.
 */
export async function sweepStartathonSelectionPayments(
  env: Env,
): Promise<void> {
  const pending = await env.EVENTS_DB.prepare(
    "SELECT payment_id, transaction_ref, amount FROM startathon_selection_payments WHERE status = 'submitted' ORDER BY submitted_at LIMIT ?",
  )
    .bind(SWEEP_BATCH)
    .all();

  if (pending.results.length === 0) {
    return;
  }

  let confirmed = 0;
  for (const row of pending.results) {
    const payment: PendingSelectionPayment = {
      payment_id: row.payment_id as string,
      transaction_ref: row.transaction_ref as string,
      amount: row.amount as number,
    };

    if (await tryConfirmSelectionPayment(env.EVENTS_DB, payment)) {
      confirmed++;
      continue;
    }

    const mismatch = await env.EVENTS_DB.prepare(
      "SELECT amount FROM startathon_transactions WHERE ref = ?",
    )
      .bind(payment.transaction_ref)
      .first();

    if (mismatch && (mismatch.amount as number) !== payment.amount) {
      console.warn("Startathon selection payment amount mismatch:", {
        payment_id: payment.payment_id,
        ref: payment.transaction_ref,
        expected: payment.amount,
        received: mismatch.amount,
        heads: payment.amount / STARTATHON_SELECTION_FEE,
      });
    }
  }

  if (confirmed > 0) {
    console.log(
      `Startathon selection sweep: confirmed ${confirmed} of ${pending.results.length} open payments`,
    );
  }
}
