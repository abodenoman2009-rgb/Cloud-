import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/crypto";
import { issueSession, setSessionCookie, toPublicUser, cookieSecure } from "@/lib/auth/session";
import { clientIp, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    password?: string;
  };
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!name) return fail(400, "name_required");
  if (!EMAIL_RE.test(email)) return fail(400, "invalid_email");
  if (password.length < 8) return fail(400, "weak_password");

  const emailNorm = email.toLowerCase();
  const existing = await db
    .select({ id: users.id, provider: users.provider })
    .from(users)
    .where(eq(users.emailNorm, emailNorm))
    .limit(1);
  if (existing.length) return fail(409, "email_exists");

  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(users)
    .values({ name, email, emailNorm, passwordHash, provider: "email" })
    .returning();

  const user = inserted[0];
  const { token, expiresAt } = await issueSession(user.id, {
    userAgent: req.headers.get("user-agent"),
    ip: clientIp(req),
  });
  const res = ok({ user: toPublicUser(user) }, { status: 201 });
  setSessionCookie(res, token, expiresAt);
  void cookieSecure;
  return res;
}
