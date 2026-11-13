import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { files, shares } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";
import { randomToken, sha256Hex } from "@/lib/auth/crypto";

export const dynamic = "force-dynamic";

const DEFAULT_TTL_DAYS = 7;

/** Create (or return the existing) secure share link for a file. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;

  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, user.id)))
    .limit(1);
  if (!rows[0]) return fail(404, "not_found");

  const body = (await req.json().catch(() => ({}))) as { days?: number };
  const days = Math.min(Math.max(Number(body.days) || DEFAULT_TTL_DAYS, 1), 30);

  const existing = await db
    .select()
    .from(shares)
    .where(and(eq(shares.fileId, id), eq(shares.userId, user.id), isNull(shares.revokedAt)))
    .limit(1);
  if (existing[0]) {
    return ok({
      token: null,
      url: null,
      existing: true,
      expiresAt: existing[0].expiresAt?.toISOString() ?? null,
      note: "already_created",
    });
  }

  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.insert(shares).values({
    fileId: id,
    userId: user.id,
    tokenHash: sha256Hex(token),
    expiresAt,
  });
  return ok({ token, url: `/s/${token}`, expiresAt: expiresAt.toISOString(), existing: false });
}

/** Revoke every active link for this file. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;
  const res = await db
    .update(shares)
    .set({ revokedAt: new Date() })
    .where(and(eq(shares.fileId, id), eq(shares.userId, user.id), isNull(shares.revokedAt)))
    .returning({ id: shares.id });
  return ok({ revoked: res.length });
}
