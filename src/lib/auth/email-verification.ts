import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { sha256Hex } from "@/lib/auth/crypto";

export const VERIFICATION_TTL_MS = 10 * 60 * 1000;
export const RESEND_WAIT_MS = 60 * 1000;
const RESEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_RESENDS_PER_HOUR = 5;

export function newVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function verificationCodeHash(userId: string, code: string): string {
  return sha256Hex(`${userId}:${code}`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

export async function sendVerificationEmail(to: string, name: string, code: string): Promise<void> {
  const smtp = process.env.SMTP_URL?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!smtp || !from) throw new Error("email_not_configured");

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport(smtp);
  const safeName = escapeHtml(name);
  await transport.sendMail({
    from,
    to,
    subject: "رمز تأكيد بريدك الإلكتروني — Cloud Hard Drive",
    text: `مرحباً ${name}،\n\nرمز التحقق الخاص بك هو: ${code}\nينتهي الرمز خلال 10 دقائق. إذا لم تطلب إنشاء الحساب، فتجاهل هذه الرسالة.\n\nCloud Hard Drive`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;padding:32px;border:1px solid #e5e7eb;border-radius:16px;color:#172033"><h1 style="font-size:22px">Cloud Hard Drive</h1><p>مرحباً ${safeName}،</p><p>استخدم رمز التحقق التالي لإثبات ملكية بريدك الإلكتروني:</p><div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:20px;background:#f3f6fb;border-radius:12px">${code}</div><p>هذا الرمز صالح لمدة <strong>10 دقائق</strong> ويُستخدم مرة واحدة فقط.</p><p style="color:#667085;font-size:13px">إذا لم تطلب إنشاء حساب، فتجاهل هذه الرسالة.</p><hr style="border:0;border-top:1px solid #e5e7eb"><p style="font-size:12px;color:#667085">Cloud Hard Drive</p></div>`,
  });
}

export async function createVerification(userId: string, email: string, name: string): Promise<void> {
  const code = newVerificationCode();
  const now = new Date();
  const resendAvailableAt = new Date(now.getTime() + RESEND_WAIT_MS);
  await db.insert(emailVerifications).values({
    userId,
    codeHash: verificationCodeHash(userId, code),
    expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
    resendAvailableAt,
    resendWindowStartedAt: now,
  }).onConflictDoUpdate({
    target: emailVerifications.userId,
    set: {
      codeHash: verificationCodeHash(userId, code),
      expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
      usedAt: null,
      attempts: 0,
      resendAvailableAt,
      resendWindowStartedAt: now,
      resendCount: 0,
      createdAt: now,
    },
  });
  await sendVerificationEmail(email, name, code);
}

export async function verifiedUserByEmail(emailNorm: string) {
  const rows = await db.select().from(users).where(eq(users.emailNorm, emailNorm)).limit(1);
  return rows[0] ?? null;
}

export const verificationResendPolicy = {
  windowMs: RESEND_WINDOW_MS,
  maxPerWindow: MAX_RESENDS_PER_HOUR,
};
