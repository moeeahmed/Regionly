/**
 * End-to-end tests of the subscription and credit code. The real application code runs against an in-memory
 * Postgres and a fake Stripe (tests/helpers), so ledger writes, idempotency and sequencing are really exercised.
 */
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { useMemoryDb } from "./helpers/memory-db";
import { FakeStripe } from "./helpers/fake-stripe";

process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.SESSION_SECRET = "test-secret-test-secret";
for (const k of ["STRIPE_PRICE_STARTER", "STRIPE_PRICE_GROWTH", "STRIPE_PRICE_STARTER_ANNUAL", "STRIPE_PRICE_GROWTH_ANNUAL"]) delete process.env[k];

const fake = new FakeStripe();
type Mods = {
  db: typeof import("../lib/db");
  credits: typeof import("../lib/credits");
  sc: typeof import("../lib/subscription-credits");
  subs: typeof import("../lib/subscriptions");
  billing: typeof import("../lib/billing");
  refunds: typeof import("../lib/refunds");
  math: typeof import("../lib/subscription-math");
  config: typeof import("../lib/config");
};
let m: Mods;
let n = 0;

let pg: ReturnType<typeof useMemoryDb>;
before(async () => {
  pg = useMemoryDb();
  fake.install();
  m = {
    db: await import("../lib/db"),
    credits: await import("../lib/credits"),
    sc: await import("../lib/subscription-credits"),
    subs: await import("../lib/subscriptions"),
    billing: await import("../lib/billing"),
    refunds: await import("../lib/refunds"),
    math: await import("../lib/subscription-math"),
    config: await import("../lib/config"),
  };
});
after(async () => {
  fake.uninstall();
  await pg.close();
});
beforeEach(() => {
  fake.now = Math.floor(Date.parse("2026-03-10T12:00:00Z") / 1000) + 400 * 86400 * (++n % 3); // vary the calendar between tests
  fake.nextPayment = "paid";
});

/* ---------- helpers ---------- */

type V = { plan: "starter" | "growth"; interval: "month" | "year" };
async function workspace(credits = 0) {
  const q = await m.db.db();
  const id = `ws_${++n}_${Math.random().toString(36).slice(2, 8)}`;
  await q`INSERT INTO workspaces (id, name, credits) VALUES (${id}, 'test', ${credits})`;
  return id;
}
async function ws(id: string) {
  const q = await m.db.db();
  return (await q`SELECT * FROM workspaces WHERE id = ${id}`)[0] as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const balance = async (id: string) => (await ws(id)).credits as number;
async function ledger(id: string) {
  const q = await m.db.db();
  return (await q`SELECT * FROM credit_ledger WHERE workspace_id = ${id} ORDER BY created_at, id`) as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
}
async function ctxFor(id: string) {
  const w = await ws(id);
  return { user: { id: "u", email: "a@b.c", name: "t" }, workspace: w, role: "owner", workspaces: [{ id, name: "test", role: "owner" }] } as never;
}
/** A customer who has subscribed and whose first invoice has been processed, like the webhook would. */
async function subscribed(v: V, startingCredits = 0) {
  const id = await workspace(startingCredits);
  const price = await m.subs.ensurePrice(v);
  const { sub, invoice } = fake.createSubscription(id, price);
  const granted = await m.subs.processPaidInvoice(invoice.id);
  return { id, sub, invoice, granted };
}
/** Run the daily annual-credits job as at `at`. */
const cron = (at: number) => m.sc.allocateMonthlyCredits(at);
const MID = (sub: any) => Math.floor((sub.start + sub.end) / 2); // eslint-disable-line @typescript-eslint/no-explicit-any
const rejects = (p: Promise<unknown>, status: number) => assert.rejects(p, (e: { status?: number }) => e.status === status);

/* ---------- initial payment and renewals ---------- */

test("the first payment grants the plan's credits once, however often it is delivered", async () => {
  const { id, invoice, sub, granted } = await subscribed({ plan: "starter", interval: "month" });
  assert.equal(granted, 200);
  assert.equal(await m.subs.processPaidInvoice(invoice.id), 0);
  // a second invoice for the same period (a retry) can't grant either
  const dup = (fake as any).makeInvoice(sub, "subscription_create", "paid", 2900, [{ price: sub.priceId, proration: false, start: sub.start, end: sub.end }]); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.equal(await m.subs.processPaidInvoice(dup.id), 0);
  assert.equal(await balance(id), 200);
  const w = await ws(id);
  assert.equal(w.plan, "starter");
  assert.equal(w.billing_interval, "month");
  assert.equal(w.subscription_status, "active");
});

test("a renewal grants the plan's credits exactly once and keeps unspent credits", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  await m.credits.reserveCredits(id, 50, "use");
  const renewal = fake.renew(sub.id);
  assert.equal(await m.subs.processPaidInvoice(renewal.id), 200);
  assert.equal(await m.subs.processPaidInvoice(renewal.id), 0);
  assert.equal(await balance(id), 350); // 200 - 50 + 200: nothing reset, nothing expired
});

