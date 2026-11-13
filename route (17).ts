import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentUser, fail, ok } from "@/lib/api";
import { toPublicUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Update per-user upload preferences. */
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  const body = (await req.json().catch(() => ({}))) as {
    autoUpload?: boolean;
    wifiOnly?: boolean;
  };
  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.autoUpload === "boolean") patch.autoUpload = body.autoUpload;
  if (typeof body.wifiOnly === "boolean") patch.wifiOnly = body.wifiOnly;

  const updated = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, user.id))
    .returning();
  return ok({ user: toPublicUser(updated[0]) });
}
