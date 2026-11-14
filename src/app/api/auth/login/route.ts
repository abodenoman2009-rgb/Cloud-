import { NextRequest } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/crypto";
import { clientIp, fail, ok } from "@/lib/api";
import { issueSession, setSessionCookie, toPublicUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const emailNorm = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!emailNorm || !password) return fail(400, "missing_credentials");

  const rows = await db.select().from(users).where(eq(users.emailNorm, emailNorm)).limit(1);
  const user = rows[0];
  if (!user) return fail(401, "invalid_credentials");
  if (!user.passwordHash) return fail(401, "use_google");
  if (!(await verifyPassword(password, user.passwordHash))) return fail(401, "invalid_credentials");
  if (!user.emailVerified) return fail(403, "email_unverified");

  const { token, expiresAt } = await issueSession(user.id, {
    userAgent: req.headers.get("user-agent"),
    ip: clientIp(req),
  });
  const response = ok({ user: toPublicUser(user) });
  setSessionCookie(response, token, expiresAt);
  return response;
}
