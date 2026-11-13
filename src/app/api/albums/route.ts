import { NextRequest } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { albumFiles, albums } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

type AlbumDto = {
  id: string;
  name: string;
  kind: string;
  createdAt: string;
  count: number;
};

/** List albums/folders with file counts. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const rows = await db
    .select({
      id: albums.id,
      name: albums.name,
      kind: albums.kind,
      createdAt: albums.createdAt,
      count: sql<number>`count(${albumFiles.fileId})::int`,
    })
    .from(albums)
    .leftJoin(albumFiles, eq(albumFiles.albumId, albums.id))
    .where(eq(albums.userId, user.id))
    .groupBy(albums.id)
    .orderBy(desc(albums.createdAt));

  const albumsList: AlbumDto[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    createdAt: r.createdAt.toISOString(),
    count: Number(r.count),
  }));
  return ok({ albums: albumsList });
}

/** Create an album or folder. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const body = (await req.json().catch(() => ({}))) as { name?: string; kind?: string };
  const name = (body.name ?? "").trim().slice(0, 120);
  if (!name) return fail(400, "bad_request");
  const kind = body.kind === "folder" ? "folder" : "album";
  const inserted = await db.insert(albums).values({ userId: user.id, name, kind }).returning();
  const album: AlbumDto = {
    id: inserted[0].id,
    name: inserted[0].name,
    kind: inserted[0].kind,
    createdAt: inserted[0].createdAt.toISOString(),
    count: 0,
  };
  return ok({ album }, { status: 201 });
}