test("a paid zero-amount invoice (a full discount) still grants credits, an unpaid one does not", async () => {
  const id = await workspace();
  const price = await m.subs.ensurePrice({ plan: "starter", interval: "month" });
  const { invoice } = fake.createSubscription(id, price, { amount: 0 });
  assert.equal(await m.subs.processPaidInvoice(invoice.id), 200);
  const id2 = await workspace();
  const s2 = fake.createSubscription(id2, price);
  s2.invoice.status = "open";
  assert.equal(await m.subs.processPaidInvoice(s2.invoice.id), 0);
  assert.equal(await balance(id2), 0);
});

test("a failed renewal grants nothing and marks the subscription past due", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  const renewal = fake.renew(sub.id);
  renewal.status = "open";
  sub.status = "past_due";
  assert.equal(await m.subs.processPaidInvoice(renewal.id), 0);
  await m.subs.processFailedInvoice(renewal.id);
  assert.equal(await balance(id), 200);
  assert.equal((await ws(id)).subscription_status, "past_due");
});

test("the same invoice delivered many times at once grants once", async () => {
  const id = await workspace();
  const price = await m.subs.ensurePrice({ plan: "growth", interval: "month" });
  const { invoice } = fake.createSubscription(id, price);
  await Promise.all(Array.from({ length: 6 }, () => m.subs.processPaidInvoice(invoice.id)));
  assert.equal(await balance(id), 800);
  assert.equal((await ledger(id)).length, 1);
});

test("an old invoice arriving after a newer one neither re-grants nor rewinds the workspace", async () => {
  const { id, invoice: first, sub } = await subscribed({ plan: "starter", interval: "month" });
  const second = fake.renew(sub.id);
  await m.subs.processPaidInvoice(second.id);
  const periodEnd = (await ws(id)).current_period_end;
  assert.equal(await m.subs.processPaidInvoice(first.id), 0); // late redelivery
  assert.equal(await balance(id), 400);
  assert.deepEqual((await ws(id)).current_period_end, periodEnd);
});

/* ---------- upgrades ---------- */

test("a halfway upgrade charges via Stripe and grants the prorated credit difference, once", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  fake.now = MID(sub);
  const ctx = await ctxFor(id);
  const preview = await m.subs.previewChange(ctx, { plan: "growth", interval: "month" });
  assert.equal(preview.creditsNow, 300);
  assert.ok(preview.amountDue > 0);
  assert.equal(preview.newCredits, 800);
  const r = await m.subs.changeNow(ctx, { plan: "growth", interval: "month" });
  assert.equal(r.status, "applied");
  assert.equal(await balance(id), 500); // 200 existing + 300, not +800
  assert.equal((await ws(id)).plan, "growth");
  const inv = [...fake.invoices.values()].find((i) => i.billing_reason === "subscription_update" && i.subscription === sub.id)!;
  assert.equal(await m.subs.processPaidInvoice(inv.id), 0); // webhook for the same payment
  assert.equal(await balance(id), 500);
  const renewal = fake.renew(sub.id);
  await m.subs.processPaidInvoice(renewal.id);
  assert.equal(await balance(id), 1300); // next renewal gives the full 800
});

