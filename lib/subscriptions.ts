import { db, id } from "./db";
import { HttpError, type Ctx } from "./auth";
import { PLANS, SUBSCRIPTION_PLANS, planPricing, type Interval, type SubscriptionPlanKey } from "./config";
import { stripe } from "./stripe";
import { addMonths, classifyChange, decideInvoiceGrant, intervalSwitchCredits, prorateCredits, slotOf, type InvoiceFacts, type PlanLike } from "./subscription-math";
import { allocatePeriodCredits, applyPlanChange, failPlanChange, findPlanChangeForInvoice, type PlanChangeRow } from "./subscription-credits";

/* ---------- Stripe object shapes (only the fields used here) ---------- */

type Price = { id: string; unit_amount?: number | null; metadata?: Record<string, string>; recurring?: { interval?: string } | null };
type Item = { id: string; price: Price; current_period_start?: number; current_period_end?: number };
type Schedule = { id: string; status: string; phases: { start_date: number; end_date: number | null; items: { price: string | Price }[] }[] };
type Sub = {
  id: string;
  status: string;
  customer: string;
  metadata?: Record<string, string>;
  items: { data: Item[] };
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  schedule?: string | Schedule | null;
  pending_update?: unknown;
  latest_invoice?: string | Invoice | null;
};
type Line = {
  proration?: boolean;
  period?: { start: number; end: number };
  price?: { id: string } | string | null;
  pricing?: { price_details?: { price?: string } };
  parent?: { subscription_item_details?: { proration?: boolean } };
};
export type Invoice = {
  id: string;
  status: string;
  billing_reason: string;
  amount_due?: number;
  hosted_invoice_url?: string | null;
  subscription?: string | null;
  parent?: { subscription_details?: { subscription?: string } } | null;
  lines?: { data: Line[] };
};

/** A plan and how often it bills. */
export type Variant = { plan: SubscriptionPlanKey; interval: Interval };

const nowSec = () => Math.floor(Date.now() / 1000);
const asPlan = (v: Variant): PlanLike => ({ credits: PLANS[v.plan].credits, interval: v.interval });
const isPlanKey = (k: unknown): k is SubscriptionPlanKey => (SUBSCRIPTION_PLANS as readonly unknown[]).includes(k);
const isInterval = (k: unknown): k is Interval => k === "month" || k === "year";

export function parseVariant(plan: unknown, interval: unknown): Variant {
  if (!isPlanKey(plan)) throw new HttpError(400, "That plan doesn't exist.");
  return { plan, interval: isInterval(interval) ? interval : "month" };
}

/* ---------- Prices and plans ---------- */

const priceCache = new Map<string, Price>();
async function getPrice(priceId: string) {
  let p = priceCache.get(priceId);
  if (!p) {
    p = await stripe<Price>(`prices/${priceId}`, undefined, "GET");
    priceCache.set(priceId, p);
  }
  return p;
}

/** Which plan and billing interval a Stripe price is: its metadata, an env override, or its amount. */
export function variantOfPrice(price: Price): Variant | null {
  const interval: Interval = isInterval(price.metadata?.interval) ? price.metadata!.interval as Interval : price.recurring?.interval === "year" ? "year" : "month";
  const m = price.metadata?.plan;
  if (isPlanKey(m)) return { plan: m, interval };
  for (const k of SUBSCRIPTION_PLANS) for (const iv of ["month", "year"] as const) if (process.env[planPricing(k, iv).env] === price.id) return { plan: k, interval: iv };
  for (const k of SUBSCRIPTION_PLANS) for (const iv of ["month", "year"] as const) {
    if (price.unit_amount === planPricing(k, iv).pence && price.recurring?.interval === iv) return { plan: k, interval: iv };
  }
  return null;
}

/**
 * The Stripe price for a plan and interval. Uses the STRIPE_PRICE_* env var if set, otherwise finds or creates a
 * price by lookup key, so no dashboard setup is needed and subscription schedules have a real price to point at.
 * The lookup key includes the amount, so changing a price in config creates a new Stripe price.
 */
