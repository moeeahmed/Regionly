/**
 * A small in-memory Stripe for tests. It models only what the app calls: prices, subscriptions (with proration
 * invoices, pending payments and schedules), invoices, charges and checkout sessions. Money is approximate; what the
 * tests check is the app's handling of state, credits and sequencing.
 */
import { addMonths } from "../../lib/subscription-math";

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function parseForm(body: string) {
  const out: J = {};
  for (const pair of body ? body.split("&") : []) {
    const [k, v = ""] = pair.split("=").map(decodeURIComponent);
    const parts = k.match(/[^[\]]+/g) ?? [];
    let o = out;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) o[p] = v;
      else o = o[p] ??= {};
    });
  }
  return out;
}
const list = (o: unknown): unknown[] => (o && typeof o === "object" ? Object.values(o) : []);

export class FakeStripe {
  now = Math.floor(Date.now() / 1000);
  prices = new Map<string, J>();
  subs = new Map<string, J>();
  invoices = new Map<string, J>();
  schedules = new Map<string, J>();
  charges = new Map<string, J>();
  sessions: J[] = [];
  /** What the next card payment does: succeed, be declined, or need the customer to confirm. */
  nextPayment: "paid" | "fail" | "action" = "paid";
  calls: { method: string; path: string; body: J }[] = [];
  private n = 0;
  private realFetch = globalThis.fetch;
  private realNow = Date.now;

  id(prefix: string) {
    return `${prefix}_${++this.n}`;
  }
  install() {
    globalThis.fetch = this.handle.bind(this) as typeof fetch;
    Date.now = () => this.now * 1000;
  }
  uninstall() {
    globalThis.fetch = this.realFetch;
    Date.now = this.realNow;
  }
  advance(seconds: number) {
    this.now += seconds;
  }

  /* ----- helpers tests use to simulate Stripe itself ----- */

  createSubscription(workspaceId: string, priceId: string, opts: { amount?: number } = {}) {
    const price = this.prices.get(priceId)!;
    const months = price.recurring.interval === "year" ? 12 : 1;
    const sub: J = {
      id: this.id("sub"), status: "active", customer: this.id("cus"), metadata: { workspace_id: workspaceId },
      priceId, start: this.now, end: addMonths(this.now, months), cancel_at_period_end: false, schedule: null, pending: null, latest: null,
    };
    this.subs.set(sub.id, sub);
    const inv = this.makeInvoice(sub, "subscription_create", "paid", opts.amount ?? price.unit_amount, [{ price: priceId, proration: false, start: sub.start, end: sub.end }]);
    return { sub, invoice: inv };
  }

  /** The next billing period begins: apply any scheduled phase change and issue a paid renewal invoice. */
  renew(subId: string) {
    const sub = this.subs.get(subId)!;
    this.now = Math.max(this.now, sub.end);
    const sch = sub.schedule ? this.schedules.get(sub.schedule) : null;
    if (sch && sch.status === "active" && sch.phases[1]) {
      sub.priceId = sch.phases[1].items[0].price;
      sch.status = "released";
      sub.schedule = null;
    }
    const months = this.prices.get(sub.priceId)!.recurring.interval === "year" ? 12 : 1;
    sub.start = sub.end;
    sub.end = addMonths(sub.start, months);
    return this.makeInvoice(sub, "subscription_cycle", "paid", this.prices.get(sub.priceId)!.unit_amount, [{ price: sub.priceId, proration: false, start: sub.start, end: sub.end }]);
  }

  payInvoice(invoiceId: string) {
    const inv = this.invoices.get(invoiceId)!;
    inv.status = "paid";
    const sub = this.subs.get(inv.subscription)!;
    if (sub.pending) this.applyChange(sub, sub.pending.priceId);
    sub.pending = null;
  }

  deleteSubscription(subId: string) {
    this.subs.get(subId)!.status = "canceled";
  }

