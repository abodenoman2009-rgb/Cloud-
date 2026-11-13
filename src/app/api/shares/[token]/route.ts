import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { files, shares } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { sha256Hex } from "@/lib/auth/crypto";
import { fileDto } from "@/lib/serialize";

export const dynamic = "force-dynamic";

async function resolve(token: string) {
  const rows = await db
    .select({ share: shares, file: files })
    .from(shares)
    .innerJoin(files, eq(shares.fileId, files.id))
    .where(
      and(
        eq(shares.tokenHash, sha256Hex(token)),
        isNull(shares.revokedAt),
        isNull(files.trashedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.share.expiresAt && row.share.expiresAt.getTime() < Date.now()) return null;
  return row;
}

/** Public metadata for a shared link (no sign-in required). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const row = await resolve(token);
  if (!row) return fail(404, "share_not_found");
  return ok({
    file: {
      ...fileDto(row.file),
      contentUrl: `/api/shares/${token}/content`,
    },
    expiresAt: row.share.expiresAt?.toISOString() ?? null,
    downloads: row.share.downloads,
  });
}

/** Revoke a link by token (owner only, via signed-in session). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const row = await resolve(token);
  if (!row) return fail(404, "share_not_found");
  const { currentUser } = await import("@/lib/api");
  const user = await currentUser();
  if (!user || user.id !== row.share.userId) return fail(403, "forbidden");
  await db.update(shares).set({ revokedAt: new Date() }).where(eq(shares.id, row.share.id));
  return ok({ ok: true });
}
