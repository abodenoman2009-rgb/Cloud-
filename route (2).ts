import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { randomToken, sha256Hex } from "@/lib/auth/crypto";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Starts account recovery. Emails are only sent through a real SMTP relay
 * (SMTP_URL). Without it the API refuses honestly instead of faking success.
 */
export async function POST(req: NextRequest) {
  const smtp = process.env.SMTP_URL?.trim();
  if (!smtp) return fail(503, "email_not_configured");

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const emailNorm = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(emailNorm)) return fail(400, "invalid_email");

  const rows = await db.select().from(users).where(eq(users.emailNorm, emailNorm)).limit(1);
  const user = rows[0];
  if (user) {
    const token = randomToken(32);
    await db.insert(passwordResets).values({
      userId: user.id,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    const base = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport(smtp);
      await transport.sendMail({
        from: process.env.MAIL_FROM || "Cloud Hard Drive <no-reply@localhost>",
        to: user.email,
        subject: "استعادة كلمة المرور — Cloud Hard Drive",
        text: `أعد تعيين كلمة المرور عبر هذا الرابط (صالح 30 دقيقة):\n${base}/reset?token=${token}\nإذا لم تطلب هذا تجاهل الرسالة.`,
        html: `<div dir="rtl" style="font-family:system-ui,sans-serif"><h2>استعادة كلمة المرور</h2><p>اضغط على الزر لإعادة تعيين كلمة المرور (صالح 30 دقيقة):</p><p><a href="${base}/reset?token=${token}" style="background:#FF5B22;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">إعادة التعيين</a></p></div>`,
      });
    } catch {
      return fail(502, "mail_failed");
    }
  }
  // Same response whether or not the account exists — no enumeration.
  return ok({ ok: true });
}
