import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { albumFiles, albums, files, shares } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";
import { fileDto } from "@/lib/serialize";
import { getObjectStore } from "@/lib/storage";

export const dynamic = "force-dynamic";

async function owned(id: string, userId: string) {
  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;
  const file = await owned(id, user.id);
  if (!file) return fail(404, "not_found");
  return ok({ file: fileDto(file) });
}

/** Rename / move to album. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;
  const file = await owned(id, user.id);
  if (!file) return fail(404, "not_found");

  const body = (await req.json().catch(() => ({}))) as { name?: string; albumId?: string | null };
  if (typeof body.name === "string" && body.name.trim()) {
    await db
      .update(files)
      .set({ name: body.name.trim().slice(0, 300), updatedAt: new Date() })
      .where(eq(files.id, id));
  }
  if (body.albumId !== undefined) {
    await db.delete(albumFiles).where(eq(albumFiles.fileId, id));
    if (body.albumId) {
      const album = await db
        .select({ id: albums.id })
        .from(albums)
        .where(and(eq(albums.id, body.albumId), eq(albums.userId, user.id)))
        .limit(1);
      if (!album[0]) return fail(404, "not_found");
      await db
        .insert(albumFiles)
        .values({ albumId: body.albumId, fileId: id })
        .onConflictDoNothing();
    }
  }
  const updated = await owned(id, user.id);
  return ok({ file: fileDto(updated!) });
}

/** Permanently remove the file and its cloud object. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;
  const file = await owned(id, user.id);
  if (!file) return fail(404, "not_found");

  await db.delete(albumFiles).where(eq(albumFiles.fileId, id));
  await db.delete(shares).where(eq(shares.fileId, id));
  await db.delete(files).where(eq(files.id, id));
  await getObjectStore().remove(file.storageKey).catch(() => undefined);
  return ok({ ok: true });
}