export async function ensurePrice(v: Variant) {
  const plan = PLANS[v.plan];
  const { pence, env } = planPricing(v.plan, v.interval);
  const override = process.env[env];
  if (override) return override;
  const lookup_key = `regionly_${v.plan}_${v.interval}_gbp_${pence}`;
  const find = async () => (await stripe<{ data: Price[] }>("prices", { lookup_keys: [lookup_key] }, "GET")).data[0];
  const found = await find();
  if (found) return found.id;
  try {
    const created = await stripe<Price>("prices", {
      currency: "gbp",
      unit_amount: pence,
      recurring: { interval: v.interval },
      lookup_key,
      metadata: { plan: v.plan, interval: v.interval, credits: String(plan.credits) },
      product_data: { name: `Regionly ${plan.name}${v.interval === "year" ? " annual" : ""}, ${plan.credits} credits a month` },
    });
    return created.id;
  } catch (e) {
    const again = await find(); // lost a race with another request creating the same price
    if (again) return again.id;
    throw e;
  }
}

/* ---------- Reading a subscription ---------- */

function periodOf(sub: Sub) {
  const item = sub.items.data[0];
  return {
    start: item?.current_period_start ?? sub.current_period_start ?? 0,
    end: item?.current_period_end ?? sub.current_period_end ?? 0,
  };
}

async function getSub(subId: string, expand: string[] = []) {
  return stripe<Sub>(`subscriptions/${subId}`, expand.length ? { expand } : undefined, "GET");
}

/**
 * Copy the current Stripe state of a subscription onto the workspace (plan, interval, period, pending change,
 * cancellation). It always reads Stripe's latest state, so webhooks can arrive late, twice or out of order without harm.
 */
export async function syncSubscription(subId: string) {
  const sub = await getSub(subId, ["schedule"]);
  const q = await db();
  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    await q`UPDATE workspaces SET plan = 'free', stripe_subscription_id = NULL, subscription_status = NULL, current_period_start = NULL,
      current_period_end = NULL, cancel_at_period_end = false, pending_plan = NULL, pending_interval = NULL, pending_plan_at = NULL,
      stripe_schedule_id = NULL, billing_interval = NULL WHERE stripe_subscription_id = ${sub.id}`;
    return;
  }
  if (sub.status === "incomplete") return; // first payment not confirmed yet
  const item = sub.items.data[0];
  const current = item ? variantOfPrice(item.price) : null;
  const { start, end } = periodOf(sub);
  const schedule = typeof sub.schedule === "object" && sub.schedule ? sub.schedule : null;
  let pending: Variant | null = null;
  let pendingAt: number | null = null;
  if (schedule && (schedule.status === "active" || schedule.status === "not_started")) {
    const next = schedule.phases.find((p) => p.start_date > nowSec());
    const nextPrice = next?.items[0]?.price;
    if (next && nextPrice) {
      pending = variantOfPrice(typeof nextPrice === "string" ? await getPrice(nextPrice) : nextPrice);
      pendingAt = next.start_date;
    }
  }
  await q`UPDATE workspaces SET
      plan = COALESCE(${current?.plan ?? null}::text, plan),
      billing_interval = COALESCE(${current?.interval ?? null}::text, billing_interval),
      stripe_subscription_id = ${sub.id},
      stripe_customer_id = COALESCE(stripe_customer_id, ${sub.customer}),
      subscription_status = ${sub.status},
      current_period_start = to_timestamp(${start}::bigint),
      current_period_end = to_timestamp(${end}::bigint),
      cancel_at_period_end = ${!!sub.cancel_at_period_end},
      pending_plan = ${pending?.plan ?? null}::text,
      pending_interval = ${pending?.interval ?? null}::text,
      pending_plan_at = CASE WHEN ${pendingAt}::bigint IS NULL THEN NULL ELSE to_timestamp(${pendingAt}::bigint) END,
      stripe_schedule_id = ${schedule?.id ?? null}::text
    WHERE stripe_subscription_id = ${sub.id} OR (stripe_subscription_id IS NULL AND id = ${sub.metadata?.workspace_id ?? ""})`;
}

/* ---------- Invoices: the only place subscription credits are granted ---------- */

function lineProration(l: Line) {
  return l.proration ?? l.parent?.subscription_item_details?.proration ?? false;
}
function linePriceId(l: Line) {
  const p = l.price;
  return (typeof p === "string" ? p : p?.id) ?? l.pricing?.price_details?.price ?? null;
}
function invoiceSubscriptionId(inv: Invoice) {
  return inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
}

