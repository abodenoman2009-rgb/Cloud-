import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { uploadSessions } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Step 2 — receive one slice (`x-chunk-index` header). Idempotent. */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
  if (s.status !== "pending") return fail(409, "upload_not_found");
  if (new Date(s.expiresAt).getTime() < Date.now()) return fail(410, "upload_not_found");

  const index = Number(req.headers.get("x-chunk-index"));
  if (!Number.isInteger(index) || index < 0 || index >= s.chunksTotal) {
    return fail(400, "bad_chunk");
  }

  const buf = Buffer.from(await req.arrayBuffer());
  const offset = index * s.chunkSize;
  const expected = Math.min(s.chunkSize, s.size - offset);
  if (buf.length !== expected) return fail(400, "bad_chunk");

  await fs.mkdir(s.tempDir, { recursive: true });
  const target = path.join(s.tempDir, `${index}.part`);
  await fs.writeFile(target, buf);

  const entries = await fs.readdir(s.tempDir);
  const received = entries.filter((e) => e.endsWith(".part")).length;
  await db.update(uploadSessions).set({ receivedChunks: received }).where(eq(uploadSessions.id, id));

  return ok({ index, received, total: s.chunksTotal });
}
