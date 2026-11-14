import { cookies } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { randomToken, sha256Hex } from "./crypto";

export const SESSION_COOKIE = "chd_session";
const SESSION_TTL_DAYS = 30;

export type { PublicUser } from "@/lib/types";
import type { PublicUser } from "@/lib/types";

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    picture: u.picture,
    provider: u.provider,
    quotaBytes: u.quotaBytes,
    autoUpload: u.autoUpload,
    wifiOnly: u.wifiOnly,
    createdAt: u.createdAt.toISOString(),
  };
}

export function cookieSecure(): boolean {
  return (process.env.APP_BASE_URL || "").startsWith("https://");
}

export async function issueSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256Hex(token),
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ip: meta.ip ?? null,
    expiresAt,
  });
  return { token, expiresAt };
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

async function tokenFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Only verified accounts can resolve to an authenticated session user. */
export async function getSessionUser(): Promise<User | null> {
  const token = await tokenFromCookie();
  if (!token) return null;
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.tokenHash, sha256Hex(token)),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, new Date()),
      eq(users.emailVerified, true),
    ))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function revokeCurrentSession(): Promise<void> {
  const token = await tokenFromCookie();
  if (!token) return;
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256Hex(token)));
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, userId));
}