test("upgrading at the start of the period grants the full difference; near the end almost nothing", async () => {
  const a = await subscribed({ plan: "starter", interval: "month" });
  await m.subs.changeNow(await ctxFor(a.id), { plan: "growth", interval: "month" });
  assert.equal(await balance(a.id), 800); // 200 + 600
  const b = await subscribed({ plan: "starter", interval: "month" });
  fake.now = b.sub.end - 1200;
  await m.subs.changeNow(await ctxFor(b.id), { plan: "growth", interval: "month" });
  assert.equal(await balance(b.id), 200); // 600 x (20 minutes / a month) rounds to 0
});

test("an upgrade after spending credits keeps the remainder, and works with zero credits left", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  await m.credits.reserveCredits(id, 200, "use everything");
  assert.equal(await balance(id), 0);
  fake.now = MID(sub);
  await m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "month" });
  assert.equal(await balance(id), 300);
});

test("a declined upgrade payment grants nothing, changes nothing, and can be retried", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  fake.now = MID(sub);
  fake.nextPayment = "fail";
  await rejects(m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "month" }), 402);
  assert.equal(await balance(id), 200);
  assert.equal((await ws(id)).plan, "starter");
  const q = await m.db.db();
  assert.equal((await q`SELECT status FROM plan_changes WHERE workspace_id = ${id}`)[0].status, "failed");
  fake.nextPayment = "paid";
  assert.equal((await m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "month" })).status, "applied");
  assert.equal(await balance(id), 500);
});

test("an upgrade that needs bank confirmation waits, then completes exactly once when paid", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  fake.now = MID(sub);
  fake.nextPayment = "action";
  const r = await m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "month" });
  assert.equal(r.status, "requires_action");
  assert.equal(await balance(id), 200);
  assert.equal((await ws(id)).plan, "starter");
  await rejects(m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "month" }), 409); // repeated click
  const invoiceId = [...fake.invoices.values()].find((i) => i.billing_reason === "subscription_update" && i.subscription === sub.id)!.id;
  await m.subs.reconcilePlanChanges(id);
  assert.equal(await balance(id), 200); // still unpaid
  fake.payInvoice(invoiceId);
  await Promise.all([m.subs.processPaidInvoice(invoiceId), m.subs.processPaidInvoice(invoiceId)]);
  assert.equal(await balance(id), 500);
  assert.equal((await ws(id)).plan, "growth");
});

test("an upgrade abandoned at the bank step can be cancelled and tried again", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  fake.now = MID(sub);
  fake.nextPayment = "action";
  await m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "month" });
  await m.subs.cancelPendingUpgrade(await ctxFor(id));
  assert.equal(await balance(id), 200);
  assert.equal(await m.sc.findPlanChangeForInvoice("none", "none"), null);
  fake.nextPayment = "paid";
  assert.equal((await m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "month" })).status, "applied");
});

test("a pending upgrade that Stripe says was paid is applied when reconciled, even if the webhook was lost", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  fake.now = MID(sub);
  fake.nextPayment = "action";
  await m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "month" });
  fake.payInvoice([...fake.invoices.values()].find((i) => i.billing_reason === "subscription_update" && i.subscription === sub.id)!.id);
  await m.subs.reconcilePlanChanges(id);
  assert.equal(await balance(id), 500);
});

test("a change whose payment never arrives is failed after a day", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  fake.now = MID(sub);
  fake.nextPayment = "action";
  await m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "month" });
  fake.advance(90000);
  await m.subs.reconcilePlanChanges(id);
  const q = await m.db.db();
  assert.equal((await q`SELECT status FROM plan_changes WHERE workspace_id = ${id}`)[0].status, "failed");
  assert.equal(await balance(id), 200);
});

