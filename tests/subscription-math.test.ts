import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, classifyChange, decideInvoiceGrant, intervalSwitchCredits, monthlyAllocationsDue, prorateCredits, reversalNeeded, slotOf, type InvoiceFacts } from "../lib/subscription-math";

const DAY = 86400;
const START = 1_700_000_000;
const THIRTY = START + 30 * DAY;

test("halfway upgrade from 200 to 800 credits grants 300 extra", () => {
  assert.equal(prorateCredits(200, 800, START, THIRTY, START + 15 * DAY), 300);
});

test("upgrade at the start of the period grants the full difference, and never more", () => {
  assert.equal(prorateCredits(200, 800, START, THIRTY, START), 600);
  assert.equal(prorateCredits(200, 800, START, THIRTY, START - 5 * DAY), 600);
});

test("upgrade near the end of the period rounds half up to whole credits", () => {
  assert.equal(prorateCredits(200, 800, START, THIRTY, THIRTY - 3600), 1); // 0.83 -> 1
  assert.equal(prorateCredits(200, 800, START, THIRTY, THIRTY - 1200), 0); // 0.28 -> 0
  assert.equal(prorateCredits(200, 800, START, THIRTY, THIRTY), 0);
  assert.equal(prorateCredits(0, 3, START, START + 2, START + 1), 2); // 1.5 -> 2
});

test("proration uses the real period length, not a 30-day month", () => {
  const feb = START + 28 * DAY;
  assert.equal(prorateCredits(200, 800, START, feb, START + 14 * DAY), 300);
  assert.equal(prorateCredits(200, 800, START, feb, START + 21 * DAY), 150);
  const long = START + 31 * DAY;
  assert.equal(prorateCredits(200, 800, START, long, START + 31 * DAY / 2), 300);
});

test("successive upgrades each grant only their own increment", () => {
  const first = prorateCredits(200, 500, START, THIRTY, START + 15 * DAY); // 150
  const second = prorateCredits(500, 800, START, THIRTY, START + 22.5 * DAY); // 300 * 0.25 = 75
  assert.equal(first, 150);
  assert.equal(second, 75);
  assert.ok(first + second < prorateCredits(200, 800, START, THIRTY, START)); // never over-allocates
});

test("a downgrade or same plan grants no proration credits", () => {
  assert.equal(prorateCredits(800, 200, START, THIRTY, START + 15 * DAY), 0);
  assert.equal(prorateCredits(200, 200, START, THIRTY, START + 15 * DAY), 0);
});

test("changes with more credits start now; fewer credits wait for renewal", () => {
  const starter = { credits: 200, interval: "month" as const };
  const growth = { credits: 800, interval: "month" as const };
  assert.equal(classifyChange(starter, growth), "now");
  assert.equal(classifyChange(growth, starter), "at_renewal");
  assert.equal(classifyChange(starter, starter), "same");
  assert.equal(classifyChange(undefined, starter), "now");
});

test("switching interval at the same tier: monthly to annual now, annual to monthly at renewal", () => {
  const m = { credits: 200, interval: "month" as const };
  const y = { credits: 200, interval: "year" as const };
  assert.equal(classifyChange(m, y), "now");
  assert.equal(classifyChange(y, m), "at_renewal");
  assert.equal(classifyChange({ credits: 800, interval: "year" }, { credits: 200, interval: "year" }), "at_renewal");
  assert.equal(classifyChange({ credits: 200, interval: "year" }, { credits: 800, interval: "month" }), "now");
});

test("addMonths keeps the day, clamps short months, and handles year ends", () => {
  const t = (s: string) => Math.floor(Date.parse(s) / 1000);
  assert.equal(addMonths(t("2026-01-31T10:00:00Z"), 1), t("2026-02-28T10:00:00Z"));
  assert.equal(addMonths(t("2024-01-31T10:00:00Z"), 1), t("2024-02-29T10:00:00Z"));
  assert.equal(addMonths(t("2026-11-15T00:00:00Z"), 3), t("2027-02-15T00:00:00Z"));
  assert.equal(addMonths(t("2026-03-10T00:00:00Z"), 12), t("2027-03-10T00:00:00Z"));
});

test("annual plans are split into twelve monthly slots", () => {
  const ps = Math.floor(Date.parse("2026-03-10T00:00:00Z") / 1000);
  const pe = addMonths(ps, 12);
  assert.deepEqual(slotOf(ps, pe, "year", ps).index, 0);
  assert.deepEqual(slotOf(ps, pe, "year", addMonths(ps, 5) + 10).index, 5);
  assert.deepEqual(slotOf(ps, pe, "year", pe - 1).index, 11);
  const s = slotOf(ps, pe, "year", addMonths(ps, 2) + 100);
  assert.equal(s.start, addMonths(ps, 2));
  assert.equal(s.end, addMonths(ps, 3));
  assert.deepEqual(slotOf(ps, THIRTY, "month", ps + 5), { start: ps, end: THIRTY, index: 0 });
});

