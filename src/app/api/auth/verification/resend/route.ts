import { NextRequest } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import {
  newVerificationCode,
  sendVerificationEmail,
  VERIFICATION_TTL_MS,
  verificationCodeHash,
  verificationResendPolicy,
  RESEND_WAIT_MS,
} from "@/lib/auth/email-verification";

export const dynamic = "force-dynamic";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const emailNorm = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(emailNorm)) return fail(400, "invalid_email");
  if (!process.env.SMTP_URL?.trim() || !process.env.MAIL_FROM?.trim()) return fail(503, "email_not_configured");

  const userRows = await db.select().from(users).where(eq(users.emailNorm, emailNorm)).limit(1);
  const user = userRows[0];
  if (!user || user.provider !== "email") return fail(404, "verification_unavailable");
  if (user.emailVerified) return fail(409, "already_verified");

  const now = new Date();
  const code = newVerificationCode();
  const nextAvailable = new Date(now.getTime() + RESEND_WAIT_MS);
  const change = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM email_verifications WHERE user_id = ${user.id} FOR UPDATE`);
    const rows = await tx.select().from(emailVerifications).where(eq(emailVerifications.userId, user.id)).limit(1);
    const challenge = rows[0];
    if (!challenge || challenge.usedAt) return "verification_unavailable" as const;
    if (challenge.resendAvailableAt > now) return "resend_too_soon" as const;

    const windowExpired = now.getTime() - challenge.resendWindowStartedAt.getTime() >= verificationResendPolicy.windowMs;
    if (!windowExpired && challenge.resendCount >= verificationResendPolicy.maxPerWindow) return "resend_limit" as const;
    await tx.update(emailVerifications).set({
      codeHash: verificationCodeHash(user.id, code),
      expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
      usedAt: null,
      attempts: 0,
      resendAvailableAt: nextAvailable,
      resendWindowStartedAt: windowExpired ? now : challenge.resendWindowStartedAt,
      resendCount: windowExpired ? 1 : sql`${emailVerifications.resendCount} + 1`,
      createdAt: now,
    }).where(eq(emailVerifications.id, challenge.id));
    return "sent" as const;
  });

  if (change !== "sent") {
    const status = change === "resend_too_soon" || change === "resend_limit" ? 429 : 404;
    return fail(status, change);
  }

  try {
    await sendVerificationEmail(user.email, user.name, code);
  } catch {
    // Delivery can be retried immediately after a provider/network failure.
    await db.update(emailVerifications)
      .set({ resendAvailableAt: new Date() })
      .where(and(eq(emailVerifications.userId, user.id), gt(emailVerifications.expiresAt, new Date())));
    return fail(502, "mail_failed");
  }
  return ok({ sent: true, resendAfterSeconds: 60 });
}
