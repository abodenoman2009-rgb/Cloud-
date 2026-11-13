import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";
import { getObjectStore } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Final gate before local deletion: re-verifies every object in the store and
 * only then flags the local copy as cleared. Incomplete uploads are refused.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");

  const body = (await req.json().catch(() => ({}))) as { fileIds?: string[] };
  const ids = [...new Set((body.fileIds ?? []).filter((v) => typeof v === "string"))].slice(0, 2000);
  if (!ids.length) return fail(400, "bad_request");

  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.userId, user.id), inArray(files.id, ids)));

  const store = getObjectStore();
  const cleared: string[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];
  let savings = 0;

  for (const f of rows) {
    const head = await store.head(f.storageKey);
    if (!head || head.size !== f.size || !f.verified) {
      rejected.push({ id: f.id, reason: head ? "incomplete" : "missing" });
      continue;
    }
    await db
      .update(files)
      .set({ localCopyCleared: true, updatedAt: new Date() })
      .where(eq(files.id, f.id));
    cleared.push(f.id);
    if (!f.localCopyCleared) savings += f.size;
  }

  return ok({ cleared, rejected, savings });
}
