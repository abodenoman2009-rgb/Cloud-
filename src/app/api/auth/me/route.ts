import { currentUser, ok } from "@/lib/api";
import { toPublicUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return ok({ user: null });
  return ok({ user: toPublicUser(user) });
}