test("successive changes in one period each grant only their own increment", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  fake.now = MID(sub);
  await m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "month" }); // +300
  assert.equal(await balance(id), 500);
  fake.advance(86400 * 5);
  await m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "year" }); // new annual period starts now
  const w = await ws(id);
  assert.equal(w.billing_interval, "year");
  const after = await balance(id);
  assert.ok(after > 500 && after <= 500 + 800, `balance ${after}`);
});

/* ---------- downgrades and cancellations ---------- */

test("a downgrade is scheduled for renewal and removes nothing now", async () => {
  const { id, sub } = await subscribed({ plan: "growth", interval: "month" });
  fake.now = MID(sub);
  const callsBefore = fake.calls.length;
  await m.subs.changeAtRenewal(await ctxFor(id), { plan: "starter", interval: "month" });
  let w = await ws(id);
  assert.equal(w.plan, "growth");
  assert.equal(w.pending_plan, "starter");
  assert.equal(w.pending_interval, "month");
  assert.equal(await balance(id), 800);
  assert.equal(fake.calls.slice(callsBefore).filter((c) => c.path === "invoices/create_preview" || (c.path.startsWith("subscriptions/") && c.body.items)).length, 0); // no immediate charge
  const renewal = fake.renew(sub.id);
  await m.subs.processPaidInvoice(renewal.id);
  w = await ws(id);
  assert.equal(w.plan, "starter");
  assert.equal(w.pending_plan, null);
  assert.equal(await balance(id), 1000); // old credits kept, 200 added for the lower plan
});

test("a pending downgrade can be cancelled", async () => {
  const { id } = await subscribed({ plan: "growth", interval: "month" });
  await m.subs.changeAtRenewal(await ctxFor(id), { plan: "starter", interval: "month" });
  await m.subs.cancelPendingChange(await ctxFor(id));
  assert.equal((await ws(id)).pending_plan, null);
});

test("a downgrade cannot be started as an immediate change, nor an upgrade scheduled", async () => {
  const { id } = await subscribed({ plan: "growth", interval: "month" });
  await rejects(m.subs.changeNow(await ctxFor(id), { plan: "starter", interval: "month" }), 409);
  const b = await subscribed({ plan: "starter", interval: "month" });
  await rejects(m.subs.changeAtRenewal(await ctxFor(b.id), { plan: "growth", interval: "month" }), 409);
  await rejects(m.subs.changeNow(await ctxFor(b.id), { plan: "starter", interval: "month" }), 409); // same plan
});

test("an upgrade replaces a pending downgrade, and a failed upgrade puts the downgrade back", async () => {
  const { id, sub } = await subscribed({ plan: "growth", interval: "month" });
  await m.subs.changeAtRenewal(await ctxFor(id), { plan: "starter", interval: "month" });
  fake.now = MID(sub);
  fake.nextPayment = "fail";
  await rejects(m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "year" }), 402);
  const w = await ws(id);
  assert.equal(w.pending_plan, "starter"); // restored
  assert.equal(w.plan, "growth");
  fake.nextPayment = "paid";
  await m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "year" });
  assert.equal((await ws(id)).pending_plan, null); // the successful change replaced it
});

test("cancelling ends the subscription at period end, keeps credits, drops a pending downgrade, and can be undone", async () => {
  const { id } = await subscribed({ plan: "growth", interval: "month" });
  await m.subs.changeAtRenewal(await ctxFor(id), { plan: "starter", interval: "month" });
  await m.subs.cancelAtPeriodEnd(await ctxFor(id));
  let w = await ws(id);
  assert.equal(w.cancel_at_period_end, true);
  assert.equal(w.pending_plan, null);
  assert.equal(w.plan, "growth");
  assert.equal(await balance(id), 800);
  await rejects(m.subs.changeNow(await ctxFor(id), { plan: "growth", interval: "year" }), 409); // keep it first
  await m.subs.reactivate(await ctxFor(id));
  w = await ws(id);
  assert.equal(w.cancel_at_period_end, false);
});

