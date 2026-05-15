import { NextRequest, NextResponse } from 'next/server';
import { verifyAndClearOAuthState } from '@/lib/oauth-state';
import { VPS_URL, vpsAuthHeaders } from '@/lib/vps';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
  : 'http://localhost:3008/api/auth/gmail/callback';

function errorRedirect(request: NextRequest, reason = 'error'): NextResponse {
  const url = new URL(`/automations/new?connection=gmail&status=${reason}`, request.url);
  // Use a throwaway response purely to carry the state-cookie deletion.
  const res = NextResponse.redirect(url);
  verifyAndClearOAuthState(request, res, 'gmail');
  return res;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error || !code || !CLIENT_ID || !CLIENT_SECRET) {
    return errorRedirect(request);
  }

  // CSRF: verify state echoed back matches the cookie we set during init.
  // We need to attach the cookie-clearing to whatever response we eventually
  // return, so capture verification here and re-apply on the final redirect.
  const stateProbe = NextResponse.next();
  const stateOk = verifyAndClearOAuthState(request, stateProbe, 'gmail');
  if (!stateOk) {
    return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return errorRedirect(request);
  }

  const tokens = await tokenRes.json();

  // Get email
  let accountEmail = '';
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (userRes.ok) {
    const userData = await userRes.json();
    accountEmail = userData.email || '';
  }

  // Save token to VPS. If forwarding fails, the connection is unusable
  // downstream — redirect to error rather than show a misleading success.
  try {
    const connectRes = await fetch(`${VPS_URL}/api/gmail/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...vpsAuthHeaders() },
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        accountEmail,
      }),
    });
    if (!connectRes.ok) {
      console.error('[gmail-callback] VPS connect returned', connectRes.status);
      return errorRedirect(request);
    }

    // Register connection
    const regRes = await fetch(`${VPS_URL}/api/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...vpsAuthHeaders() },
      body: JSON.stringify({
        integrationId: 'gmail',
        accountName: accountEmail || 'Gmail',
        accountEmail,
        scopes: ['gmail.readonly'],
      }),
    });
    if (!regRes.ok) {
      console.error('[gmail-callback] VPS connections returned', regRes.status);
      return errorRedirect(request);
    }
  } catch (err) {
    console.error('[gmail-callback] Failed to forward tokens:', err);
    return errorRedirect(request);
  }

  // Defensive: assert the redirect target is same-origin. Today the URL is
  // built from `request.url` so this is by construction, but if a future
  // change ever sources the target from a query/cookie param this guard
  // prevents open-redirect attacks.
  const requestOrigin = new URL(request.url).origin;
  const successUrl = new URL('/automations/new', request.url);
  successUrl.searchParams.set('connection', 'gmail');
  successUrl.searchParams.set('status', 'success');
  successUrl.searchParams.set('account', accountEmail);

  const finalUrl =
    successUrl.origin === requestOrigin
      ? successUrl
      : new URL('/automations/new?connection=gmail&status=success', request.url);

  const res = NextResponse.redirect(finalUrl.toString());
  // Carry forward the state-cookie deletion onto the success response
  stateProbe.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}
