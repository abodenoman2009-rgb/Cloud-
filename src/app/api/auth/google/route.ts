import { NextRequest, NextResponse } from "next/server";
import {
  buildAuthUrl,
  decodeOAuthState,
  encodeOAuthState,
  googleConfig,
  OAUTH_COOKIE,
  pkcePair,
} from "@/lib/auth/google";
import { randomToken } from "@/lib/auth/crypto";
import { cookieSecure, getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function baseUrl(req: NextRequest): string {
  const env = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
  if (env) return env;
  return new URL(req.url).origin;
}

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("://")) return raw;
  return "/app";
}

/**
 * Step 1 of Google OAuth 2.0 (Authorization Code + PKCE).
 * Redirects the browser to Google's consent screen.
 */
export async function GET(req: NextRequest) {
  const cfg = googleConfig();
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "link" ? "link" : "login";
  const next = safeNext(url.searchParams.get("next"));
  const loginHint = url.searchParams.get("hint") ?? undefined;
  const base = baseUrl(req);

  if (!cfg.enabled) {
    return NextResponse.redirect(`${base}/login?error=google_not_configured`);
  }

  if (mode === "link") {
    const user = await getSessionUser();
    if (!user) return NextResponse.redirect(`${base}/login?error=signin_required`);
  }

  const { verifier, challenge } = pkcePair();
  const state = randomToken(24);
  const payload = encodeOAuthState({
    state,
    verifier,
    mode,
    csrf: randomToken(16),
    next,
    exp: Date.now() + 10 * 60 * 1000,
  });

  const authUrl = buildAuthUrl({
    state,
    challenge,
    redirectUri: cfg.redirectUri,
    clientId: cfg.clientId,
    loginHint,
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(OAUTH_COOKIE, payload, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
