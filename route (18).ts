import { NextRequest } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { files, shares } from "@/db/schema";
import { fail } from "@/lib/api";
import { sha256Hex } from "@/lib/auth/crypto";
import { streamObject } from "@/lib/stream";

export const dynamic = "force-dynamic";

/** Streams a shared object straight from the store, Range-capable. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
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
  if (!row) return fail(404, "share_not_found");
  if (row.share.expiresAt && row.share.expiresAt.getTime() < Date.now()) {
    return fail(410, "share_expired");
  }

  void db
    .update(shares)
    .set({ downloads: sql`${shares.downloads} + 1` })
    .where(eq(shares.id, row.share.id))
    .catch(() => undefined);

  const download = new URL(req.url).searchParams.get("dl") === "1";
  return streamObject(req, row.file, { download });
}
