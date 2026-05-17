import { describe, expect, it } from 'vitest';
import { setOAuthStateCookie, verifyAndClearOAuthState } from '../../lib/oauth-state';
import { NextRequest, NextResponse } from 'next/server';

// Minimal helper: build a NextRequest whose cookies + searchParams we control.
function makeRequest(opts: { cookies?: Record<string, string>; state?: string | null }): NextRequest {
  const url = new URL('http://localhost/api/auth/callback');
  if (opts.state !== undefined && opts.state !== null) {
    url.searchParams.set('state', opts.state);
  }
  const cookieHeader = Object.entries(opts.cookies || {})
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  return new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

describe('setOAuthStateCookie', () => {
  it('sets an httpOnly cookie named oauth_state_<provider> and returns its value', () => {
    const res = NextResponse.next();
    const state = setOAuthStateCookie(res, 'gmail');

    expect(state).toMatch(/^[0-9a-f-]{36}$/i);
    const cookie = res.cookies.get('oauth_state_gmail');
    expect(cookie?.value).toBe(state);
  });

  it('produces a different state per call', () => {
    const res = NextResponse.next();
    const a = setOAuthStateCookie(res, 'gmail');
    const b = setOAuthStateCookie(res, 'gmail');
    expect(a).not.toBe(b);
  });
});

describe('verifyAndClearOAuthState', () => {
  it('returns true when cookie + query state match (same provider)', () => {
    const state = 'fixed-state-value-aaa';
    const req = makeRequest({ cookies: { oauth_state_gmail: state }, state });
    const res = NextResponse.next();
    expect(verifyAndClearOAuthState(req, res, 'gmail')).toBe(true);
  });

  it('returns false when cookie + query state mismatch', () => {
    const req = makeRequest({ cookies: { oauth_state_gmail: 'aaa' }, state: 'bbb' });
    const res = NextResponse.next();
    expect(verifyAndClearOAuthState(req, res, 'gmail')).toBe(false);
  });

  it('returns false when provider differs (cookie was set for a different provider)', () => {
    // Cookie was set for "youtube", but we verify with "gmail" -> wrong cookie name -> miss.
    const req = makeRequest({ cookies: { oauth_state_youtube: 'shared' }, state: 'shared' });
    const res = NextResponse.next();
    expect(verifyAndClearOAuthState(req, res, 'gmail')).toBe(false);
  });

  it('returns false when no cookie is present', () => {
    const req = makeRequest({ state: 'whatever' });
    const res = NextResponse.next();
    expect(verifyAndClearOAuthState(req, res, 'gmail')).toBe(false);
  });

  it('clears the cookie on the response even on failure', () => {
    const req = makeRequest({ cookies: { oauth_state_gmail: 'aaa' }, state: 'bbb' });
    const res = NextResponse.next();
    verifyAndClearOAuthState(req, res, 'gmail');

    // After clear, the cookie value is set to "" with maxAge:0 -> a fresh
    // Set-Cookie that overwrites the original.
    const cleared = res.cookies.get('oauth_state_gmail');
    expect(cleared?.value).toBe('');
  });
});