test("months due on an annual plan: only started months, never month 0, never past the year", () => {
  const ps = Math.floor(Date.parse("2026-03-10T00:00:00Z") / 1000);
  const pe = addMonths(ps, 12);
  assert.deepEqual(monthlyAllocationsDue(ps, pe, ps + 100), []);
  assert.deepEqual(monthlyAllocationsDue(ps, pe, addMonths(ps, 1)), [1]);
  assert.deepEqual(monthlyAllocationsDue(ps, pe, addMonths(ps, 3) + 5), [1, 2, 3]); // catches up missed months
  assert.equal(monthlyAllocationsDue(ps, pe, pe + 10 * DAY).length, 11);
});

test("an annual upgrade prorates over the current month slot, not the whole year", () => {
  const ps = Math.floor(Date.parse("2026-03-10T00:00:00Z") / 1000);
  const pe = addMonths(ps, 12);
  const at = addMonths(ps, 4) + Math.floor((addMonths(ps, 5) - addMonths(ps, 4)) / 2);
  const slot = slotOf(ps, pe, "year", at);
  assert.equal(prorateCredits(200, 800, slot.start, slot.end, at), 300);
});

test("switching interval grants the new first month less the unused share of the old one", () => {
  // Starter monthly, halfway through: 200 x 0.5 = 100 unused. Moving to Growth annual grants 800 - 100.
  assert.equal(intervalSwitchCredits(200, 800, START, THIRTY, START + 15 * DAY), 700);
  // Same tier, halfway: 200 - 100.
  assert.equal(intervalSwitchCredits(200, 200, START, THIRTY, START + 15 * DAY), 100);
  // Right at the start nothing has been used, so only the difference is new.
  assert.equal(intervalSwitchCredits(200, 200, START, THIRTY, START), 0);
  // Never negative.
  assert.equal(intervalSwitchCredits(800, 200, START, THIRTY, START), 0);
  // At the very end the old month is used up, so the full first month is granted.
  assert.equal(intervalSwitchCredits(200, 200, START, THIRTY, THIRTY), 200);
});

test("refund reversals are proportional, cumulative and capped at what was granted", () => {
  assert.equal(reversalNeeded(100, 0, 1900, 1900), 100); // full refund
  assert.equal(reversalNeeded(100, 0, 950, 1900), 50); // half
  assert.equal(reversalNeeded(100, 50, 1900, 1900), 50); // the rest of a refund that came in two parts
  assert.equal(reversalNeeded(100, 100, 1900, 1900), 0); // nothing left to take back
  assert.equal(reversalNeeded(100, 0, 99999, 1900), 100); // over-refund can't take more than was granted
  assert.equal(reversalNeeded(0, 0, 1900, 1900), 0);
});

const paid = (over: Partial<InvoiceFacts> = {}): InvoiceFacts => ({
  id: "in_1", status: "paid", billingReason: "subscription_cycle", subscriptionId: "sub_1", planKey: "growth", periodStart: START, ...over,
});

test("an unpaid or failed invoice grants nothing", () => {
  for (const status of ["open", "draft", "uncollectible", "void"]) {
    assert.equal(decideInvoiceGrant(paid({ status })).kind, "none");
  }
});

test("renewals and the first payment allocate the plan's credits once per period", () => {
  const first = decideInvoiceGrant(paid({ billingReason: "subscription_create" }));
  const retry = decideInvoiceGrant(paid({ id: "in_retry", billingReason: "subscription_create" }));
  assert.deepEqual(first, { kind: "allocation", key: `alloc:sub_1:${START}`, planKey: "growth" });
  assert.deepEqual(retry, first); // same period, same key, so the ledger refuses a second grant
  const next = decideInvoiceGrant(paid({ id: "in_2", periodStart: THIRTY }));
  assert.equal(next.kind === "allocation" && next.key, `alloc:sub_1:${THIRTY}`);
});

test("an upgrade invoice never triggers a full-period allocation", () => {
  assert.deepEqual(decideInvoiceGrant(paid({ billingReason: "subscription_update" })), { kind: "plan_change" });
});

test("other invoices and non-subscription invoices grant nothing", () => {
  assert.equal(decideInvoiceGrant(paid({ billingReason: "manual" })).kind, "none");
  assert.equal(decideInvoiceGrant(paid({ subscriptionId: null })).kind, "none");
  assert.equal(decideInvoiceGrant(paid({ planKey: null })).kind, "none");
});