/** Handle a paid invoice: allocate a period's credits, or complete a plan change. Safe to call any number of times. */
export async function processPaidInvoice(invoiceId: string) {
  const inv = await stripe<Invoice>(`invoices/${invoiceId}`, undefined, "GET");
  const subId = invoiceSubscriptionId(inv);
  if (!subId) return 0;
  const sub = await getSub(subId);
  const recurring = inv.lines?.data.find((l) => !lineProration(l) && linePriceId(l));
  const priceId = (recurring && linePriceId(recurring)) ?? sub.items.data[0]?.price.id ?? null;
  const variant = priceId ? variantOfPrice(await getPrice(priceId)) : null;
  const facts: InvoiceFacts = {
    id: inv.id,
    status: inv.status,
    billingReason: inv.billing_reason,
    subscriptionId: subId,
    planKey: variant?.plan ?? null,
    periodStart: recurring?.period?.start ?? periodOf(sub).start ?? null,
  };
  const decision = decideInvoiceGrant(facts);
  let granted = 0;
  if (decision.kind === "allocation") {
    const workspaceId = await workspaceForSubscription(sub);
    if (workspaceId) {
      granted = await allocatePeriodCredits({
        workspaceId,
        subscriptionId: subId,
        planKey: decision.planKey as SubscriptionPlanKey,
        periodStart: facts.periodStart!,
        periodEnd: recurring?.period?.end ?? null,
        invoiceId: inv.id,
      });
    }
  } else if (decision.kind === "plan_change") {
    const pc = await findPlanChangeForInvoice(inv.id, subId);
    if (pc) granted = await applyPlanChange(pc.id, inv.id);
  }
  await syncSubscription(subId);
  return granted;
}

export async function processFailedInvoice(invoiceId: string) {
  const inv = await stripe<Invoice>(`invoices/${invoiceId}`, undefined, "GET");
  const subId = invoiceSubscriptionId(inv);
  if (!subId) return;
  if (inv.billing_reason === "subscription_update") {
    const pc = await findPlanChangeForInvoice(inv.id, subId);
    if (pc) await failAndRestore(pc.id, "Payment failed");
  }
  await syncSubscription(subId); // renewals that fail leave the subscription past_due and grant nothing
}

async function workspaceForSubscription(sub: Sub) {
  const q = await db();
  const rows = await q`SELECT id FROM workspaces WHERE stripe_subscription_id = ${sub.id} OR id = ${sub.metadata?.workspace_id ?? ""} LIMIT 1`;
  return (rows[0]?.id as string | undefined) ?? null;
}

/* ---------- Plan changes the customer asks for ---------- */

type Change = { sub: Sub; item: Item; from: Variant; to: Variant; toPrice: string; period: { start: number; end: number } };

async function loadChange(ctx: Ctx, to: Variant, expected: "now" | "at_renewal"): Promise<Change> {
  const subId = ctx.workspace.stripe_subscription_id;
  if (!subId) throw new HttpError(400, "You don't have a subscription to change yet.");
  await reconcilePlanChanges(ctx.workspace.id);
  const pending = await pendingPlanChange(ctx.workspace.id);
  if (pending) throw new HttpError(409, "A plan change is waiting for payment. Finish or cancel it first.");
  const sub = await getSub(subId, ["schedule"]);
  if (["canceled", "incomplete", "incomplete_expired"].includes(sub.status)) throw new HttpError(409, "That subscription isn't active.");
  if (sub.cancel_at_period_end) throw new HttpError(409, "Your subscription is set to end. Keep it first, then change plan.");
  const item = sub.items.data[0];
  const from = item && variantOfPrice(item.price);
  if (!item || !from) throw new HttpError(409, "We couldn't identify your current plan.");
  const kind = classifyChange(asPlan(from), asPlan(to));
  if (kind === "same") throw new HttpError(409, "You're already on that plan.");
  if (kind !== expected) throw new HttpError(409, expected === "now" ? "That change takes effect at your next renewal." : "That change takes effect straight away.");
  return { sub, item, from, to, toPrice: await ensurePrice(to), period: periodOf(sub) };
}

export async function pendingPlanChange(workspaceId: string) {
  const q = await db();
  const rows = (await q`SELECT * FROM plan_changes WHERE workspace_id = ${workspaceId} AND status = 'pending' LIMIT 1`) as (PlanChangeRow & { hosted_url: string | null })[];
  return rows[0] ?? null;
}

async function releaseSchedule(sub: Sub) {
  const sid = typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
  if (sid) await stripe(`subscription_schedules/${sid}/release`, {});
}

/** Credits for an immediate change: the prorated difference within a slot, or a fresh first month when a new period starts. */
function creditsForChange(c: Change, at: number) {
  const slot = slotOf(c.period.start, c.period.end, c.from.interval, at);
  const f = PLANS[c.from.plan].credits;
  const t = PLANS[c.to.plan].credits;
  return c.from.interval === c.to.interval ? prorateCredits(f, t, slot.start, slot.end, at) : intervalSwitchCredits(f, t, slot.start, slot.end, at);
}

