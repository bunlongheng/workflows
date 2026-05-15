import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth CSRF protection helpers.
 *
 * We mint a random `state` token per OAuth init, store it in a short-lived
 * httpOnly cookie, and require the callback to receive the same value back
 * in the query string before exchanging the auth code.
 */

const COOKIE_PREFIX = "oauth_state_";
const MAX_AGE_SECONDS = 10 * 60; // 10 minutes

function cookieName(provider: string): string {
  return `${COOKIE_PREFIX}${provider}`;
}

/**
 * Generate a fresh state value and attach it to the response as an httpOnly
 * cookie scoped to `/api/auth/<provider>/callback`. Returns the state value
 * to embed in the upstream Google auth URL.
 */
export function setOAuthStateCookie(
  res: NextResponse,
  provider: string
): string {
  const state = crypto.randomUUID();
  res.cookies.set({
    name: cookieName(provider),
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/api/auth/${provider}`,
    maxAge: MAX_AGE_SECONDS,
  });
  return state;
}

/**
 * Verify the state echoed back from the OAuth provider matches the cookie
 * we set during init. Returns true on match. Always clears the cookie on
 * the provided response so it can't be reused.
 */
export function verifyAndClearOAuthState(
  request: NextRequest,
  res: NextResponse,
  provider: string
): boolean {
  const name = cookieName(provider);
  const cookieValue = request.cookies.get(name)?.value;
  const queryValue = request.nextUrl.searchParams.get("state");

  // Always clear the cookie, success or fail
  res.cookies.set({
    name,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/api/auth/${provider}`,
    maxAge: 0,
  });

  if (!cookieValue || !queryValue) return false;
  if (cookieValue.length !== queryValue.length) return false;

  // Constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < cookieValue.length; i++) {
    diff |= cookieValue.charCodeAt(i) ^ queryValue.charCodeAt(i);
  }
  return diff === 0;
}
