import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { currentUser, ok } from "@/lib/api";
import { storageStatus } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Storage panel data: quota, usage, breakdown and reclaimed space. */
export async function GET() {
  const user = await currentUser();
  if (!user) return ok({ authorized: false });

  const rows = await db
    .select({
      kind: files.kind,
      count: sql<number>`count(*)::int`,
      size: sql<number>`coalesce(sum(${files.size}), 0)`,
      cleared: sql<number>`coalesce(sum(${files.size}) filter (where ${files.localCopyCleared}), 0)`,
    })
    .from(files)
    .where(and(eq(files.userId, user.id), isNull(files.trashedAt)))
    .groupBy(files.kind);

  let used = 0;
  let saved = 0;
  const images = { count: 0, size: 0 };
  const videos = { count: 0, size: 0 };
  const others = { count: 0, size: 0 };

  for (const r of rows) {
    used += Number(r.size);
    saved += Number(r.cleared);
    const bucket = r.kind === "image" ? images : r.kind === "video" ? videos : others;
    bucket.count += Number(r.count);
    bucket.size += Number(r.size);
  }

  const quota = user.quotaBytes;
  return ok({
    authorized: true,
    quota,
    used,
    remaining: Math.max(0, quota - used),
    images,
    videos,
    others,
    saved,
    storage: storageStatus(),
  });
}