const changeItems = (c: Change) => ({ items: { 0: { id: c.item.id, price: c.toPrice } }, proration_behavior: "always_invoice" });

/** What a change that starts now will cost today and give, using Stripe's own proration for the money. */
export async function previewChange(ctx: Ctx, to: Variant) {
  const c = await loadChange(ctx, to, "now");
  const at = nowSec();
  const preview = await stripe<{ amount_due: number; currency: string }>("invoices/create_preview", {
    customer: c.sub.customer,
    subscription: c.sub.id,
    subscription_details: { ...changeItems(c), proration_date: at },
  });
  const sameInterval = c.from.interval === c.to.interval;
  return {
    from: c.from,
    to: c.to,
    amountDue: preview.amount_due,
    currency: preview.currency,
    creditsNow: creditsForChange(c, at),
    newCredits: PLANS[c.to.plan].credits,
    renewalPence: planPricing(c.to.plan, c.to.interval).pence,
    renewalDate: sameInterval ? c.period.end : addMonths(at, c.to.interval === "year" ? 12 : 1),
    intervalChange: !sameInterval,
  };
}

/** Make the change now. Credits are only added once the invoice for it is paid. */
export async function changeNow(ctx: Ctx, to: Variant) {
  const c = await loadChange(ctx, to, "now");
  const q = await db();
  const at = nowSec();
  const credits = creditsForChange(c, at);
  const pcId = id("pc");
  const restore = ctx.workspace.pending_plan ? { plan: ctx.workspace.pending_plan, interval: ctx.workspace.pending_interval ?? "month" } : null;
  // The partial unique index allows one pending change per workspace, so repeated clicks can't start two.
  const inserted = await q`INSERT INTO plan_changes (id, workspace_id, subscription_id, from_plan, to_plan, from_interval, to_interval, credits, proration_date, restore_plan, restore_interval, created_at)
    VALUES (${pcId}, ${ctx.workspace.id}, ${c.sub.id}, ${c.from.plan}, ${c.to.plan}, ${c.from.interval}, ${c.to.interval}, ${credits}, ${at}, ${restore?.plan ?? null}, ${restore?.interval ?? null}, to_timestamp(${at}::bigint))
    ON CONFLICT DO NOTHING RETURNING id`;
  if (!inserted.length) throw new HttpError(409, "A plan change is already being processed.");
  try {
    await releaseSchedule(c.sub); // a change that starts now replaces any pending change at renewal
    const updated = await stripe<Sub>(
      `subscriptions/${c.sub.id}`,
      {
        ...changeItems(c),
        proration_date: at,
        // A same-interval change can wait for the customer to confirm with their bank. A change of billing interval
        // resets the billing cycle, which Stripe may not allow to stay pending, so it must pay or fail outright.
        payment_behavior: c.from.interval === c.to.interval ? "pending_if_incomplete" : "error_if_incomplete",
        expand: ["latest_invoice"],
      },
      "POST", undefined, `change:${pcId}`,
    );
    const invoice = typeof updated.latest_invoice === "object" ? updated.latest_invoice : null;
    if (invoice) await q`UPDATE plan_changes SET invoice_id = ${invoice.id}, hosted_url = ${invoice.hosted_invoice_url ?? null} WHERE id = ${pcId}`;
    if (invoice?.status === "paid") {
      await processPaidInvoice(invoice.id);
      return { status: "applied" as const, credits };
    }
    await syncSubscription(c.sub.id);
    return { status: "requires_action" as const, credits, url: invoice?.hosted_invoice_url ?? null };
  } catch (e) {
    await failAndRestore(pcId, e instanceof Error ? e.message : "failed");
    throw e instanceof HttpError ? e : new HttpError(402, e instanceof Error ? e.message.replace(/^Stripe: /, "") : "The payment didn't go through.");
  }
}

/** Put a schedule on the subscription that moves it to `to` when the paid period ends. */
async function scheduleChangeFor(sub: Sub, to: Variant) {
  const item = sub.items.data[0];
  const { start, end } = periodOf(sub);
  let scheduleId = typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
  if (!scheduleId) scheduleId = (await stripe<Schedule>("subscription_schedules", { from_subscription: sub.id }, "POST", undefined, `schedule:${sub.id}:${start}`)).id;
  const current = await stripe<Schedule>(`subscription_schedules/${scheduleId}`, undefined, "GET");
  await stripe(`subscription_schedules/${scheduleId}`, {
    end_behavior: "release",
    phases: {
      0: { items: { 0: { price: item.price.id, quantity: 1 } }, start_date: current.phases[0]?.start_date ?? start, end_date: end, proration_behavior: "none" },
      1: { items: { 0: { price: await ensurePrice(to), quantity: 1 } }, iterations: 1, proration_behavior: "none" },
    },
  });
  await syncSubscription(sub.id);
}

