import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { signPayload, verifyPayload } from "./crypto";

/**
 * Google OAuth 2.0 — Authorization Code flow with PKCE (S256).
 * All secrets stay on the server; nothing here is exported to the client bundle.
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUER = "https://accounts.google.com";
export const OAUTH_COOKIE = "chd_oauth";

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  enabled: boolean;
  missing: string[];
};

export function googleConfig(): GoogleConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const baseUrl = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() || (baseUrl ? `${baseUrl}/api/auth/google/callback` : "");
  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!redirectUri) missing.push("GOOGLE_REDIRECT_URI / APP_BASE_URL");
  return { clientId, clientSecret, redirectUri, enabled: missing.length === 0, missing };
}

export type Pkce = { verifier: string; challenge: string };

export function pkcePair(): Pkce {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export type OAuthState = {
  state: string;
  verifier: string;
  mode: "login" | "link";
  csrf: string;
  next: string;
  exp: number;
};

export function encodeOAuthState(o: OAuthState): string {
  return signPayload(Buffer.from(JSON.stringify(o)).toString("base64url"));
}

export function decodeOAuthState(value: string | undefined | null): OAuthState | null {
  const raw = verifyPayload(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthState;
    if (!parsed?.state || !parsed?.verifier || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildAuthUrl(o: {
  state: string;
  challenge: string;
  redirectUri: string;
  clientId: string;
  loginHint?: string;
}): string {
  const params = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: o.state,
    code_challenge: o.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    include_granted_scopes: "true",
  });
  if (o.loginHint) params.set("login_hint", o.loginHint);
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export class GoogleAuthError extends Error {
  constructor(
    public code:
      | "not_configured"
      | "invalid_state"
      | "callback_error"
      | "exchange_failed"
      | "id_token_invalid",
    message: string,
  ) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export async function exchangeCode(o: {
  code: string;
  verifier: string;
  config: GoogleConfig;
}): Promise<{ idToken: string; accessToken: string }> {
  const body = new URLSearchParams({
    code: o.code,
    client_id: o.config.clientId,
    client_secret: o.config.clientSecret,
    redirect_uri: o.config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: o.verifier,
  });
  let res: Response;
  try {
    res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch {
    throw new GoogleAuthError("exchange_failed", "network_error");
  }
  const json = (await res.json().catch(() => ({}))) as {
    id_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.id_token) {
    // Never log the payload itself — only the machine-readable error code.
    throw new GoogleAuthError(
      "exchange_failed",
      json.error ?? `http_${res.status}`,
    );
  }
  return { idToken: json.id_token, accessToken: json.access_token ?? "" };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * Validates signature (RS256 via Google JWKS), issuer and audience of the ID token.
 */
export async function verifyIdToken(
  idToken: string,
  config: GoogleConfig,
): Promise<{
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
}> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI), { cooldownDuration: 30_000 });
  }
  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE_ISSUER,
      audience: config.clientId,
      requiredClaims: ["sub", "email"],
    });
    const email = String(payload.email ?? "");
    if (!email) throw new Error("missing_email");
    return {
      sub: String(payload.sub),
      email,
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
      name: String(payload.name ?? email.split("@")[0]),
      picture: typeof payload.picture === "string" ? payload.picture : "",
    };
  } catch {
    throw new GoogleAuthError("id_token_invalid", "id_token_verification_failed");
  }
}
