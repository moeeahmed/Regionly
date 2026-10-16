import { db, id } from "./db";
import { HttpError } from "./auth";

export type LedgerKind = "allocation" | "upgrade_adjustment" | "purchase" | "usage" | "refund" | "welcome" | "expiration" | "reversal";

export type GrantOpts = {
  kind?: LedgerKind;
  /** Same key twice grants once. Stripe-driven grants must always pass one. */
  idempotencyKey?: string;
  subscriptionId?: string;
  stripeRef?: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
};

/** Spend credits. One statement: the balance check, the debit and the ledger row succeed or fail together. */
export async function reserveCredits(workspaceId: string, amount: number, reason: string, jobId?: string) {
  const q = await db();
  const rows = await q`
    WITH upd AS (
      UPDATE workspaces SET credits = credits - ${amount}::int
      WHERE id = ${workspaceId} AND credits >= ${amount}::int
      RETURNING id, credits
    ), led AS (
      INSERT INTO credit_ledger (id, workspace_id, delta, reason, job_id, kind)
      SELECT ${id("cl")}::text, upd.id, ${-amount}::int, ${reason}::text, ${jobId ?? null}::text, 'usage' FROM upd
      RETURNING id
    )
    SELECT credits FROM upd`;
  if (!rows.length) throw new HttpError(402, "Not enough credits. Top up on the Billing page.");
  return rows[0].credits as number;
}

/**
 * Add credits. One statement: the ledger row and the balance change succeed or fail together,
 * and a repeated idempotency key changes nothing. Returns true only when credits were added.
 */
export async function grantCredits(workspaceId: string, amount: number, reason: string, jobId?: string, opts: GrantOpts = {}) {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  const q = await db();
  const rows = await q`
    WITH ins AS (
      INSERT INTO credit_ledger (id, workspace_id, delta, reason, job_id, kind, subscription_id, stripe_ref, period_start, period_end, idempotency_key)
      VALUES (${id("cl")}::text, ${workspaceId}::text, ${amount}::int, ${reason}::text, ${jobId ?? null}::text, ${opts.kind ?? "refund"}::text,
              ${opts.subscriptionId ?? null}::text, ${opts.stripeRef ?? null}::text,
              ${opts.periodStart?.toISOString() ?? null}::timestamptz, ${opts.periodEnd?.toISOString() ?? null}::timestamptz,
              ${opts.idempotencyKey ?? null}::text)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING workspace_id, delta
    )
    UPDATE workspaces w SET credits = w.credits + ins.delta FROM ins WHERE w.id = ins.workspace_id
    RETURNING w.credits`;
  return rows.length > 0;
}

/**
 * Take credits back (a refund or a lost dispute). Never takes more than the current balance, so a balance can't go
 * negative; idempotent on the key. Returns how many credits were actually taken.
 */
export async function reverseCredits(workspaceId: string, amount: number, reason: string, opts: GrantOpts) {
  if (!Number.isInteger(amount) || amount <= 0) return 0;
  const q = await db();
  const rows = await q`
    WITH cur AS (SELECT credits FROM workspaces WHERE id = ${workspaceId}::text FOR UPDATE),
    take AS (SELECT LEAST(${amount}::int, GREATEST(credits, 0)) AS n FROM cur),
    ins AS (
      INSERT INTO credit_ledger (id, workspace_id, delta, reason, kind, subscription_id, stripe_ref, idempotency_key)
      SELECT ${id("cl")}::text, ${workspaceId}::text, -take.n, ${reason}::text, 'reversal', ${opts.subscriptionId ?? null}::text, ${opts.stripeRef ?? null}::text, ${opts.idempotencyKey ?? null}::text
      FROM take WHERE take.n > 0
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING workspace_id, delta
    )
    UPDATE workspaces w SET credits = w.credits + ins.delta FROM ins WHERE w.id = ins.workspace_id
    RETURNING ins.delta`;
  return rows.length ? -(rows[0].delta as number) : 0;
}
