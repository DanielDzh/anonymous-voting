import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS } from "@/config/voting";
import { isHttpsRequest } from "@/lib/request-security";

type AdminEnv = { email: string; password: string; secret: string };

const readAdminEnv = (): AdminEnv | null => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SESSION_SECRET) return null;
  return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, secret: SESSION_SECRET };
};

export const isAdminConfigured = (): boolean => readAdminEnv() !== null;

const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

const sign = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export const checkCredentials = (email: string, password: string): boolean => {
  const env = readAdminEnv();
  if (!env) return false;
  // Evaluate both so timing does not reveal which one was wrong.
  const emailOk = safeEqual(email.trim().toLowerCase(), env.email.trim().toLowerCase());
  const passwordOk = safeEqual(password, env.password);
  return emailOk && passwordOk;
};

export const startAdminSession = async (): Promise<void> => {
  const env = readAdminEnv();
  if (!env) return;
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, `${payload}.${sign(payload, env.secret)}`, {
    httpOnly: true,
    secure: await isHttpsRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
};

export const endAdminSession = async (): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
};

export const isAdmin = async (): Promise<boolean> => {
  // Session expiry compares against the current time, so this must never be prerendered.
  await connection();
  const env = readAdminEnv();
  if (!env) return false;
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!value) return false;

  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, env.secret))) return false;
  return Number(payload) > Math.floor(Date.now() / 1000);
};
