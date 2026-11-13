import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  decodeOAuthState,
  exchangeCode,
  GoogleAuthError,
  googleConfig,
  OAUTH_COOKIE,
  verifyIdToken,
} from "@/lib/auth/google";
import {
  cookieSecure,
  getSessionUser,
  issueSession,
  setSessionCookie,
} from "@/lib/auth/session";
import { clientIp } from "@/lib/api";

export const dynamic = "force-dynamic";

function baseUrl(req: NextRequest): string {
  const env = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
  if (env) return env;
  return new URL(req.url).origin;
}

function errorRedirect(base: string, code: string): NextResponse {
  return NextResponse.redirect(`${base}/login?error=${encodeURIComponent(code)}`);
}

/**
 * Step 2 — OAuth callback.
 * Validates state + PKCE, exchanges the code, verifies the ID token
 * (signature / issuer / audience), then creates or links the account
 * and issues a server-side session.
 */
export async function GET(req: NextRequest) {
  const base = baseUrl(req);
  const cfg = googleConfig();
  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const rawCookie = req.cookies.get(OAUTH_COOKIE)?.value;
  const oauth = decodeOAuthState(rawCookie);

  const clear = (res: NextResponse) => {
    res.cookies.set(OAUTH_COOKIE, "", {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });
    return res;
  };

  if (!cfg.enabled) return clear(errorRedirect(base, "google_not_configured"));

  // Google returned an error (cancel / permission denied / misconfigured redirect).
  if (err) {
    const mapped =
      err === "access_denied"
        ? "access_denied"
        : err === "redirect_uri_mismatch"
          ? "callback_error"
          : "callback_error";
    return clear(errorRedirect(base, mapped));
  }

  if (!oauth || !state || !code || oauth.state !== state) {
    return clear(errorRedirect(base, "invalid_state"));
  }
  if (oauth.mode === "link") {
    const user = await getSessionUser();
    if (!user) return clear(errorRedirect(base, "signin_required"));
  }

  try {
    const tokens = await exchangeCode({ code, verifier: oauth.verifier, config: cfg });
    const profile = await verifyIdToken(tokens.idToken, cfg);

    if (!profile.emailVerified) {
      return clear(errorRedirect(base, "email_unverified"));
    }

    const emailNorm = profile.email.toLowerCase();

    // 1) Already linked to this Google identity?
    const byGoogle = await db
      .select()
      .from(users)
      .where(eq(users.googleId, profile.sub))
      .limit(1);

    let user = byGoogle[0] ?? null;

    if (!user) {
      // 2) Existing password account with the same (Google-verified) email → link.
      const byEmail = await db
        .select()
        .from(users)
        .where(eq(users.emailNorm, emailNorm))
        .limit(1);

      if (byEmail[0]) {
        const owner = byEmail[0];
        // Refuse to attach the Google identity to an account that already
        // belongs to a different Google subject.
        const conflict = owner.googleId && owner.googleId !== profile.sub;
        if (conflict) return clear(errorRedirect(base, "link_exists"));
        const updated = await db
          .update(users)
          .set({
            googleId: profile.sub,
            picture: profile.picture || owner.picture,
            name: owner.name || profile.name,
            provider: owner.passwordHash ? owner.provider : "google",
            updatedAt: new Date(),
          })
          .where(eq(users.id, owner.id))
          .returning();
        user = updated[0];
      } else {
        // 3) Brand new account created from Google.
        const created = await db
          .insert(users)
          .values({
            name: profile.name,
            email: profile.email,
            emailNorm,
            googleId: profile.sub,
            picture: profile.picture,
            provider: "google",
          })
          .returning();
        user = created[0];
      }
    }

    const sessionUser = await getSessionUser();

    // Link mode: only ever attach to the session that initiated the flow.
    if (oauth.mode === "link") {
      if (!sessionUser || sessionUser.id !== user.id) {
        return clear(errorRedirect(base, "link_exists"));
      }
      return clear(NextResponse.redirect(`${base}/app?oauth=linked`));
    }

    const { token, expiresAt } = await issueSession(user.id, {
      userAgent: req.headers.get("user-agent"),
      ip: clientIp(req),
    });
    const res = NextResponse.redirect(`${base}${oauth.next || "/app"}?oauth=success`);
    setSessionCookie(res, token, expiresAt);
    return clear(res);
  } catch (e) {
    const code =
      e instanceof GoogleAuthError
        ? e.code === "exchange_failed"
          ? "callback_error"
          : e.code === "id_token_invalid"
            ? "invalid_state"
            : e.code
        : "callback_error";
    // Never echo raw exception details or tokens to the browser.
    return clear(errorRedirect(base, code));
  }
}


