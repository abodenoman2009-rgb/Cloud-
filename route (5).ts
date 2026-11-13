import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/crypto";
import { issueSession, setSessionCookie, toPublicUser } from "@/lib/auth/session";
import { clientIp, fail, ok } from "@/lib/api";

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

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return fail(401, "invalid_credentials");

  const { token, expiresAt } = await issueSession(user.id, {
    userAgent: req.headers.get("user-agent"),
    ip: clientIp(req),
  });
  const res = ok({ user: toPublicUser(user) });
  setSessionCookie(res, token, expiresAt);
  return res;
}
