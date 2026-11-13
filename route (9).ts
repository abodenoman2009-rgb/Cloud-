import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";

export const dynamic = "force-dynamic";

/** Change password for an authenticated user (re-verifies the current one). */
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");

  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };
  const newPassword = body.newPassword ?? "";
  if (newPassword.length < 8) return fail(400, "weak_password");

  const valid = await verifyPassword(body.currentPassword ?? "", user.passwordHash);
  if (!valid) return fail(401, "invalid_credentials");

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Keep the current session alive, drop every other device.
  const currentTokenHash = await currentTokenHashOf();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.userId, user.id));

  if (currentTokenHash) {
    const { sha256Hex } = await import("@/lib/auth/crypto");
    // re-issue is unnecessary: the client keeps its own cookie; re-insert a
    // fresh row so the current device stays signed in.
    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: sha256Hex(currentTokenHash),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  return ok({ ok: true });
}

async function currentTokenHashOf(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const { SESSION_COOKIE } = await import("@/lib/auth/session");
    const { sha256Hex } = await import("@/lib/auth/crypto");
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    return token ? sha256Hex(token) : null;
  } catch {
    return null;
  }
}