/** Schedule a change for the end of the paid period. Nothing is refunded and no credits are removed. */
export async function changeAtRenewal(ctx: Ctx, to: Variant) {
  const c = await loadChange(ctx, to, "at_renewal");
  await scheduleChangeFor(c.sub, to);
}

export async function cancelPendingChange(ctx: Ctx) {
  const subId = ctx.workspace.stripe_subscription_id;
  if (!subId) throw new HttpError(400, "You don't have a subscription.");
  await releaseSchedule(await getSub(subId));
  await syncSubscription(subId);
}

/** Abandon an upgrade that is waiting for payment (for example a bank confirmation never completed). */
export async function cancelPendingUpgrade(ctx: Ctx) {
  const pc = await pendingPlanChange(ctx.workspace.id);
  if (!pc) return;
  if (pc.invoice_id) {
    const inv = await stripe<Invoice>(`invoices/${pc.invoice_id}`, undefined, "GET");
    if (inv.status === "paid") {
      await processPaidInvoice(inv.id); // it did go through after all
      return;
    }
    if (inv.status === "open") await stripe(`invoices/${inv.id}/void`, {}).catch(() => null);
  }
  await failAndRestore(pc.id, "Cancelled by customer");
  if (ctx.workspace.stripe_subscription_id) await syncSubscription(ctx.workspace.stripe_subscription_id);
}

/** Cancel at the end of the paid period. This also drops any pending change at renewal. */
export async function cancelAtPeriodEnd(ctx: Ctx) {
  const subId = ctx.workspace.stripe_subscription_id;
  if (!subId) throw new HttpError(400, "You don't have a subscription.");
  await reconcilePlanChanges(ctx.workspace.id);
  if (await pendingPlanChange(ctx.workspace.id)) throw new HttpError(409, "A plan change is waiting for payment. Finish or cancel it first.");
  await releaseSchedule(await getSub(subId));
  await stripe(`subscriptions/${subId}`, { cancel_at_period_end: "true" });
  await syncSubscription(subId);
}

export async function reactivate(ctx: Ctx) {
  const subId = ctx.workspace.stripe_subscription_id;
  if (!subId) throw new HttpError(400, "You don't have a subscription.");
  await stripe(`subscriptions/${subId}`, { cancel_at_period_end: "false" });
  await syncSubscription(subId);
}

/** Fail a pending change and, if it replaced a scheduled change at renewal, put that schedule back. */
async function failAndRestore(planChangeId: string, error: string) {
  const q = await db();
  const rows = (await q`SELECT restore_plan, restore_interval, subscription_id, status FROM plan_changes WHERE id = ${planChangeId}`) as
    { restore_plan: string | null; restore_interval: string | null; subscription_id: string; status: string }[];
  const pc = rows[0];
  if (!pc || pc.status !== "pending") return;
  await failPlanChange(planChangeId, error);
  if (pc.restore_plan && isPlanKey(pc.restore_plan)) {
    try {
      const sub = await getSub(pc.subscription_id, ["schedule"]);
      if (sub.status === "active" || sub.status === "trialing") await scheduleChangeFor(sub, { plan: pc.restore_plan, interval: isInterval(pc.restore_interval) ? pc.restore_interval : "month" });
    } catch (e) {
      console.error("couldn't restore the scheduled change", e);
    }
  }
}

/** Settle changes left pending: apply the ones whose invoice was paid, fail the ones that never will be. */
export async function reconcilePlanChanges(workspaceId: string) {
  const q = await db();
  const rows = (await q`SELECT * FROM plan_changes WHERE workspace_id = ${workspaceId} AND status = 'pending'`) as (PlanChangeRow & { created_at: string })[];
  for (const pc of rows) {
    const ageSec = nowSec() - Math.floor(new Date(pc.created_at).getTime() / 1000);
    if (!pc.invoice_id) {
      if (ageSec > 600) await failAndRestore(pc.id, "No invoice was created");
      continue;
    }
    const inv = await stripe<Invoice>(`invoices/${pc.invoice_id}`, undefined, "GET");
    if (inv.status === "paid") await processPaidInvoice(inv.id);
    else if (inv.status === "void" || inv.status === "uncollectible" || ageSec > 86400) await failAndRestore(pc.id, `Invoice ${inv.status}`);
  }
}
