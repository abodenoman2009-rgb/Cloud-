import { NextRequest } from "next/server";
import { and, desc, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { albumFiles, files } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";
import { fileDto } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const SORTS: Record<string, SQL> = {
  date: desc(files.createdAt),
  date_asc: asc(files.createdAt),
  size: desc(files.size),
  size_asc: asc(files.size),
  name: asc(files.name),
};

/** List the signed-in user's cloud files (search / filter / sort / album). */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const kind = url.searchParams.get("kind") ?? "";
  const sortKey = url.searchParams.get("sort") ?? "date";
  const albumId = url.searchParams.get("albumId");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 400, 1000);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const where: SQL[] = [eq(files.userId, user.id), isNull(files.trashedAt)];
  if (kind === "image" || kind === "video" || kind === "other") {
    where.push(eq(files.kind, kind));
  }
  if (q) {
    where.push(sql`${files.name} ILIKE ${"%" + q.replace(/[%_]/g, "") + "%"}`);
  }

  const order = SORTS[sortKey] ?? SORTS.date;

  if (albumId) {
    const rows = await db
      .select({ file: files })
      .from(albumFiles)
      .innerJoin(files, eq(albumFiles.fileId, files.id))
      .where(and(...where, eq(albumFiles.albumId, albumId)))
      .orderBy(order)
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(albumFiles)
      .innerJoin(files, eq(albumFiles.fileId, files.id))
      .where(and(...where, eq(albumFiles.albumId, albumId)));
    return ok({ files: rows.map((r) => fileDto(r.file)), total: Number(count ?? 0) });
  }

  const rows = await db
    .select()
    .from(files)
    .where(and(...where))
    .orderBy(order)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(files)
    .where(and(...where));

  return ok({ files: rows.map(fileDto), total: Number(count ?? 0) });
}