test("after the subscription ends there are no more allocations, and credits stay", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  await m.subs.cancelAtPeriodEnd(await ctxFor(id));
  fake.deleteSubscription(sub.id);
  await m.subs.syncSubscription(sub.id); // customer.subscription.deleted
  const w = await ws(id);
  assert.equal(w.plan, "free");
  assert.equal(w.stripe_subscription_id, null);
  await cron(fake.now + 86400 * 400);
  assert.equal(await balance(id), 200); // nothing added after the subscription ended
});

test("a deleted old subscription event can't wipe a newer subscription", async () => {
  const old = await subscribed({ plan: "starter", interval: "month" });
  fake.deleteSubscription(old.sub.id);
  await m.subs.syncSubscription(old.sub.id);
  const price = await m.subs.ensurePrice({ plan: "growth", interval: "month" });
  const next = fake.createSubscription(old.id, price);
  await m.subs.processPaidInvoice(next.invoice.id);
  await m.subs.syncSubscription(old.sub.id); // late duplicate of the old deletion
  const w = await ws(old.id);
  assert.equal(w.plan, "growth");
  assert.equal(w.stripe_subscription_id, next.sub.id);
});

/* ---------- annual plans ---------- */

test("an annual subscription grants one month of credits, not the year", async () => {
  const { id, granted } = await subscribed({ plan: "starter", interval: "year" });
  assert.equal(granted, 200);
  assert.equal(await balance(id), 200);
  assert.equal((await ws(id)).billing_interval, "year");
});

test("annual customers get each following month's credits from the daily job, once, with catch-up", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "year" });
  await cron(fake.now + 86400);
  assert.equal(await balance(id), 200); // nothing due yet
  const month1 = m.math.addMonths(sub.start, 1);
  await cron(month1 + 60);
  await cron(month1 + 120); // run twice, grant once
  assert.equal(await balance(id), 400);
  await cron(m.math.addMonths(sub.start, 3) + 60); // missed runs caught up: months 2 and 3
  assert.equal(await balance(id), 800);
  const rows = await ledger(id);
  assert.equal(new Set(rows.map((r) => r.idempotency_key)).size, rows.length);
  assert.ok(rows.every((r) => r.kind === "allocation" && r.subscription_id === sub.id));
});

test("annual credits keep arriving after cancellation until the paid year ends, and stop after", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "year" });
  await m.subs.cancelAtPeriodEnd(await ctxFor(id));
  await cron(m.math.addMonths(sub.start, 1) + 60);
  assert.equal(await balance(id), 400); // still granted while the paid year runs
  fake.deleteSubscription(sub.id);
  await m.subs.syncSubscription(sub.id);
  await cron(m.math.addMonths(sub.start, 5));
  assert.equal(await balance(id), 400); // nothing once it has ended
});

test("an annual renewal grants month one of the new year once", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "year" });
  const renewal = fake.renew(sub.id);
  assert.equal(await m.subs.processPaidInvoice(renewal.id), 200);
  assert.equal(await m.subs.processPaidInvoice(renewal.id), 0);
  assert.equal(await balance(id), 400);
});

test("upgrading mid-year prorates the credits over the current month, and later months use the new plan", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "year" });
  const slotStart = m.math.addMonths(sub.start, 2);
  const slotEnd = m.math.addMonths(sub.start, 3);
  await cron(slotStart + 60); // months 1 and 2 arrive on the starter plan
  assert.equal(await balance(id), 600);
  fake.now = Math.floor((slotStart + slotEnd) / 2);
  const ctx = await ctxFor(id);
  const preview = await m.subs.previewChange(ctx, { plan: "growth", interval: "year" });
  assert.equal(preview.creditsNow, m.math.prorateCredits(200, 800, slotStart, slotEnd, fake.now));
  assert.equal(preview.intervalChange, false);
  await m.subs.changeNow(ctx, { plan: "growth", interval: "year" });
  assert.equal(await balance(id), 600 + 300);
  await cron(slotEnd + 60); // month 3 arrives on the growth plan
  assert.equal(await balance(id), 900 + 800);
});

