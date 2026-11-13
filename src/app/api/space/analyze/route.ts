import { NextRequest } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";
import { getObjectStore } from "@/lib/storage";

export const dynamic = "force-dynamic";

type ScanItem = { localId?: string; fileId?: string; name?: string; size?: number };

/**
 * Phone cleanup analysis.
 * Matches local device copies against cloud files and re-verifies each object
 * in the store before it may be offered for local deletion.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");

  const body = (await req.json().catch(() => ({}))) as { items?: ScanItem[] };
  const items = Array.isArray(body.items) ? body.items.slice(0, 2000) : [];
  if (!items.length) {
    return ok({ items: [], savings: 0, readyCount: 0, blockedCount: 0, verifiedCount: 0 });
  }

  const fileIds = items.map((i) => i.fileId).filter((v): v is string => Boolean(v));
  const byId = new Map<string, typeof files.$inferSelect>();
  if (fileIds.length) {
    const rows = await db
      .select()
      .from(files)
      .where(and(eq(files.userId, user.id), inArray(files.id, fileIds), isNull(files.trashedAt)));
    for (const r of rows) byId.set(r.id, r);
  }

  // Fallback match for entries without a known fileId: exact name + size.
  const names = [...new Set(items.filter((i) => !i.fileId && i.name).map((i) => i.name!))];
  const byKey = new Map<string, typeof files.$inferSelect>();
  if (names.length) {
    const rows = await db
      .select()
      .from(files)
      .where(and(eq(files.userId, user.id), isNull(files.trashedAt), inArray(files.name, names)));
    for (const r of rows) byKey.set(`${r.name}::${r.size}`, r);
  }

  const store = getObjectStore();
  const out: Array<{
    localId: string | null;
    fileId: string;
    name: string;
    size: number;
    status: "ready" | "incomplete" | "missing" | "not_uploaded";
    verified: boolean;
    localCopyCleared: boolean;
  }> = [];
  let savings = 0;
  let readyCount = 0;
  let blockedCount = 0;
  let verifiedCount = 0;

  for (const item of items) {
    const match = item.fileId ? byId.get(item.fileId) : byKey.get(`${item.name}::${item.size}`);
    if (!match) {
      out.push({
        localId: item.localId ?? null,
        fileId: "",
        name: item.name ?? "",
        size: Number(item.size ?? 0),
        status: "not_uploaded",
        verified: false,
        localCopyCleared: false,
      });
      blockedCount++;
      continue;
    }
    // Live verification against the object store.
    const head = await store.head(match.storageKey);
    const verified = Boolean(head && head.size === match.size && match.verified);
    if (verified) verifiedCount++;
    const status = verified ? "ready" : head ? "incomplete" : "missing";
    if (status === "ready") {
      readyCount++;
      if (!match.localCopyCleared) savings += match.size;
    } else {
      blockedCount++;
    }
    out.push({
      localId: item.localId ?? null,
      fileId: match.id,
      name: match.name,
      size: match.size,
      status,
      verified,
      localCopyCleared: match.localCopyCleared,
    });
  }

  return ok({ items: out, savings, readyCount, blockedCount, verifiedCount });
}
