import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { uploadSessions } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

async function load(userId: string, id: string) {
  const rows = await db
    .select()
    .from(uploadSessions)
    .where(and(eq(uploadSessions.id, id), eq(uploadSessions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Resume info — tells the client which slices are already on the server. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;
  const s = await load(user.id, id);
  if (!s) return fail(404, "upload_not_found");

  let received: number[] = [];
  try {
    const entries = await fs.readdir(s.tempDir);
    received = entries
      .filter((e) => e.endsWith(".part"))
      .map((e) => Number(e.replace(".part", "")))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
  } catch {
    received = [];
  }
  const expired = new Date(s.expiresAt).getTime() < Date.now();
  return ok({
    uploadId: s.id,
    status: expired ? "expired" : s.status,
    chunkSize: s.chunkSize,
    chunksTotal: s.chunksTotal,
    received,
    name: s.name,
    size: s.size,
  });
}

/** Abort and purge the scratch slices. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;
  const s = await load(user.id, id);
  if (!s) return fail(404, "upload_not_found");
  await fs.rm(s.tempDir, { recursive: true, force: true }).catch(() => undefined);
  await db.update(uploadSessions).set({ status: "aborted" }).where(eq(uploadSessions.id, id));
  return ok({ ok: true });
}