  addPaidCharge(opts: { amount: number; invoice?: string; sessionId?: string }) {
    const c: J = { id: this.id("ch"), amount: opts.amount, amount_refunded: 0, payment_intent: this.id("pi"), invoice: opts.invoice ?? null };
    this.charges.set(c.id, c);
    if (opts.sessionId) this.sessions.push({ id: opts.sessionId, payment_intent: c.payment_intent });
    return c;
  }

  /* ----- internals ----- */

  private subView(sub: J, expand: string[] = []) {
    const price = this.prices.get(sub.priceId)!;
    return {
      id: sub.id, status: sub.status, customer: sub.customer, metadata: sub.metadata,
      items: { data: [{ id: `si_${sub.id}`, price, current_period_start: sub.start, current_period_end: sub.end }] },
      cancel_at_period_end: sub.cancel_at_period_end,
      schedule: sub.schedule ? (expand.includes("schedule") ? this.scheduleView(this.schedules.get(sub.schedule)!) : sub.schedule) : null,
      pending_update: sub.pending ? { expires_at: this.now + 82800 } : null,
      latest_invoice: sub.latest ? (expand.includes("latest_invoice") ? this.invoices.get(sub.latest) : sub.latest) : null,
    };
  }
  private scheduleView(s: J) {
    return { id: s.id, status: s.status, subscription: s.subscription, phases: s.phases };
  }
  private makeInvoice(sub: J, reason: string, status: string, amount: number, lines: { price: string; proration: boolean; start: number; end: number }[]) {
    const inv: J = {
      id: this.id("in"), status, billing_reason: reason, subscription: sub.id, amount_due: amount, hosted_invoice_url: `https://pay.test/${this.n}`,
      lines: { data: lines.map((l) => ({ proration: l.proration, price: { id: l.price }, period: { start: l.start, end: l.end } })) },
    };
    this.invoices.set(inv.id, inv);
    sub.latest = inv.id;
    return inv;
  }
  private applyChange(sub: J, priceId: string) {
    const from = this.prices.get(sub.priceId)!;
    const to = this.prices.get(priceId)!;
    sub.priceId = priceId;
    if (from.recurring.interval !== to.recurring.interval) {
      sub.start = this.now;
      sub.end = addMonths(this.now, to.recurring.interval === "year" ? 12 : 1);
    }
  }
  private prorated(sub: J, priceId: string) {
    const from = this.prices.get(sub.priceId)!;
    const to = this.prices.get(priceId)!;
    const f = Math.min(1, Math.max(0, (sub.end - this.now) / (sub.end - sub.start)));
    return from.recurring.interval === to.recurring.interval ? Math.round((to.unit_amount - from.unit_amount) * f) : Math.round(to.unit_amount - from.unit_amount * f);
  }

