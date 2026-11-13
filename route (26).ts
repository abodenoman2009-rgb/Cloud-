import { NextRequest } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { files, uploadSessions } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";
import { dataDir } from "@/lib/storage";
import { fileDto } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MAX_CHUNK = 8 * 1024 * 1024; // 8 MiB — resumable slice size
const MAX_FILE = 64 * 1024 * 1024 * 1024; // 64 GiB per object

/** Step 1 — open (or short-circuit) an upload session. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    mime?: string;
    size?: number;
    deviceName?: string;
  };
  const name = (body.name ?? "").trim().slice(0, 300);
  const mime = (body.mime || "application/octet-stream").slice(0, 160);
  const size = Number(body.size);
  if (!name || !Number.isFinite(size) || size <= 0) return fail(400, "bad_request");
  if (size > MAX_FILE) return fail(413, "too_large");

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${files.size}), 0)` })
    .from(files)
    .where(and(eq(files.userId, user.id), isNull(files.trashedAt)));
  if (Number(total ?? 0) + size > user.quotaBytes) return fail(413, "quota");

  // Duplicate detection (name + size) as a fast path; content hash is
  // verified after assembly for a stronger guarantee.
  const dup = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.userId, user.id),
        eq(files.name, name),
        eq(files.size, size),
        isNull(files.trashedAt),
      ),
    )
    .limit(1);
  if (dup[0]) return ok({ duplicate: true, file: fileDto(dup[0]) });

  const id = randomUUID();
  const chunkSize = Math.min(MAX_CHUNK, size);
  const chunksTotal = Math.max(1, Math.ceil(size / chunkSize));
  const tempDir = path.join(dataDir(), "tmp", id);
  await fs.mkdir(tempDir, { recursive: true });

  await db.insert(uploadSessions).values({
    id,
    userId: user.id,
    name,
    mime,
    size,
    chunkSize,
    chunksTotal,
    tempDir,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return ok({ uploadId: id, chunkSize, chunksTotal, duplicate: false });
}
