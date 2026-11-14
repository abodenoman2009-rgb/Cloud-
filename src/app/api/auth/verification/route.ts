import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { clientIp, fail, ok } from "@/lib/api";
import { verificationCodeHash } from "@/lib/auth/email-verification";
import { issueSession, setSessionCookie, toPublicUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
  const emailNorm = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();
  if (!EMAIL_RE.test(emailNorm)) return fail(400, "invalid_email");
  if (!/^\d{6}$/.test(code)) return fail(400, "invalid_code");

  const userRows = await db.select().from(users).where(eq(users.emailNorm, emailNorm)).limit(1);
  const user = userRows[0];
  if (!user || user.provider !== "email") return fail(400, "verification_unavailable");
  if (user.emailVerified) return fail(409, "already_verified");

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM email_verifications WHERE user_id = ${user.id} FOR UPDATE`);
    const rows = await tx.select().from(emailVerifications).where(eq(emailVerifications.userId, user.id)).limit(1);
    const challenge = rows[0];
    if (!challenge || challenge.usedAt) return "verification_unavailable" as const;
    const now = new Date();
    if (challenge.expiresAt <= now) return "code_expired" as const;
    if (challenge.attempts >= MAX_ATTEMPTS) return "too_many_attempts" as const;
    if (challenge.codeHash !== verificationCodeHash(user.id, code)) {
      await tx.update(emailVerifications)
        .set({ attempts: sql`${emailVerifications.attempts} + 1` })
        .where(eq(emailVerifications.id, challenge.id));
      return "invalid_code" as const;
    }

    const consumed = await tx.update(emailVerifications)
      .set({ usedAt: now })
      .where(and(
        eq(emailVerifications.id, challenge.id),
        isNull(emailVerifications.usedAt),
        gt(emailVerifications.expiresAt, now),
      ))
      .returning({ id: emailVerifications.id });
    if (!consumed.length) return "code_expired" as const;

    const updated = await tx.update(users)
      .set({ emailVerified: true, updatedAt: now })
      .where(and(eq(users.id, user.id), eq(users.emailVerified, false)))
      .returning();
    return updated[0] ?? "already_verified" as const;
  });

  if (typeof result === "string") {
    const status = result === "verification_unavailable" ? 404 : result === "already_verified" ? 409 : result === "too_many_attempts" ? 429 : 400;
    return fail(status, result);
  }

  const { token, expiresAt } = await issueSession(result.id, {
    userAgent: req.headers.get("user-agent"),
    ip: clientIp(req),
  });
  const response = ok({ user: toPublicUser(result) });
  setSessionCookie(response, token, expiresAt);
  return response;
}
