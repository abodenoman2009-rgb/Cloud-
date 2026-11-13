import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { albumFiles, albums, files } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";
import { fileDto } from "@/lib/serialize";

export const dynamic = "force-dynamic";

async function owned(id: string, userId: string) {
  const rows = await db
    .select()
    .from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;
  const album = await owned(id, user.id);
  if (!album) return fail(404, "not_found");

  const rows = await db
    .select({ file: files })
    .from(albumFiles)
    .innerJoin(files, eq(albumFiles.fileId, files.id))
    .where(and(eq(albumFiles.albumId, id), eq(files.userId, user.id)))
    .orderBy(files.createdAt);

  return ok({
    album: { ...album, createdAt: album.createdAt.toISOString() },
    files: rows.map((r) => fileDto(r.file)),
  });
}

/** Rename, add/remove files, delete the album. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;
  const album = await owned(id, user.id);
  if (!album) return fail(404, "not_found");

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    addFileIds?: string[];
    removeFileIds?: string[];
  };

  if (typeof body.name === "string" && body.name.trim()) {
    await db.update(albums).set({ name: body.name.trim().slice(0, 120) }).where(eq(albums.id, id));
  }

  const add = (body.addFileIds ?? []).filter((v) => typeof v === "string").slice(0, 500);
  if (add.length) {
    const ownedRows = await db
      .select({ id: files.id })
      .from(files)
      .where(and(eq(files.userId, user.id), inArray(files.id, add)));
    for (const f of ownedRows) {
      await db.insert(albumFiles).values({ albumId: id, fileId: f.id }).onConflictDoNothing();
    }
  }

  const remove = (body.removeFileIds ?? []).filter((v) => typeof v === "string").slice(0, 500);
  if (remove.length) {
    await db
      .delete(albumFiles)
      .where(and(eq(albumFiles.albumId, id), inArray(albumFiles.fileId, remove)));
  }

  const updated = await owned(id, user.id);
  return ok({ album: { ...updated!, createdAt: updated!.createdAt.toISOString() } });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;
  const album = await owned(id, user.id);
  if (!album) return fail(404, "not_found");
  await db.delete(albumFiles).where(eq(albumFiles.albumId, id));
  await db.delete(albums).where(eq(albums.id, id));
  return ok({ ok: true });
}
