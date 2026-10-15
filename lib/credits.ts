import { db, id } from "./db";
import { HttpError } from "./auth";

export async function reserveCredits(workspaceId: string, amount: number, reason: string, jobId?: string) {
  const q = await db();
  const rows = await q`
    UPDATE workspaces SET credits = credits - ${amount}
    WHERE id = ${workspaceId} AND credits >= ${amount}
    RETURNING credits`;
  if (!rows.length) throw new HttpError(402, "Not enough credits. Top up on the Billing page.");
  await q`INSERT INTO credit_ledger (id, workspace_id, delta, reason, job_id) VALUES (${id("cl")}, ${workspaceId}, ${-amount}, ${reason}, ${jobId ?? null})`;
  return rows[0].credits as number;
}

export async function grantCredits(workspaceId: string, amount: number, reason: string, jobId?: string) {
  if (amount <= 0) return;
  const q = await db();
  await q`UPDATE workspaces SET credits = credits + ${amount} WHERE id = ${workspaceId}`;
  await q`INSERT INTO credit_ledger (id, workspace_id, delta, reason, job_id) VALUES (${id("cl")}, ${workspaceId}, ${amount}, ${reason}, ${jobId ?? null})`;
}
