/**
 * Pure subscription rules: no database, no Stripe, no app imports, so they can be tested directly.
 * Timestamps are unix seconds taken from the real billing period (never an assumed 30-day month).
 *
 * Credits are allocated in "slots". A monthly plan has one slot per billing period. An annual plan has twelve
 * monthly slots inside its year, so annual customers get a month of credits at a time, not a year up front.
 */

export type Interval = "month" | "year";
export type PlanLike = { credits: number; interval: Interval };

/** `unix` plus `n` calendar months (UTC), keeping the day of month where the target month has it. */
export function addMonths(unix: number, n: number) {
  const d = new Date(unix * 1000);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return Math.floor(t.getTime() / 1000);
}

/** The credit slot containing `at`: the whole period for monthly plans, one of twelve months for annual plans. */
export function slotOf(periodStart: number, periodEnd: number, interval: Interval, at: number) {
  if (interval === "month") return { start: periodStart, end: periodEnd, index: 0 };
  let index = 0;
  while (index < 11 && addMonths(periodStart, index + 1) <= at) index++;
  return { start: addMonths(periodStart, index), end: Math.min(addMonths(periodStart, index + 1), periodEnd), index };
}

/** Monthly slots of an annual period (1 to 11) that have started and have not yet been allocated by an invoice. */
export function monthlyAllocationsDue(periodStart: number, periodEnd: number, at: number) {
  const due: number[] = [];
  for (let k = 1; k <= 11; k++) {
    const start = addMonths(periodStart, k);
    if (start <= at && start < periodEnd) due.push(k);
  }
  return due;
}

/**
 * Extra credits for upgrading part-way through a slot:
 *   (new credits - old credits) x (time left in slot / slot length)
 * Rounded half up to a whole credit. Never negative, and clamped to the slot's bounds.
 */
export function prorateCredits(oldCredits: number, newCredits: number, slotStart: number, slotEnd: number, at: number) {
  const diff = newCredits - oldCredits;
  const total = slotEnd - slotStart;
  if (diff <= 0 || total <= 0) return 0;
  const left = Math.min(Math.max(slotEnd - at, 0), total);
  return Math.round((diff * left) / total);
}

/**
 * Credits for a change that starts a new billing period straight away (monthly to annual, or annual to monthly).
 * The new plan's first month is granted, less the unused share of the month already granted on the old plan
 * (that unused share is what Stripe credits back as money). Never negative. Existing credits are untouched.
 */
export function intervalSwitchCredits(oldCredits: number, newCredits: number, slotStart: number, slotEnd: number, at: number) {
  const total = slotEnd - slotStart;
  const fractionLeft = total > 0 ? Math.min(Math.max(slotEnd - at, 0), total) / total : 0;
  return Math.max(0, Math.round(newCredits - oldCredits * fractionLeft));
}

/**
 * How a move between plans takes effect:
 *  - "now": more credits a month, or the same credits switching monthly to annual. Charged and applied immediately.
 *  - "at_renewal": fewer credits, or the same credits switching annual to monthly. Applied when the paid period ends.
 */
export function classifyChange(from: PlanLike | undefined, to: PlanLike): "now" | "at_renewal" | "same" {
  if (!from) return "now";
  if (to.credits !== from.credits) return to.credits > from.credits ? "now" : "at_renewal";
  if (to.interval === from.interval) return "same";
  return to.interval === "year" ? "now" : "at_renewal";
}

export type InvoiceFacts = {
  id: string;
  status: string;
  billingReason: string;
  subscriptionId: string | null;
  /** Plan on the invoice's recurring (non-proration) line, if any. */
  planKey: string | null;
  /** Start of the billing period that line covers (unix seconds). */
  periodStart: number | null;
};

export type InvoiceDecision =
  | { kind: "allocation"; key: string; planKey: string }
  | { kind: "plan_change" }
  | { kind: "none"; reason: string };

/**
 * What a paid invoice should do to credits.
 *  - Initial invoice and renewals: one allocation (the first month, for annual plans) per subscription period.
 *  - Plan-change invoice: the credits recorded for that change, nothing else.
 *  - Anything unpaid, or any other kind of invoice: nothing.
 * The allocation key depends on the period, not the invoice, so two invoices for one period can't both grant.
 */
export function decideInvoiceGrant(f: InvoiceFacts): InvoiceDecision {
  if (f.status !== "paid") return { kind: "none", reason: "invoice not paid" };
  if (!f.subscriptionId) return { kind: "none", reason: "not a subscription invoice" };
  if (f.billingReason === "subscription_create" || f.billingReason === "subscription_cycle") {
    if (!f.planKey || f.periodStart == null) return { kind: "none", reason: "plan or period unknown" };
    return { kind: "allocation", key: `alloc:${f.subscriptionId}:${f.periodStart}`, planKey: f.planKey };
  }
  if (f.billingReason === "subscription_update") return { kind: "plan_change" };
  return { kind: "none", reason: `billing reason ${f.billingReason}` };
}

/** Credits to take back for a refund: the granted credits in proportion to the refunded share, less what was already reversed. */
export function reversalNeeded(granted: number, alreadyReversed: number, refunded: number, charged: number) {
  if (charged <= 0 || granted <= 0) return 0;
  const target = Math.round(granted * Math.min(Math.max(refunded / charged, 0), 1));
  return Math.max(0, target - alreadyReversed);
}
