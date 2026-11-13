import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { once } from "node:events";
import path from "node:path";
import { db } from "@/db";
import { files, uploadSessions } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";
import { getObjectStore, objectKey } from "@/lib/storage";
import { fileDto } from "@/lib/serialize";
import { kindOf } from "@/lib/util";

export const dynamic = "force-dynamic";

/**
 * Step 3 — assemble slices in order, hash the payload (SHA-256), deduplicate,
 * push to the object store, then verify the stored object by size before the
 * file is marked as safely in the cloud.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;

  const rows = await db
    .select()
    .from(uploadSessions)
    .where(and(eq(uploadSessions.id, id), eq(uploadSessions.userId, user.id)))
    .limit(1);
  const s = rows[0];
  if (!s) return fail(404, "upload_not_found");
  if (s.status === "completed") return fail(409, "upload_not_found");
  if (new Date(s.expiresAt).getTime() < Date.now()) return fail(410, "upload_not_found");

  // Every slice must be present — otherwise the client resumes first.
  const entries = await fs.readdir(s.tempDir).catch(() => [] as string[]);
  const present = new Set(entries.filter((e) => e.endsWith(".part")));
  for (let i = 0; i < s.chunksTotal; i++) {
    if (!present.has(`${i}.part`)) return fail(400, "bad_chunk");
  }

  const assembled = path.join(s.tempDir, "__assembled");
  const hash = createHash("sha256");
  try {
    const out = createWriteStream(assembled);
    for (let i = 0; i < s.chunksTotal; i++) {
      const buf = await fs.readFile(path.join(s.tempDir, `${i}.part`));
      hash.update(buf);
      if (!out.write(buf)) await once(out, "drain");
    }
    await new Promise<void>((resolve) => out.end(() => resolve()));
  } catch {
    return fail(500, "bad_chunk");
  }
  const sha256 = hash.digest("hex");
  const stat = await fs.stat(assembled);
  if (stat.size !== s.size) return fail(400, "bad_chunk");

  // Content-level deduplication for this user.
  const dupRows = await db
    .select()
    .from(files)
    .where(and(eq(files.userId, user.id), eq(files.sha256, sha256), isNull(files.trashedAt)))
    .limit(1);
  if (dupRows[0]) {
    await fs.rm(s.tempDir, { recursive: true, force: true }).catch(() => undefined);
    await db.update(uploadSessions).set({ status: "completed" }).where(eq(uploadSessions.id, id));
    return ok({ duplicate: true, file: fileDto(dupRows[0]) });
  }

  const fileId = crypto.randomUUID();
  const key = objectKey(user.id, fileId);
  const store = getObjectStore();
  try {
    await store.put(key, createReadStream(assembled), s.mime, s.size);
  } catch {
    return fail(503, "storage_unavailable");
  }

  // Post-write verification: the object must exist with the expected size
  // before we ever allow the local copy to be cleared.
  const head = await store.head(key);
  const verified = Boolean(head && head.size === s.size);
  if (!verified) {
    await store.remove(key).catch(() => undefined);
    return fail(502, "verify_failed");
  }

  const inserted = await db
    .insert(files)
    .values({
      id: fileId,
      userId: user.id,
      name: s.name,
      mime: s.mime,
      size: s.size,
      kind: kindOf(s.mime),
      storageKey: key,
      sha256,
      verified: true,
      deviceName: (req.headers.get("x-device-name") ?? "").slice(0, 80) || null,
    })
    .returning();

  await fs.rm(s.tempDir, { recursive: true, force: true }).catch(() => undefined);
  await db.update(uploadSessions).set({ status: "completed" }).where(eq(uploadSessions.id, id));

  return ok({ duplicate: false, file: fileDto(inserted[0]), verified });
}
