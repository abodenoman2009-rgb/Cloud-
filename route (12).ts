import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { currentUser, fail } from "@/lib/api";
import { streamObject } from "@/lib/stream";

export const dynamic = "force-dynamic";

/**
 * Streams the object from cloud storage. Supports Range requests so video
 * playback starts instantly without downloading the whole file.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const { id } = await ctx.params;

  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, user.id)))
    .limit(1);
  const file = rows[0];
  if (!file) return fail(404, "not_found");

  const download = new URL(req.url).searchParams.get("dl") === "1";
  return streamObject(req, file, { download });
}
