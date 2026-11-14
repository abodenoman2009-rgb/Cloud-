import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/crypto";
import { clientIp, fail, ok } from "@/lib/api";
import { createVerification } from "@/lib/auth/email-verification";

export const dynamic = "force-dynamic";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string; password?: string };
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  if (!name || name.length < 2) return fail(400, "name_required");
  if (!EMAIL_RE.test(email)) return fail(400, "invalid_email");
  if (password.length < 8) return fail(400, "weak_password");
  if (!process.env.SMTP_URL?.trim() || !process.env.MAIL_FROM?.trim()) return fail(503, "email_not_configured");

  const emailNorm = email.toLowerCase();
  const existing = await db.select().from(users).where(eq(users.emailNorm, emailNorm)).limit(1);
  if (existing[0]) {
    // An unverified signup can be safely resumed only with its original password.
    const pending = existing[0];
    if (pending.emailVerified || !pending.passwordHash || !(await (await import("@/lib/auth/crypto")).verifyPassword(password, pending.passwordHash))) {
      return fail(409, "email_exists");
    }
    try {
      await createVerification(pending.id, pending.email, pending.name);
    } catch {
      return fail(502, "mail_failed");
    }
    return ok({ pendingVerification: true, email: pending.email }, { status: 200 });
  }

  const passwordHash = await hashPassword(password);
  const inserted = await db.insert(users).values({ name, email, emailNorm, passwordHash, provider: "email", emailVerified: false }).returning();
  const user = inserted[0];
  try {
    await createVerification(user.id, user.email, user.name);
  } catch {
    return fail(502, "mail_failed");
  }
  return ok({ pendingVerification: true, email: user.email }, { status: 201 });
}