  private async handle(input: string | URL | Request, init?: RequestInit) {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "api.stripe.com") return this.realFetch(input, init);
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/v1\//, "");
    const body: J = method === "GET" ? parseForm(url.search.slice(1)) : parseForm(String(init?.body ?? ""));
    this.calls.push({ method, path, body });
    try {
      return Response.json(this.route(method, path, body));
    } catch (e) {
      const err = e as { status?: number; message: string };
      return Response.json({ error: { message: err.message } }, { status: err.status ?? 400 });
    }
  }

  private fail(message: string, status = 400): never {
    throw Object.assign(new Error(message), { status });
  }

  private route(method: string, path: string, b: J): unknown {
    const seg = path.split("/");
    const expand = list(b.expand) as string[];

    if (seg[0] === "prices") {
      if (method === "GET" && !seg[1]) {
        const keys = list(b.lookup_keys);
        return { data: [...this.prices.values()].filter((p) => keys.includes(p.lookup_key)) };
      }
      if (method === "GET") return this.prices.get(seg[1]) ?? this.fail("No such price", 404);
      if ([...this.prices.values()].some((p) => p.lookup_key === b.lookup_key)) this.fail("lookup_key already exists");
      const p = { id: this.id("price"), unit_amount: Number(b.unit_amount), currency: b.currency, recurring: b.recurring, lookup_key: b.lookup_key, metadata: b.metadata ?? {} };
      this.prices.set(p.id, p);
      return p;
    }

    if (seg[0] === "subscriptions") {
      const sub = this.subs.get(seg[1]) ?? this.fail("No such subscription", 404);
      if (method === "GET") return this.subView(sub, expand);
      if (b.cancel_at_period_end !== undefined) sub.cancel_at_period_end = b.cancel_at_period_end === "true";
      if (b.items) {
        if (sub.schedule && this.schedules.get(sub.schedule)?.status === "active") this.fail("This subscription is managed by a subscription schedule");
        const priceId = (b.items["0"] as J).price;
        const amount = this.prorated(sub, priceId);
        const to = this.prices.get(priceId)!;
        const lines = [
          { price: sub.priceId, proration: true, start: this.now, end: sub.end },
          { price: priceId, proration: true, start: this.now, end: sub.end },
        ];
        if (this.nextPayment === "fail") this.fail("Your card was declined.", 402);
        if (this.nextPayment === "action") {
          this.makeInvoice(sub, "subscription_update", "open", amount, lines);
          sub.pending = { priceId };
        } else {
          this.applyChange(sub, priceId);
          const inv = this.makeInvoice(sub, "subscription_update", "paid", amount, lines);
          if (to.recurring.interval) inv.lines.data.push({ proration: false, price: { id: priceId }, period: { start: sub.start, end: sub.end } });
        }
      }
      return this.subView(sub, expand);
    }

    if (seg[0] === "subscription_schedules") {
      if (method === "POST" && !seg[1]) {
        const sub = this.subs.get(b.from_subscription) ?? this.fail("No such subscription", 404);
        if (sub.schedule) this.fail("Already has a schedule");
        const s = { id: this.id("sub_sched"), status: "active", subscription: sub.id, phases: [{ start_date: sub.start, end_date: sub.end, items: [{ price: sub.priceId }] }] };
        this.schedules.set(s.id, s);
        sub.schedule = s.id;
        return this.scheduleView(s);
      }
      const s = this.schedules.get(seg[1]) ?? this.fail("No such schedule", 404);
      if (method === "GET") return this.scheduleView(s);
      if (seg[2] === "release") {
        s.status = "released";
        this.subs.get(s.subscription)!.schedule = null;
        return this.scheduleView(s);
      }
      const ph = list(b.phases) as J[];
      const first = { start_date: Number(ph[0].start_date), end_date: Number(ph[0].end_date), items: [{ price: (ph[0].items["0"] as J).price }] };
      s.phases = [first, { start_date: first.end_date, end_date: null, items: [{ price: (ph[1].items["0"] as J).price }] }];
      return this.scheduleView(s);
    }

    if (seg[0] === "invoices") {
      if (seg[1] === "create_preview") {
        const sub = this.subs.get(b.subscription)!;
        const priceId = (b.subscription_details.items["0"] as J).price;
        return { amount_due: this.prorated(sub, priceId), currency: "gbp" };
      }
      const inv = this.invoices.get(seg[1]) ?? this.fail("No such invoice", 404);
      if (seg[2] === "void") {
        if (inv.status !== "open") this.fail("Only open invoices can be voided");
        inv.status = "void";
        const sub = this.subs.get(inv.subscription);
        if (sub) sub.pending = null;
      }
      return inv;
    }

    if (seg[0] === "charges") return this.charges.get(seg[1]) ?? this.fail("No such charge", 404);
    if (seg[0] === "invoice_payments") this.fail("Unrecognized request URL", 404);
    if (seg[0] === "checkout" && seg[1] === "sessions") return { data: this.sessions.filter((s) => s.payment_intent === b.payment_intent) };
    this.fail(`FakeStripe: unhandled ${method} ${path}`, 501);
  }
}