test("monthly to annual starts a new year now, with first-month credits less the unused share", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "month" });
  fake.now = MID(sub);
  const ctx = await ctxFor(id);
  const expected = m.math.intervalSwitchCredits(200, 200, sub.start, sub.end, fake.now);
  const preview = await m.subs.previewChange(ctx, { plan: "starter", interval: "year" });
  assert.equal(preview.intervalChange, true);
  assert.equal(preview.creditsNow, expected);
  assert.equal(preview.renewalDate, m.math.addMonths(fake.now, 12));
  await m.subs.changeNow(ctx, { plan: "starter", interval: "year" });
  const w = await ws(id);
  assert.equal(w.billing_interval, "year");
  assert.equal(await balance(id), 200 + expected);
  const ps = Math.floor(new Date(w.current_period_start).getTime() / 1000);
  await cron(m.math.addMonths(ps, 1) + 60); // months continue from the new year
  assert.equal(await balance(id), 200 + expected + 200);
});

test("annual to monthly at the same tier waits for renewal, and can't be done now", async () => {
  const { id, sub } = await subscribed({ plan: "starter", interval: "year" });
  const ctx = await ctxFor(id);
  await rejects(m.subs.changeNow(ctx, { plan: "starter", interval: "month" }), 409);
  await m.subs.changeAtRenewal(ctx, { plan: "starter", interval: "month" });
  let w = await ws(id);
  assert.equal(w.pending_interval, "month");
  assert.equal(w.billing_interval, "year");
  const renewal = fake.renew(sub.id);
  await m.subs.processPaidInvoice(renewal.id);
  w = await ws(id);
  assert.equal(w.billing_interval, "month");
  assert.equal(w.pending_plan, null);
});

/* ---------- refunds and disputes ---------- */

test("a refund takes credits back in proportion, never below zero, and only once", async () => {
  const id = await workspace();
  const session = { id: "cs_pack1", mode: "payment", payment_status: "paid", metadata: { workspace_id: id, plan: "pack", credits: "100" } };
  assert.equal(await m.billing.fulfilCreditPurchase(session), true);
  assert.equal(await m.billing.fulfilCreditPurchase(session), false); // duplicate delivery
  assert.equal(await balance(id), 100);
  const charge = fake.addPaidCharge({ amount: 1900, sessionId: "cs_pack1" });
  charge.amount_refunded = 950;
  assert.equal(await m.refunds.handleRefund(charge as never), 50);
  assert.equal(await m.refunds.handleRefund(charge as never), 0); // duplicate event
  assert.equal(await balance(id), 50);
  await m.credits.reserveCredits(id, 40, "use");
  charge.amount_refunded = 1900;
  assert.equal(await m.refunds.handleRefund(charge as never), 10); // 50 more owed, only 10 left to take
  assert.equal(await balance(id), 0);
});

test("a lost dispute takes credits back and a won one gives them back", async () => {
  const id = await workspace();
  await m.billing.fulfilCreditPurchase({ id: "cs_pack2", mode: "payment", payment_status: "paid", metadata: { workspace_id: id, plan: "pack", credits: "100" } });
  const charge = fake.addPaidCharge({ amount: 1900, sessionId: "cs_pack2" });
  assert.equal(await m.refunds.handleDispute({ id: "dp_1", charge: charge.id }), 100);
  assert.equal(await balance(id), 0);
  assert.equal(await m.refunds.handleDisputeClosed({ id: "dp_1", charge: charge.id, status: "won" }), 100);
  assert.equal(await m.refunds.handleDisputeClosed({ id: "dp_1", charge: charge.id, status: "won" }), 0);
  assert.equal(await balance(id), 100);
  assert.equal(await m.refunds.handleDisputeClosed({ id: "dp_2", charge: charge.id, status: "lost" }), 0);
});

test("refunding a subscription invoice takes back that period's credits", async () => {
  const { id, invoice } = await subscribed({ plan: "starter", interval: "month" });
  const charge = fake.addPaidCharge({ amount: 2900, invoice: invoice.id });
  charge.amount_refunded = 2900;
  assert.equal(await m.refunds.handleRefund(charge as never), 200);
  assert.equal(await balance(id), 0);
});

/* ---------- the ledger itself ---------- */

