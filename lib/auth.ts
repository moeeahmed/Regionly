import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, id } from "./db";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "rg_session";
const WS_COOKIE = "rg_ws";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [, saltHex, keyHex] = stored.split("$");
  if (!saltHex || !keyHex) return false;
  const key = await scrypt(pw, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${userId}.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(WS_COOKIE);
}

export async function setActiveWorkspace(workspaceId: string) {
  const jar = await cookies();
  jar.set(WS_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

async function readUserId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  const expected = sign(`${uid}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return uid;
}

export type Ctx = {
  user: { id: string; email: string; name: string };
  workspace: { id: string; name: string; credits: number; plan: string; stripe_customer_id: string | null; stripe_subscription_id: string | null };
  role: string;
  workspaces: { id: string; name: string; role: string }[];
};

export async function getCtx(): Promise<Ctx | null> {
  const uid = await readUserId();
  if (!uid) return null;
  const q = await db();
  const users = (await q`SELECT id, email, name FROM users WHERE id = ${uid}`) as Ctx["user"][];
  if (!users[0]) return null;
  const memberships = (await q`
    SELECT w.id, w.name, m.role FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ${uid} ORDER BY m.created_at ASC`) as Ctx["workspaces"];
  if (!memberships.length) return null;
  const jar = await cookies();
  const wanted = jar.get(WS_COOKIE)?.value;
  const active = memberships.find((m) => m.id === wanted) ?? memberships[0];
  const ws = (await q`SELECT id, name, credits, plan, stripe_customer_id, stripe_subscription_id FROM workspaces WHERE id = ${active.id}`) as Ctx["workspace"][];
  return { user: users[0], workspace: ws[0], role: active.role, workspaces: memberships };
}

export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  return ctx;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) throw new HttpError(401, "Not signed in");
  return ctx;
}

export function jsonError(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : "Unexpected error";
  if (status === 500) console.error(e);
  return Response.json({ error: message }, { status });
}

export const SIGNUP_CREDITS = Number(process.env.SIGNUP_CREDITS ?? 30);

export async function createUserWithWorkspace(email: string, name: string, password: string) {
  const q = await db();
  const existing = await q`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length) throw new HttpError(409, "An account with that email already exists");
  const userId = id("usr");
  const wsId = id("ws");
  const hash = await hashPassword(password);
  await q`INSERT INTO users (id, email, name, password_hash) VALUES (${userId}, ${email}, ${name}, ${hash})`;
  await q`INSERT INTO workspaces (id, name, credits) VALUES (${wsId}, ${(name || email.split("@")[0]) + "'s workspace"}, ${SIGNUP_CREDITS})`;
  await q`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${wsId}, ${userId}, 'owner')`;
  if (SIGNUP_CREDITS > 0) {
    await q`INSERT INTO credit_ledger (id, workspace_id, delta, reason) VALUES (${id("cl")}, ${wsId}, ${SIGNUP_CREDITS}, 'Welcome credits')`;
  }
  return userId;
}