test("a repeated idempotency key grants once, even when delivered concurrently", async () => {
  const id = await workspace();
  const r = await Promise.all(Array.from({ length: 6 }, () => m.credits.grantCredits(id, 200, "dup", undefined, { kind: "allocation", idempotencyKey: "k1" })));
  assert.equal(r.filter(Boolean).length, 1);
  assert.equal(await balance(id), 200);
});

test("simultaneous spends can never overspend", async () => {
  const id = await workspace(100);
  const r = await Promise.allSettled(Array.from({ length: 10 }, () => m.credits.reserveCredits(id, 30, "use")));
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 3);
  assert.equal(await balance(id), 10);
});

test("spending while a grant lands keeps the ledger and balance in step", async () => {
  const id = await workspace(100);
  await Promise.all([
    ...Array.from({ length: 4 }, () => m.credits.reserveCredits(id, 20, "use")),
    ...Array.from({ length: 3 }, (_, i) => m.credits.grantCredits(id, 50, "grant", undefined, { kind: "allocation", idempotencyKey: `g${i}` })),
  ]);
  const rows = await ledger(id);
  assert.equal(rows.reduce((s, r) => s + r.delta, 0), await balance(id) - 100 + 0); // balance started at 100 with no ledger row
  assert.equal(await balance(id), 100 - 80 + 150);
});

test("ledger entries record kind, subscription, Stripe reference and period", async () => {
  const { id, invoice, sub } = await subscribed({ plan: "starter", interval: "month" });
  const row = (await ledger(id))[0];
  assert.equal(row.kind, "allocation");
  assert.equal(row.subscription_id, sub.id);
  assert.equal(row.stripe_ref, invoice.id);
  assert.ok(row.period_start && row.period_end && row.idempotency_key);
});

test("only one plan change can be pending per workspace", async () => {
  const id = await workspace();
  const q = await m.db.db();
  const ins = (pc: string) => q`INSERT INTO plan_changes (id, workspace_id, subscription_id, from_plan, to_plan, credits, proration_date) VALUES (${pc}, ${id}, 's', 'starter', 'growth', 1, 1) ON CONFLICT DO NOTHING RETURNING id`;
  const r = await Promise.all([ins("a"), ins("b")]);
  assert.equal(r.filter((x) => x.length).length, 1);
});

test("fulfilment from before idempotency keys existed is recognised and not repeated", async () => {
  const id = await workspace();
  const q = await m.db.db();
  await q`INSERT INTO stripe_events (id) VALUES ('fulfil_cs_old'), ('fulfil_inv_in_old')`;
  assert.equal(await m.billing.fulfilCreditPurchase({ id: "cs_old", mode: "payment", payment_status: "paid", metadata: { workspace_id: id, plan: "pack", credits: "100" } }), false);
  assert.equal(await m.sc.allocatePeriodCredits({ workspaceId: id, subscriptionId: "s", planKey: "starter", periodStart: 5, periodEnd: 9, invoiceId: "in_old" }), 0);
  assert.equal(await balance(id), 0);
});

/* ---------- pricing display ---------- */

test("annual savings are worked out from the configured prices", () => {
  const s = m.config.annualSavings("starter");
  assert.equal(s.pence, m.config.PLANS.starter.pence * 12 - m.config.ANNUAL_PRICES.starter.pence);
  assert.equal(s.percent, Math.round((s.pence / (m.config.PLANS.starter.pence * 12)) * 100));
  assert.ok(s.pence > 0 && s.monthsFree > 0);
});

test("prices are created in Stripe once per plan and interval, with the plan in their metadata", async () => {
  const a = await m.subs.ensurePrice({ plan: "growth", interval: "year" });
  const b = await m.subs.ensurePrice({ plan: "growth", interval: "year" });
  assert.equal(a, b);
  const price = fake.prices.get(a)!;
  assert.equal(price.recurring.interval, "year");
  assert.equal(price.metadata.plan, "growth");
  assert.deepEqual(m.subs.variantOfPrice(price as never), { plan: "growth", interval: "year" });
});
